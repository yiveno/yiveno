/**
 * user-sim 真实 embedding 轨：物品与 clue 均经 Worker /api/ai/embed 真实向量化。
 *
 * 与确定性轨（user-sim:run）的差异仅在语义路径：queryVector 与物品 embedding
 * 换成真实模型向量；解析、过滤、融合、归因完全复用 Stage2。
 * 禁止：fake embedding / embeddingAnchor 续算；embed 失败即抛错停下。
 *
 * 鉴权（与 retrieval-ablation:real 同源）：
 *   RETRIEVAL_ABLATION_ACCESS_TOKEN，或
 *   RETRIEVAL_ABLATION_MINT_TOKEN → POST /api/eval/mint-session
 * API 基址：RETRIEVAL_ABLATION_API_BASE / VITE_API_BASE_URL / http://localhost:8787
 *
 * 用法：
 *   cd extension && bun run user-sim:real
 *   USER_SIM_PERSONA=creator,scene-memory-user bun run user-sim:real
 */

import { execSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { createClient } from '@supabase/supabase-js'

import { runStage2Case } from '../tests/eval/clue-chain/stage2/run-case'
import { computeStage2Summary } from '../tests/eval/clue-chain/stage2/score'
import type { Stage2CaseResult } from '../tests/eval/clue-chain/stage2/types'
import { USER_SIM_PERSONAS } from '../tests/eval/user-sim/personas'
import { generateUserSimDataset } from '../tests/eval/user-sim/generate'
import { validateUserSimDataset } from '../tests/eval/user-sim/validate'
import { toStage2Tasks } from '../tests/eval/user-sim/to-stage2'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const extensionRoot = resolve(scriptDir, '..')
const repoRoot = resolve(extensionRoot, '..')
const runsDir = resolve(extensionRoot, 'tests/eval/user-sim/runs-real')
const END_ISO = '2026-11-28'
const NOW_MS = Date.parse(`${END_ISO}T12:00:00Z`)
const EMBED_BATCH = 8
const DEFAULT_PERSONAS = ['indie-dev-researcher', 'creator', 'scene-memory-user']

function resolveGitHead(): string {
  try {
    return execSync('git rev-parse HEAD', { cwd: repoRoot, encoding: 'utf8' }).trim()
  } catch {
    return 'unknown'
  }
}

function stampFromDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}_${pad(date.getUTCHours())}-${pad(date.getUTCMinutes())}-${pad(date.getUTCSeconds())}`
}

const DEFAULT_EVAL_EMAIL = 'retrieval-ablation-local@yiveno.dev'

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

async function embedTexts(
  apiBase: string,
  accessToken: string,
  texts: readonly string[],
  observed: { model: string | null; dim: number | null }
): Promise<number[][]> {
  const out: number[][] = []
  for (let i = 0; i < texts.length; i += EMBED_BATCH) {
    const batch = texts.slice(i, i + EMBED_BATCH)
    const response = await fetch(`${apiBase}/api/ai/embed`, {
      method: 'POST',
      headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
      body: JSON.stringify({ texts: [...batch] })
    })
    const body: unknown = await response.json().catch(() => null)
    if (!response.ok) {
      const errorCode =
        typeof body === 'object' &&
        body !== null &&
        'error' in body &&
        typeof (body as { error: unknown }).error === 'string'
          ? (body as { error: string }).error
          : `http_${response.status}`
      throw new Error(`embed_failed:${errorCode}`)
    }
    if (
      typeof body !== 'object' ||
      body === null ||
      !('success' in body) ||
      (body as { success: unknown }).success !== true ||
      !('data' in body)
    ) {
      throw new Error('invalid_embed_response')
    }
    const data = (body as { data: { model?: string; dim?: number; embeddings?: number[][] } }).data
    if (!data.model || !Array.isArray(data.embeddings)) throw new Error('invalid_embed_response')
    if (data.embeddings.length !== batch.length) {
      throw new Error(`embed_count_mismatch:expected_${batch.length}_got_${data.embeddings.length}`)
    }
    for (let j = 0; j < data.embeddings.length; j += 1) {
      const vector = data.embeddings[j]
      if (!Array.isArray(vector) || vector.length === 0) {
        throw new Error(`empty_embedding_at_${i + j}`)
      }
      if (typeof data.dim === 'number' && vector.length !== data.dim) {
        throw new Error(`dim_mismatch_at_${i + j}:got_${vector.length}_expected_${data.dim}`)
      }
    }
    observed.model = data.model
    observed.dim = data.dim ?? data.embeddings[0]?.length ?? null
    out.push(...data.embeddings)
  }
  return out
}

function computeNearNeighbor(
  cases: Stage2CaseResult[],
  itemTopics: Record<string, string>,
  itemAspects: Record<string, string>
): { rankFailures: number; sameTopicTop1: number; sameAspectTop1: number; sameTopicRate: number } {
  let rankFailures = 0
  let sameTopicTop1 = 0
  let sameAspectTop1 = 0
  for (const c of cases) {
    if (c.tier === 'negative' || c.stage !== 'rank' || !c.targetId || c.rankedIds.length === 0)
      continue
    rankFailures++
    const top1 = c.rankedIds[0]!
    if (itemTopics[top1] && itemTopics[top1] === itemTopics[c.targetId]) sameTopicTop1++
    if (itemAspects[top1] && itemAspects[top1] === itemAspects[c.targetId]) sameAspectTop1++
  }
  return {
    rankFailures,
    sameTopicTop1,
    sameAspectTop1,
    sameTopicRate: rankFailures > 0 ? sameTopicTop1 / rankFailures : 0
  }
}

export async function runUserSimRealCli(): Promise<void> {
  loadLocalEnvFiles()
  const seed = Number(process.env.USER_SIM_SEED ?? 42)
  const onlyPersona = process.env.USER_SIM_PERSONA?.trim()
  const wanted = onlyPersona
    ? onlyPersona
        .split(',')
        .map(s => s.trim())
        .filter(Boolean)
    : DEFAULT_PERSONAS
  const personas = USER_SIM_PERSONAS.filter(p => wanted.includes(p.id))
  if (personas.length === 0) {
    throw new Error(`unknown USER_SIM_PERSONA: ${onlyPersona}`)
  }
  const apiBase = resolveApiBase()
  const accessToken = await resolveAccessToken(apiBase)
  const observed: { model: string | null; dim: number | null } = { model: null, dim: null }
  const head = resolveGitHead()
  const startedAt = new Date()
  const perPersona: Record<string, unknown> = {}

  for (const persona of personas) {
    const data = generateUserSimDataset({ seed, endIso: END_ISO, personaId: persona.id })
    const problems = validateUserSimDataset(data)
    if (problems.length > 0) {
      throw new Error(`user-sim validate failed for ${persona.id}: ${problems.join('; ')}`)
    }
    const itemTexts = data.memoryItems.map(item =>
      [item.clues.title, item.clues.textExcerpt].filter(Boolean).join('\n')
    )
    const itemVectors = await embedTexts(apiBase, accessToken, itemTexts, observed)
    const corpus = data.memoryItems.map((item, i) => ({
      ...item,
      clues: {
        ...item.clues,
        embedding: itemVectors[i]!,
        embeddingModel: observed.model ?? 'unknown',
        embeddingDim: itemVectors[i]!.length
      }
    }))
    const tasks = toStage2Tasks(data)
    const clueVectors = await embedTexts(
      apiBase,
      accessToken,
      tasks.map(t => t.clue),
      observed
    )
    const cases: Stage2CaseResult[] = []
    for (let i = 0; i < tasks.length; i += 1) {
      cases.push(
        await runStage2Case({
          task: tasks[i]!,
          corpus,
          nowMs: NOW_MS,
          queryVectorOverride: clueVectors[i]!,
          clueEmbeddingTextOverride: tasks[i]!.clue
        })
      )
    }
    const summary = computeStage2Summary(cases)
    const nearNeighbor = computeNearNeighbor(
      cases,
      data.groundTruth.itemTopics,
      data.groundTruth.itemAspects
    )
    perPersona[persona.id] = { counts: data.meta.counts, summary, nearNeighbor, cases }
    console.log(
      `user-sim-real · ${persona.id} · saves=${data.meta.counts.saves} · R@1=${summary.positive.recallAt1.toFixed(3)} R@5=${summary.positive.recallAt5.toFixed(3)} MRR=${summary.positive.mrr.toFixed(3)} negFH=${summary.negativeFalseHitRate.toFixed(3)} nnTopic=${nearNeighbor.sameTopicRate.toFixed(3)} stages=${JSON.stringify(summary.stageCounts)}`
    )
  }

  const report = {
    schemaVersion: 1,
    kind: 'user-sim-recall-real',
    head,
    startedAt: startedAt.toISOString(),
    finishedAt: new Date().toISOString(),
    seed,
    endIso: END_ISO,
    track: {
      parse: 'rules',
      embedding: 'real',
      model: observed.model,
      dim: observed.dim,
      llm: false
    },
    personas: perPersona
  }
  mkdirSync(runsDir, { recursive: true })
  const stamp = stampFromDate(startedAt)
  const runPath = resolve(runsDir, `run-${stamp}_${head.slice(0, 8)}.json`)
  writeFileSync(runPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
  writeFileSync(resolve(runsDir, 'latest.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8')
  console.log(`wrote run → ${runPath}`)
}
