/**
 * user-sim Dreaming 评分轨：把模拟摘录送入真实 Dreaming 编译端点，
 * 用隔离 Ground truth 锚点评分（逐字率 / 锚点覆盖 / 空结果率）。
 * 鉴权与 user-sim:real 同源（supabase_admin_mint）。
 * 模拟数据只作机制验证，不作真实用户证据。
 */

import { execSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { createClient } from '@supabase/supabase-js'

import { generateUserSimDataset, userSimTokens } from '../tests/eval/user-sim/generate'
import { USER_SIM_PERSONAS } from '../tests/eval/user-sim/personas'
import { validateUserSimDataset } from '../tests/eval/user-sim/validate'

const DEFAULT_EVAL_EMAIL = 'retrieval-ablation-local@yiveno.dev'
const SEED = 42
const END_ISO = '2026-11-28'
const DEFAULT_PERSONAS = ['indie-dev-researcher', 'creator', 'scene-memory-user']
const COMPILE_BATCH = 8
const SOURCE_LIMIT = Number(process.env.USER_SIM_DREAMING_LIMIT ?? 40)

const extensionRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const repoRoot = resolve(extensionRoot, '..')

function loadLocalEnvFiles(): void {
  const roots = [repoRoot, extensionRoot]
  const names = ['.env.shared.local', '.env.development.local', '.env.local']
  for (const root of roots) {
    for (const name of names) {
      const path = resolve(root, name)
      if (!existsSync(path)) continue
      for (const line of readFileSync(path, 'utf8').split('\n')) {
        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith('#')) continue
        const eq = trimmed.indexOf('=')
        if (eq <= 0) continue
        const key = trimmed.slice(0, eq).trim()
        let value = trimmed.slice(eq + 1).trim()
        if (
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
        ) {
          value = value.slice(1, -1)
        }
        if (process.env[key] === undefined) process.env[key] = value
      }
    }
  }
}

async function mintAccessTokenViaSupabaseAdmin(): Promise<string> {
  const url = process.env.SUPABASE_URL?.trim()
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  const anon = process.env.SUPABASE_ANON_KEY?.trim()
  if (!url || !service || !anon) {
    throw new Error(
      '缺少鉴权：RETRIEVAL_ABLATION_ACCESS_TOKEN / RETRIEVAL_ABLATION_MINT_TOKEN / SUPABASE_URL+SUPABASE_SERVICE_ROLE_KEY+SUPABASE_ANON_KEY 均未就绪'
    )
  }
  const email = process.env.RETRIEVAL_ABLATION_USER_EMAIL?.trim() || DEFAULT_EVAL_EMAIL
  const admin = createClient(url, service, {
    auth: { autoRefreshToken: false, persistSession: false }
  })
  let link = await admin.auth.admin.generateLink({ type: 'magiclink', email })
  if (link.error || !link.data?.properties?.hashed_token) {
    const created = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { purpose: 'user_sim_real_eval' }
    })
    if (created.error && !/already|registered|exists/i.test(created.error.message)) {
      throw new Error(`supabase_mint_failed:${created.error.message}`)
    }
    link = await admin.auth.admin.generateLink({ type: 'magiclink', email })
  }
  const hashed = link.data?.properties?.hashed_token
  if (link.error || !hashed) {
    throw new Error(`supabase_mint_failed:${link.error?.message ?? 'missing_hashed_token'}`)
  }
  const anonClient = createClient(url, anon, {
    auth: { autoRefreshToken: false, persistSession: false }
  })
  const otp = await anonClient.auth.verifyOtp({ type: 'email', token_hash: hashed })
  const token = otp.data.session?.access_token
  if (otp.error || !token) {
    throw new Error(`supabase_mint_failed:${otp.error?.message ?? 'missing_access_token'}`)
  }
  return token
}

function resolveApiBase(): string {
  const raw =
    process.env.RETRIEVAL_ABLATION_API_BASE?.trim() ||
    process.env.VITE_API_BASE_URL?.trim() ||
    'http://localhost:8787'
  return raw.replace(/\/$/, '')
}

