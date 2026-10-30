/**
 * Phase B2 只读探针：生产同构 NLU（messages → Worker /api/ai/clue/complete → Zod → map）。
 * 不改生产行为；结果写入 docs/audits/snapshots/。
 */
import { createServer } from 'vite'
import { resolve, dirname } from 'node:path'
import { existsSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const root = resolve(scriptDir, '..')
const repoRoot = resolve(root, '..')

if (!process.env.NODE_EXTRA_CA_CERTS) {
  process.env.NODE_EXTRA_CA_CERTS = '/etc/ssl/cert.pem'
}

function loadEnv() {
  for (const name of ['.env.shared.local', '.env.development.local', '.env.local']) {
    for (const base of [repoRoot, root]) {
      const path = resolve(base, name)
      if (!existsSync(path)) continue
      for (const line of readFileSync(path, 'utf8').split('\n')) {
        const t = line.trim()
        if (!t || t.startsWith('#') || !t.includes('=')) continue
        const eq = t.indexOf('=')
        const k = t.slice(0, eq).trim()
        let v = t.slice(eq + 1).trim()
        if (
          (v.startsWith('"') && v.endsWith('"')) ||
          (v.startsWith("'") && v.endsWith("'"))
        ) {
          v = v.slice(1, -1)
        }
        if (process.env[k] === undefined) process.env[k] = v
      }
    }
  }
}

loadEnv()

const apiBase = (process.env.VITE_API_BASE_URL || 'http://localhost:8787').replace(/\/$/, '')
const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const service = process.env.SUPABASE_SERVICE_ROLE_KEY
const anon = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
if (!url || !service || !anon) {
  throw new Error('missing supabase env for mint')
}

const admin = createClient(url, service, {
  auth: { persistSession: false, autoRefreshToken: false }
})
const email = 'retrieval-ablation-local@yiveno.dev'
const link = await admin.auth.admin.generateLink({ type: 'magiclink', email })
if (link.error || !link.data.properties?.hashed_token) {
  throw new Error('generateLink: ' + (link.error?.message || 'no token'))
}
const anonClient = createClient(url, anon, {
  auth: { persistSession: false, autoRefreshToken: false }
})
const verified = await anonClient.auth.verifyOtp({
  type: 'email',
  token_hash: link.data.properties.hashed_token
})
if (verified.error || !verified.data.session?.access_token) {
  throw new Error('verifyOtp: ' + verified.error?.message)
}
const token = verified.data.session.access_token

const server = await createServer({
  configFile: false,
  root,
  resolve: { alias: { '@': resolve(root, 'src') } },
  server: { middlewareMode: true },
  appType: 'custom'
})

try {
  const { buildLlmParseClueMessages } = await server.ssrLoadModule(
    '/src/core/recall/understand/build-llm-parse-prompt.ts'
  )
  const { LlmParsedClueProposalSchema } = await server.ssrLoadModule(
    '/src/core/recall/understand/llm-parsed-clue-proposal.ts'
  )
  const { mapLlmProposalToParsedClue } = await server.ssrLoadModule(
    '/src/core/recall/understand/map-llm-proposal-to-parsed.ts'
  )
  const { parseJsonObjectFromLlmText } = await server.ssrLoadModule(
    '/src/core/recall/understand/extract-llm-json.ts'
  )
  const { parseRecallClue } = await server.ssrLoadModule('/src/core/recall/parse-recall-clue.ts')
  const { buildFilterClueFromParsed } = await server.ssrLoadModule(
    '/src/core/recall/orchestrate-keyword-recall.ts'
  )
  const { ParsedRecallClueSchema } = await server.ssrLoadModule(
    '/src/core/recall/parse-recall-clue-types.ts'
  )

  const clues = [
    {
      id: 'intent-A',
      clue: 'my Yellowstone lodging booking confirmation from that summer, not the day-hike packing checklist'
    },
    {
      id: 'intent-B',
      clue: 'the Yellowstone day-hike packing checklist I saved'
    }
  ]
  const nowMs = 1784980800000
  const schemaKeys = Object.keys(ParsedRecallClueSchema.shape)
  const results = []

  for (const item of clues) {
    const messages = buildLlmParseClueMessages(item.clue)
    const res = await fetch(`${apiBase}/api/ai/clue/complete`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        messages,
        maxTokens: 512,
        temperature: 0,
        taskKind: 'nlu'
      })
    })
    const body = await res.json()
    const rules = parseRecallClue(item.clue, { nowMs })
    let proposal = null
    let mapped = null
    let parseError = null
    if (res.ok && typeof body.text === 'string') {
      try {
        const raw = parseJsonObjectFromLlmText(body.text)
        proposal = LlmParsedClueProposalSchema.parse(raw)
        mapped = mapLlmProposalToParsedClue(item.clue, proposal, nowMs)
      } catch (e) {
        parseError = e instanceof Error ? e.message : String(e)
      }
    }
    results.push({
      id: item.id,
      clue: item.clue,
      httpStatus: res.status,
      model: body.model ?? null,
      provider: body.provider ?? null,
      rawTextPreview: typeof body.text === 'string' ? body.text.slice(0, 800) : null,
      proposal,
      mappedParsed: mapped,
      mappedExcludeContentTerms: mapped?.excludeContentTerms ?? [],
      mappedFilterClue: mapped ? buildFilterClueFromParsed(mapped) : null,
      rulesParsed: rules,
      rulesExcludeContentTerms: rules.excludeContentTerms ?? [],
      rulesFilterClue: buildFilterClueFromParsed(rules),
      parseError,
      error: body.error ?? null
    })
  }

  const out = {
    generatedAt: new Date().toISOString(),
    evidenceClass: 'production_real_parse_via_worker_clue_complete_post_exclude_impl',
    noteZh:
      'Prompt 由客户端 buildLlmParseClueMessages 构造；Worker 仅代理 chat。Schema 与生产 mapLlmProposalToParsedClue 同源。非 Side Panel 真机 UI，但是生产 NLU 同构链路。分别报告 LLM map 与规则降级。',
    apiBase,
    schemaKeys,
    hasExcludeSlotOnParsedRecallClue: schemaKeys.includes('excludeContentTerms'),
    proposalSchemaKeys: [
      'timeLabel',
      'objectTypes',
      'behaviorHints',
      'noteHint',
      'contentTerms',
      'excludeContentTerms',
      'confidence'
    ],
    results
  }
  const outPath = resolve(
    repoRoot,
    'docs/audits/snapshots/2026-10-30-B2-negative-constraint-prod-parse-after.json'
  )
  mkdirSync(resolve(repoRoot, 'docs/audits/snapshots'), { recursive: true })
  writeFileSync(outPath, JSON.stringify(out, null, 2) + '\n')
  console.log(JSON.stringify(out, null, 2))
  console.log('wrote', outPath)
} finally {
  await server.close()
}