async function resolveAccessToken(apiBase: string): Promise<string> {
  const direct = process.env.RETRIEVAL_ABLATION_ACCESS_TOKEN?.trim()
  if (direct) return direct
  const mintToken = process.env.RETRIEVAL_ABLATION_MINT_TOKEN?.trim()
  if (!mintToken) return mintAccessTokenViaSupabaseAdmin()
  const response = await fetch(`${apiBase}/api/eval/mint-session`, {
    method: 'POST',
    headers: { 'x-eval-mint-token': mintToken, 'content-type': 'application/json' },
    body: '{}'
  })
  const body: unknown = await response.json().catch(() => null)
  if (!response.ok || typeof body !== 'object' || body === null || !('data' in body)) {
    throw new Error(`mint_session_failed:http_${response.status}`)
  }
  const data = (body as { data: { accessToken?: string } }).data
  if (!data.accessToken) throw new Error('mint_session_missing_token')
  return data.accessToken
}

function resolveGitHead(): string {
  try {
    return execSync('git rev-parse HEAD', { cwd: repoRoot, encoding: 'utf8' }).trim()
  } catch {
    return 'unknown'
  }
}

type DreamingSource = {
  id: string
  type: 'bookmark' | 'text_excerpt'
  title?: string
  text: string
  note?: string
}
type DreamingRow = {
  sourceId: string
  status?: string
  propositions: { text: string; sourceQuote: string; topicAnchor?: string[] }[]
}

async function compileBatch(
  apiBase: string,
  accessToken: string,
  sources: DreamingSource[]
): Promise<{ model: string | null; results: DreamingRow[] }> {
  const response = await fetch(`${apiBase}/api/ai/dreaming/complete`, {
    method: 'POST',
    headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
    body: JSON.stringify({ sources })
  })
  const body: unknown = await response.json().catch(() => null)
  if (!response.ok || typeof body !== 'object' || body === null || !('results' in body)) {
    const code =
      typeof body === 'object' &&
      body !== null &&
      'error' in body &&
      typeof (body as { error: unknown }).error === 'string'
        ? (body as { error: string }).error
        : `http_${response.status}`
    throw new Error(`dreaming_compile_failed:${code}`)
  }
  const data = body as { results: DreamingRow[]; model?: string }
  return { model: data.model ?? null, results: data.results }
}

function anchorCovered(anchor: string, props: { text: string; sourceQuote: string }[]): boolean {
  const anchorTokens = userSimTokens(anchor)
  if (anchorTokens.size === 0) return false
  return props.some(p => {
    if (p.sourceQuote.includes(anchor) || anchor.includes(p.sourceQuote)) return true
    const propTokens = userSimTokens(`${p.text} ${p.sourceQuote}`)
    const hit = [...anchorTokens].filter(t => propTokens.has(t)).length
    return hit / anchorTokens.size >= 0.5
  })
}

export async function runUserSimDreamingCli(): Promise<void> {
  loadLocalEnvFiles()
  const onlyPersona = process.env.USER_SIM_PERSONA?.trim()
  const wanted = onlyPersona
    ? onlyPersona
        .split(',')
        .map(s => s.trim())
        .filter(Boolean)
    : DEFAULT_PERSONAS
  const personas = USER_SIM_PERSONAS.filter(p => wanted.includes(p.id))
  if (personas.length === 0) throw new Error(`unknown USER_SIM_PERSONA: ${onlyPersona}`)
  const apiBase = resolveApiBase()
  const accessToken = await resolveAccessToken(apiBase)
  const head = resolveGitHead()
  const startedAt = new Date()
  let model: string | null = null
  const perPersona: Record<string, unknown> = {}

  for (const persona of personas) {
    const data = generateUserSimDataset({ seed: SEED, endIso: END_ISO, personaId: persona.id })
    const problems = validateUserSimDataset(data)
    if (problems.length > 0)
      throw new Error(`user-sim validate failed for ${persona.id}: ${problems.join('; ')}`)
    const anchorByItem = new Map(data.groundTruth.dreaming.anchors.map(a => [a.itemId, a.anchor]))
    const excerptItems = data.memoryItems
      .filter(m => m.type === 'text_excerpt' && anchorByItem.has(m.id))
      .slice(0, SOURCE_LIMIT)
    const sources: DreamingSource[] = excerptItems.map(m => ({
      id: m.id,
      type: 'text_excerpt',
      ...(m.clues.title ? { title: m.clues.title } : {}),
      text: m.type === 'text_excerpt' ? m.payload.selectedText : '',
      ...(m.clues.note ? { note: m.clues.note } : {})
    }))
    const rows: DreamingRow[] = []
    let parseFailures = 0
    const compileAdaptive = async (batch: DreamingSource[]): Promise<void> => {
      try {
        const out = await compileBatch(apiBase, accessToken, batch)
        model = out.model ?? model
        rows.push(...out.results)
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error)
        if (!msg.includes('parse_failed')) throw error
        if (batch.length === 1) {
          parseFailures++
          rows.push({ sourceId: batch[0]!.id, status: 'dropped', propositions: [] })
          return
        }
        const mid = Math.ceil(batch.length / 2)
        await compileAdaptive(batch.slice(0, mid))
        await compileAdaptive(batch.slice(mid))
      }
    }
    for (let i = 0; i < sources.length; i += COMPILE_BATCH) {
      await compileAdaptive(sources.slice(i, i + COMPILE_BATCH))
    }
    const rowById = new Map(rows.map(r => [r.sourceId, r]))
    let totalProps = 0
    let verbatimProps = 0
    let coveredAnchors = 0
    let emptySources = 0
    const statusCounts: Record<string, number> = {}
    for (const src of sources) {
      const row = rowById.get(src.id)
      const props = row?.propositions ?? []
      const status = row?.status ?? (props.length > 0 ? 'ok' : 'omitted')
      statusCounts[status] = (statusCounts[status] ?? 0) + 1
      if (props.length === 0) emptySources++
      totalProps += props.length
      verbatimProps += props.filter(p => src.text.includes(p.sourceQuote)).length
      if (anchorCovered(anchorByItem.get(src.id)!, props)) coveredAnchors++
    }
    const summary = {
      sources: sources.length,
      totalPropositions: totalProps,
      verbatimRate: totalProps > 0 ? verbatimProps / totalProps : 0,
      anchorCoverage: sources.length > 0 ? coveredAnchors / sources.length : 0,
      emptyRate: sources.length > 0 ? emptySources / sources.length : 0,
      parseFailures,
      statusCounts
    }
    perPersona[persona.id] = { summary, rows }
    console.log(
      `user-sim-dreaming · ${persona.id} · sources=${summary.sources} props=${summary.totalPropositions} verbatim=${summary.verbatimRate.toFixed(3)} coverage=${summary.anchorCoverage.toFixed(3)} empty=${summary.emptyRate.toFixed(3)}`
    )
  }

  const report = {
    schemaVersion: 1,
    generatedAt: startedAt.toISOString(),
    baseCommit: head,
    track: { dreaming: 'real', model, sourceLimit: SOURCE_LIMIT },
    personas: perPersona
  }
  const runsDir = resolve(
    dirname(fileURLToPath(import.meta.url)),
    '../tests/eval/user-sim/runs-dreaming'
  )
  mkdirSync(runsDir, { recursive: true })
  const stamp = startedAt.toISOString().replace(/[:.]/g, '-').slice(0, 19)
  writeFileSync(
    resolve(runsDir, `run-${stamp}_${head}.json`),
    JSON.stringify(report, null, 2),
    'utf8'
  )
  writeFileSync(resolve(runsDir, 'latest.json'), JSON.stringify(report, null, 2), 'utf8')
}
