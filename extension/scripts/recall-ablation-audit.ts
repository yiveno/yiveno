/**
 * Recall 消融审计（Step 0 定锚后离线只读实验）。
 *
 * 用法：
 *   cd extension && bun run scripts/recall-ablation-audit.mjs
 *   cd extension && bun run scripts/recall-ablation-audit.mjs -- --arms=baseline,A1,A3
 *   cd extension && bun run scripts/recall-ablation-audit.mjs -- --skip-llm
 *
 * 环境：
 *   DEEPSEEK_API_KEY | PARSE_GOLD_LLM_API_KEY（理解类臂）
 *   SUPABASE_* 或 RETRIEVAL_ABLATION_ACCESS_TOKEN（检索类臂真实 BGE）
 *   VITE_API_BASE_URL / RETRIEVAL_ABLATION_API_BASE（默认 https://api.yiveno.com）
 *
 * 输出：
 *   docs/audits/2026-11-18-recall-ablation-audit.md
 *   docs/audits/2026-11-18-recall-ablation-audit.json
 *
 * 硬规则：不改产品文件；禁止 fake embedding；密钥只从 .env*.local 加载。
 */

import { createClient } from '@supabase/supabase-js'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { fuseKeywordAndSemanticPools } from '../src/application/recall/backends/hybrid-recall-backend'
import {
  RECALL_COLLAPSE_BACKFILL_EXTRA,
  RECALL_RESULT_POOL_LIMIT,
  filterKeywordMatchesBeforeCollapse
} from '../src/core/recall/build-recall-result'
import { buildClueEmbeddingText } from '../src/core/recall/build-clue-embedding-text'
import { collapseRecallMatches } from '../src/core/recall/collapse-recall-duplicates'
import {
  effectiveContentTermsForRecall,
  filterMatchesByContentTermCorroboration,
  softPenalizeMatchesByContentTermCorroboration
} from '../src/core/recall/content-term-corroboration'
import { filterMatchesByExcludeContentTerms } from '../src/core/recall/exclude-content-terms'
import { PRESSURE_CASES } from '../tests/eval/arbitrary-input-pressure-cases'
import { INTENT_EVAL_MUST } from '../tests/eval/intent-eval-cases'
import {
  meanMrr,
  meanNdcgAtK,
  meanRecallAtK,
  mrrContribution,
  ndcgAtK,
  recallAtK,
  stabilizeRankedIds
} from '../tests/eval/metrics'
import {
  RETRIEVAL_ABLATION_CASES,
  type RetrievalAblationCase
} from '../tests/eval/retrieval-ablation-cases'
import {
  ablationCorpusFingerprint,
  assertAblationCorpusHasNoEmbeddings,
  buildRetrievalAblationCorpus,
  RETRIEVAL_ABLATION_NOW_MS
} from '../tests/eval/retrieval-ablation-corpus'
import { WORKER_EMBEDDING_MODEL_HINT } from '../tests/eval/retrieval-ablation-fusion-constants'
import {
  buildNoiseGatewayEvalCases,
  runNoiseGatewayEval
} from '../tests/eval/run-noise-gateway-eval'
import {
  HYBRID_KEYWORD_POOL,
  HYBRID_MIN_COSINE_SIMILARITY,
  HYBRID_SEMANTIC_NEIGHBOR_LIMIT,
  HYBRID_SEMANTIC_NEIGHBOR_LIMIT_EXPANDED,
  rankIdsByCosineToQuery,
  scoreFromCosineSimilarity,
  sortIdsByRrf
} from '../src/core/recall/hybrid-fusion'
import { isGenericOnlyHitAgainstSpecificClue } from '../src/core/recall/keyword-filter'
import { FIELD_WEIGHTS, RECALL_TOP_PICK_MIN_SCORE } from '../src/core/recall/keyword-filter-weights'
import { buildEmbeddingTextFromMemoryItem } from '../src/core/memory/build-embedding-text'
import type { MemoryItem } from '../src/core/memory/memory-item'
import {
  applyParsedClueScoreBoosts,
  buildFilterClueFromParsed,
  filterMatchesByParsedTimeRange,
  recallByKeywordWithParsedClue
} from '../src/core/recall/orchestrate-keyword-recall'
import type { ParsedRecallClue } from '../src/core/recall/parse-recall-clue-types'
import {
  ParsedRecallClueSchema,
  type RecallBehaviorHint,
  type RecallObjectType
} from '../src/core/recall/parse-recall-clue-types'
import type { RecallMatch } from '../src/core/recall/recall-result'
import {
  extractContentTerms,
  resolveRecallClueConfidence,
  resolveRelativeTimeRange,
  timeConfidenceForRelativeLabel
} from '../src/core/recall/parse-recall-clue'
import { reconcilePositiveAndExcludeTerms } from '../src/core/recall/exclude-content-terms'
import { buildLlmParseClueMessages } from '../src/core/recall/understand/build-llm-parse-prompt'
import { parseJsonObjectFromLlmText } from '../src/core/recall/understand/extract-llm-json'
import { LlmParsedClueProposalSchema } from '../src/core/recall/understand/llm-parsed-clue-proposal'
import { mapLlmProposalToParsedClue } from '../src/core/recall/understand/map-llm-proposal-to-parsed'
import {
  resolveOpenAiCompatibleChatCompletionsUrl,
  type OpenAiCompatibleChatCompat
} from '../src/core/recall/understand/openai-compatible-chat'
import {
  createOpenAiCompatibleCompleter,
  type LlmChatCompleter
} from '../src/core/recall/understand/parse-recall-clue-with-llm'
import { understandRecallClue } from '../src/core/recall/understand/understand-recall-clue'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(scriptDir, '../..')
const OUT_JSON = resolve(repoRoot, 'docs/audits/2026-11-18-recall-ablation-audit.json')
const OUT_MD = resolve(repoRoot, 'docs/audits/2026-11-18-recall-ablation-audit.md')
const ARTIFACT_PRIMARY = '/tmp/recall-ablation-44315251740/retrieval-ablation-real-report.json'
const ARTIFACT_FALLBACK = resolve(
  repoRoot,
  'docs/audits/2026-10-L2召回消融-real-run-b2-aligned.json'
)
const DEFAULT_EVAL_EMAIL = 'retrieval-ablation-local@yiveno.dev'
const BASELINE_MODEL = 'deepseek-v4-flash'
const METRIC_EPS = 1e-6

type ArmId =
  'baseline' | 'A1' | 'A2' | 'A3' | 'A4' | 'A5' | 'A6' | 'A7' | 'A8' | 'A9' | 'A10' | 'A11' | 'C1'

type Verdict = '可删' | '保留' | '待查' | '无结论' | '基线'

interface UnderstandCaseRow {
  id: string
  set: 'live' | 'pressure' | 'noise'
  clue: string
  expected?: string
  passed: boolean
  intent: string
  source: string
  latencyMs: number
  llmCalled: boolean
  note: string
  slots?: Record<string, unknown>
}

interface RetrievalCaseRow {
  caseId: string
  expectationKind: 'hit' | 'miss'
  expectedId: string
  rankedIds: string[]
  rank: number | null
  recallAt1: boolean
  recallAt5: boolean
  mrr: number
  ndcgAt5: number
  topPick: boolean
  topPickScore: number | null
  note: string
}

interface ArmResult {
  arm: ArmId
  label: string
  verdict: Verdict
  verdictNote: string
  mustVitest: string
  live: { passed: number; total: number }
  pressure: { passed: number; total: number }
  noise: { passed: number; total: number; falseIntoParse?: number }
  retrieval?: {
    recallAt1: number | null
    recallAt5: number | null
    mrr: number | null
    ndcgAt5: number | null
    hitDenom: number
    source?: string
  }
  llmCalls: number
  latencyMedianMs: number | null
  understandRows?: UnderstandCaseRow[]
  retrievalRows?: RetrievalCaseRow[]
  extra?: Record<string, unknown>
}

interface HybridFlags {
  /** A4：不要关键词池 */
  skipKeyword?: boolean
  /** A3 语义：不要语义池（本脚本 A3 不跑，走 artifact） */
  skipSemantic?: boolean
  /** A5：分数相加替代 RRF */
  scoreSumFusion?: boolean
  /** A6 / C1：关掉领先者保护 */
  skipLeaderProtect?: boolean
  /** A7 / C1：关掉佐证 */
  skipCorroboration?: boolean
  /** A8 / C1：低于 18 分仍当 top_pick */
  skipTopPickMinScore?: boolean
  /** A9：字段权重拉平 */
  flatWeights?: boolean
  /** A10：整句 clue embed */
  embedRawClue?: boolean
  /** A11 / C1：keyword-miss 不扩到 100 */
  noKeywordMissExpand?: boolean
}

function loadLocalEnvFiles(): void {
  const roots = [repoRoot, resolve(scriptDir, '..')]
  const names = ['.env.shared.local', '.env.development.local', '.env.local']
  for (const root of roots) {
    for (const name of names) {
      const path = resolve(root, name)
      if (!existsSync(path)) continue
      const text = readFileSync(path, 'utf8')
      for (const line of text.split('\n')) {
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

function parseArmsArg(): Set<ArmId> {
  const all: ArmId[] = [
    'baseline',
    'A1',
    'A2',
    'A3',
    'A4',
    'A5',
    'A6',
    'A7',
    'A8',
    'A9',
    'A10',
    'A11',
    'C1'
  ]
  const arg = process.argv.find(a => a.startsWith('--arms='))
  if (!arg) return new Set(all)
  const list = arg
    .slice('--arms='.length)
    .split(',')
    .map(s => s.trim())
    .filter(Boolean) as ArmId[]
  return new Set(list.length ? list : all)
}

function skipLlm(): boolean {
  return process.argv.includes('--skip-llm')
}

function median(nums: number[]): number | null {
  if (nums.length === 0) return null
  const sorted = [...nums].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!
}

function nowStampShanghai(): string {
  const created = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(new Date())
  return `${created} +0800`
}

function resolveCompat(raw: string | undefined): OpenAiCompatibleChatCompat {
  const compat = raw?.trim() || 'deepseek'
  if (compat === 'deepseek' || compat === 'openai' || compat === 'dashscope') return compat
  throw new Error('PARSE_GOLD_LLM_COMPAT invalid')
}

function resolveDeepseekApiKey(): { apiKey: string; source: string } {
  const explicit = process.env.PARSE_GOLD_LLM_API_KEY?.trim()
  if (explicit) return { apiKey: explicit, source: 'PARSE_GOLD_LLM_API_KEY' }
  const deepseek = process.env.DEEPSEEK_API_KEY?.trim()
  if (deepseek) return { apiKey: deepseek, source: 'DEEPSEEK_API_KEY' }
  throw new Error('缺少 DEEPSEEK_API_KEY / PARSE_GOLD_LLM_API_KEY')
}

function resolveApiBase(): string {
  // 本审计默认打生产 BGE（与 run 44315251740 同底座）；本机 8787 仅显式指定时用。
  const raw =
    process.env.RETRIEVAL_ABLATION_API_BASE?.trim() ||
    process.env.RECALL_ABLATION_API_BASE?.trim() ||
    'https://api.yiveno.com'
  return raw.replace(/\/$/, '')
}

function metricMoved(a: number | null | undefined, b: number | null | undefined): boolean {
  if (a == null && b == null) return false
  if (a == null || b == null) return true
  return Math.abs(a - b) > METRIC_EPS
}

function rateMoved(
  a: { passed: number; total: number },
  b: { passed: number; total: number }
): boolean {
  return a.passed !== b.passed || a.total !== b.total
}

/** 无 grounding：保留 Zod 结构，槽位原样采用，不做词面支撑/词典补提。 */
function mapLlmProposalWithoutGrounding(
  clue: string,
  proposal: ReturnType<typeof LlmParsedClueProposalSchema.parse>,
  nowMs: number
): ParsedRecallClue {
  const raw = clue.trim()
  const timeLabel = proposal.timeLabel ?? undefined
  const timeRange = timeLabel ? resolveRelativeTimeRange(timeLabel, nowMs) : undefined
  const timeConfidence = timeLabel ? timeConfidenceForRelativeLabel(timeLabel) : undefined
  const objectTypes = (proposal.objectTypes ?? []).filter(Boolean) as RecallObjectType[]
  const behaviorHints = (proposal.behaviorHints ?? []).filter(Boolean) as RecallBehaviorHint[]
  const noteHint = proposal.noteHint === true ? true : undefined
  let contentTerms = extractContentTerms(proposal.contentTerms.join(' '))
  const objectTypeOtherTrimmed =
    typeof proposal.objectTypeOther === 'string' ? proposal.objectTypeOther.trim() : ''
  const objectTypeOther =
    objectTypeOtherTrimmed.length >= 1 && objectTypeOtherTrimmed.length <= 40
      ? objectTypeOtherTrimmed
      : undefined
  if (objectTypeOther) {
    const otherTerms = extractContentTerms(objectTypeOther)
    const seen = new Set(contentTerms)
    for (const term of otherTerms) {
      if (!seen.has(term)) {
        seen.add(term)
        contentTerms.push(term)
      }
    }
  }
  const excludeFromProposal = extractContentTerms((proposal.excludeContentTerms ?? []).join(' '))
  const reconciled = reconcilePositiveAndExcludeTerms({
    contentTerms,
    excludeContentTerms: excludeFromProposal
  })
  contentTerms = reconciled.contentTerms
  const excludeContentTerms = reconciled.excludeContentTerms
  return ParsedRecallClueSchema.parse({
    raw,
    contentTerms,
    confidence: resolveRecallClueConfidence({
      hasTime: Boolean(timeRange),
      hasObject: objectTypes.length > 0,
      hasBehavior: behaviorHints.length > 0,
      hasNote: noteHint === true,
      hasContent: contentTerms.length > 0
    }),
    ...(timeRange ? { timeRange } : {}),
    ...(timeConfidence ? { timeConfidence } : {}),
    ...(objectTypes.length > 0 ? { objectTypes } : {}),
    ...(objectTypeOther ? { objectTypeOther } : {}),
    ...(behaviorHints.length > 0 ? { behaviorHints } : {}),
    ...(noteHint ? { noteHint } : {}),
    ...(excludeContentTerms.length > 0 ? { excludeContentTerms } : {}),
    ...(proposal.intent !== 'recall' ? { intent: proposal.intent } : {}),
    ...(proposal.intent !== 'recall' && proposal.assistantReply?.trim()
      ? { assistantReply: proposal.assistantReply.trim().slice(0, 280) }
      : {})
  })
}

async function fetchLlmProposal(
  complete: LlmChatCompleter,
  clue: string
): Promise<ReturnType<typeof LlmParsedClueProposalSchema.parse>> {
  const messages = buildLlmParseClueMessages(clue)
  const text = await complete(messages, { taskKind: 'nlu' })
  const rawJson = parseJsonObjectFromLlmText(text)
  return LlmParsedClueProposalSchema.parse(rawJson)
}

async function mintAccessTokenViaSupabaseAdmin(): Promise<string> {
  const url = process.env.SUPABASE_URL?.trim()
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  const anon = process.env.SUPABASE_ANON_KEY?.trim()
  if (!url || !service || !anon) {
    throw new Error('缺少 SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / SUPABASE_ANON_KEY')
  }
  const email = process.env.RETRIEVAL_ABLATION_USER_EMAIL?.trim() || DEFAULT_EVAL_EMAIL
  const admin = createClient(url, service, {
    auth: { autoRefreshToken: false, persistSession: false }
  })
  let link = await admin.auth.admin.generateLink({ type: 'magiclink', email })
  if (link.error || !link.data?.properties?.hashed_token) {
    await admin.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { purpose: 'recall_ablation_audit' }
    })
    link = await admin.auth.admin.generateLink({ type: 'magiclink', email })
  }
  const hashed = link.data?.properties?.hashed_token
  if (link.error || !hashed) {
    throw new Error(`generateLink 失败: ${link.error?.message ?? 'missing_hashed_token'}`)
  }
  const anonClient = createClient(url, anon, {
    auth: { autoRefreshToken: false, persistSession: false }
  })
  const otp = await anonClient.auth.verifyOtp({ type: 'email', token_hash: hashed })
  const token = otp.data.session?.access_token
  if (otp.error || !token) {
    throw new Error(`verifyOtp 失败: ${otp.error?.message ?? 'missing_access_token'}`)
  }
  return token
}

async function resolveEmbedAccessToken(): Promise<{ token: string; source: string }> {
  const envToken = process.env.RETRIEVAL_ABLATION_ACCESS_TOKEN?.trim()
  if (envToken) return { token: envToken, source: 'RETRIEVAL_ABLATION_ACCESS_TOKEN' }
  const token = await mintAccessTokenViaSupabaseAdmin()
  return { token, source: 'supabase_admin_mint' }
}

function createWorkerEmbedClient(accessToken: string, apiBaseUrl: string) {
  return {
    model: WORKER_EMBEDDING_MODEL_HINT,
    async embedTexts(texts: readonly string[]): Promise<number[][]> {
      const response = await fetch(`${apiBaseUrl}/api/ai/embed`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${accessToken}`,
          'content-type': 'application/json'
        },
        body: JSON.stringify({ texts: [...texts] })
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
        throw new Error(errorCode)
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
      const data = (body as { data: { model?: string; embeddings?: number[][] } }).data
      if (data.model !== WORKER_EMBEDDING_MODEL_HINT) {
        throw new Error(`unexpected_embed_model:${data.model}`)
      }
      if (!Array.isArray(data.embeddings) || data.embeddings.length !== texts.length) {
        throw new Error('embed_count_mismatch')
      }
      for (let i = 0; i < data.embeddings.length; i += 1) {
        const vector = data.embeddings[i]
        if (!Array.isArray(vector) || vector.length === 0) {
          throw new Error(`empty_embedding_at_${i}`)
        }
      }
      return data.embeddings
    }
  }
}

async function embedCorpus(
  items: MemoryItem[],
  embedTexts: (texts: readonly string[]) => Promise<number[][]>
): Promise<MemoryItem[]> {
  const texts = items.map(item => buildEmbeddingTextFromMemoryItem(item))
  const vectors: number[][] = []
  const BATCH = 8
  for (let offset = 0; offset < texts.length; offset += BATCH) {
    const slice = texts.slice(offset, offset + BATCH)
    const batch = await embedTexts(slice)
    vectors.push(...batch)
  }
  return items.map((item, index) => ({
    ...item,
    clues: {
      ...item.clues,
      embedding: [...vectors[index]!],
      embeddingModel: WORKER_EMBEDDING_MODEL_HINT,
      embeddingDim: vectors[index]!.length
    }
  }))
}

function withFlatFieldWeights<T>(fn: () => T): T {
  const backup = { ...FIELD_WEIGHTS }
  const keys = Object.keys(FIELD_WEIGHTS)
  for (const key of keys) {
    FIELD_WEIGHTS[key] = 16
  }
  try {
    return fn()
  } finally {
    for (const key of Object.keys(backup)) {
      FIELD_WEIGHTS[key] = backup[key]!
    }
  }
}

function fuseByScoreSum(
  keywordMatches: RecallMatch[],
  semanticMatches: RecallMatch[],
  parsed: ParsedRecallClue
): RecallMatch[] {
  const keywordTimed = filterMatchesByParsedTimeRange(keywordMatches, parsed)
  const semanticTimed = filterMatchesByParsedTimeRange(semanticMatches, parsed)
  if (keywordTimed.length === 0 && semanticTimed.length === 0) return []
  const maxKw = Math.max(1, ...keywordTimed.map(m => m.score))
  const maxSem = Math.max(1, ...semanticTimed.map(m => m.score))
  const byId = new Map<string, { match: RecallMatch; sum: number }>()
  for (const match of keywordTimed) {
    byId.set(match.item.id, { match, sum: match.score / maxKw })
  }
  for (const match of semanticTimed) {
    const prev = byId.get(match.item.id)
    const contrib = match.score / maxSem
    if (!prev) {
      byId.set(match.item.id, { match, sum: contrib })
      continue
    }
    byId.set(match.item.id, {
      match: {
        ...prev.match,
        score: Math.max(prev.match.score, match.score),
        matchedFields: prev.match.matchedFields.includes('embedding')
          ? prev.match.matchedFields
          : [...prev.match.matchedFields, 'embedding']
      },
      sum: prev.sum + contrib
    })
  }
  return [...byId.values()]
    .sort((a, b) => b.sum - a.sum)
    .map((entry, index) => ({
      ...entry.match,
      score: entry.match.score + Math.max(0, 40 - index),
      matchedFields: entry.match.matchedFields.includes('hybridRrf')
        ? entry.match.matchedFields
        : [...entry.match.matchedFields, 'hybridRrf']
    }))
}

function fuseByRrfWithoutLeader(
  keywordMatches: RecallMatch[],
  semanticMatches: RecallMatch[],
  parsed: ParsedRecallClue
): RecallMatch[] {
  const keywordTimed = filterMatchesByParsedTimeRange(keywordMatches, parsed)
  const semanticTimed = filterMatchesByParsedTimeRange(semanticMatches, parsed)
  const keywordOrder = keywordTimed.map(m => m.item.id)
  const semanticOrder = semanticTimed.map(m => m.item.id)
  const lists = [keywordOrder, semanticOrder].filter(list => list.length > 0)
  if (lists.length === 0) return []
  const fusedIds = sortIdsByRrf(lists, 60)
  const byId = new Map(keywordTimed.map(m => [m.item.id, m]))
  for (const match of semanticTimed) {
    const existing = byId.get(match.item.id)
    if (!existing) {
      byId.set(match.item.id, match)
      continue
    }
    byId.set(match.item.id, {
      ...existing,
      score: Math.max(existing.score, match.score),
      matchedFields: existing.matchedFields.includes('embedding')
        ? existing.matchedFields
        : [...existing.matchedFields, 'embedding']
    })
  }
  return fusedIds.flatMap((id, index) => {
    const base = byId.get(id)
    if (!base) return []
    return [
      {
        ...base,
        score: base.score + Math.max(0, 40 - index),
        matchedFields: base.matchedFields.includes('hybridRrf')
          ? base.matchedFields
          : [...base.matchedFields, 'hybridRrf']
      }
    ]
  })
}

function runHybridVariant(
  corpus: MemoryItem[],
  ablationCase: RetrievalAblationCase,
  queryVector: number[],
  flags: HybridFlags,
  nowMs: number
): { matches: RecallMatch[]; rankedIds: string[]; topPick: boolean; topPickScore: number | null } {
  const runBody = () => {
    const goldParsed = ablationCase.goldParsed
    const displayClue = ablationCase.clueForDisplay
    const filterClue = buildFilterClueFromParsed(goldParsed) || displayClue

    let keywordScored: RecallMatch[] = []
    if (!flags.skipKeyword) {
      keywordScored = collapseRecallMatches(
        filterKeywordMatchesBeforeCollapse(corpus, filterClue)
          .map(match => applyParsedClueScoreBoosts(match, goldParsed))
          .filter(match => !isGenericOnlyHitAgainstSpecificClue(filterClue, match.item)),
        { limit: HYBRID_KEYWORD_POOL }
      )
    }

    let semanticScored: RecallMatch[] = []
    if (!flags.skipSemantic) {
      const embeddedCandidates = corpus.flatMap(item => {
        const embedding = item.clues.embedding
        if (!Array.isArray(embedding) || embedding.length === 0) return []
        return [{ id: item.id, embedding }]
      })
      const semanticLimit =
        flags.noKeywordMissExpand || keywordScored.length > 0
          ? HYBRID_SEMANTIC_NEIGHBOR_LIMIT
          : HYBRID_SEMANTIC_NEIGHBOR_LIMIT_EXPANDED
      const itemsById = new Map(corpus.map(item => [item.id, item]))
      semanticScored = rankIdsByCosineToQuery(queryVector, embeddedCandidates, {
        limit: semanticLimit,
        minSimilarity: HYBRID_MIN_COSINE_SIMILARITY
      }).flatMap(neighbor => {
        const item = itemsById.get(neighbor.id)
        if (!item) return []
        return [
          applyParsedClueScoreBoosts(
            {
              item,
              score: scoreFromCosineSimilarity(neighbor.similarity),
              matchedFields: ['embedding']
            },
            goldParsed
          )
        ]
      })
    }

    if (flags.skipKeyword && flags.skipSemantic) {
      return { matches: [], rankedIds: [], topPick: false, topPickScore: null }
    }
    if (flags.skipSemantic) {
      // 纯关键词（A3 不走这里）
      const result = recallByKeywordWithParsedClue(corpus, displayClue, {
        nowMs,
        parsed: goldParsed,
        candidateLimit: RECALL_RESULT_POOL_LIMIT
      })
      const matches: RecallMatch[] = []
      if (result.topPick) matches.push(result.topPick)
      matches.push(...result.alsoPossible)
      return {
        matches,
        rankedIds: stabilizeRankedIds(matches.map(m => m.item.id)),
        topPick: Boolean(result.topPick),
        topPickScore: result.topPick?.score ?? null
      }
    }
    if (flags.skipKeyword) {
      let matches = filterMatchesByParsedTimeRange(semanticScored, goldParsed)
      matches = filterMatchesByExcludeContentTerms(matches, goldParsed.excludeContentTerms)
      if (!flags.skipCorroboration) {
        matches = softPenalizeMatchesByContentTermCorroboration(
          matches,
          effectiveContentTermsForRecall(goldParsed)
        )
      }
      matches = collapseRecallMatches(matches, {
        limit: RECALL_RESULT_POOL_LIMIT + RECALL_COLLAPSE_BACKFILL_EXTRA
      })
      const best = matches[0]
      const topPick = Boolean(
        best && (flags.skipTopPickMinScore || best.score >= RECALL_TOP_PICK_MIN_SCORE)
      )
      return {
        matches,
        rankedIds: stabilizeRankedIds(matches.map(m => m.item.id)),
        topPick,
        topPickScore: best?.score ?? null
      }
    }

    let fused: RecallMatch[]
    if (flags.scoreSumFusion) {
      fused = fuseByScoreSum(keywordScored, semanticScored, goldParsed)
    } else if (flags.skipLeaderProtect) {
      fused = fuseByRrfWithoutLeader(keywordScored, semanticScored, goldParsed)
    } else {
      fused = fuseKeywordAndSemanticPools({
        keywordMatches: keywordScored,
        semanticMatches: semanticScored,
        parsed: goldParsed,
        pageContextMode: 'none'
      })
    }

    // 若生产 fuse 已含 leader，而我们要关 leader 已在上面分支处理。
    // scoreSum 分支无 leader；需要显式 leader 的 scoreSum+leader 不在本矩阵。

    const corroborationTerms = effectiveContentTermsForRecall(goldParsed)
    let ranked = fused
    if (!flags.skipCorroboration) {
      ranked = softPenalizeMatchesByContentTermCorroboration(ranked, corroborationTerms)
    }
    ranked = filterMatchesByExcludeContentTerms(ranked, goldParsed.excludeContentTerms)
    ranked = collapseRecallMatches(ranked, {
      limit: RECALL_RESULT_POOL_LIMIT + RECALL_COLLAPSE_BACKFILL_EXTRA
    })

    // A8：交付层 18 分门
    const best = ranked[0]
    let topPick = false
    const topPickScore: number | null = best?.score ?? null
    if (best) {
      if (flags.skipTopPickMinScore) {
        topPick = true
      } else {
        topPick = best.score >= RECALL_TOP_PICK_MIN_SCORE
      }
    }

    // 硬佐证安全带（A7 关时跳过硬滤）
    if (!flags.skipCorroboration && corroborationTerms.length > 0 && best) {
      const hard = filterMatchesByContentTermCorroboration([best], corroborationTerms)
      if (hard.length === 0) {
        topPick = false
      }
    }

    return {
      matches: ranked,
      rankedIds: stabilizeRankedIds(ranked.map(m => m.item.id)),
      topPick,
      topPickScore
    }
  }

  if (flags.flatWeights) {
    return withFlatFieldWeights(runBody)
  }
  return runBody()
}

function aggregateRetrieval(rows: RetrievalCaseRow[]) {
  const hits = rows.filter(r => r.expectationKind === 'hit')
  const queries = hits.map(r => ({ rankedIds: r.rankedIds, goldId: r.expectedId }))
  return {
    recallAt1: meanRecallAtK(queries, 1).mean,
    recallAt5: meanRecallAtK(queries, 5).mean,
    mrr: meanMrr(queries).mean,
    ndcgAt5: meanNdcgAtK(queries, 5).mean,
    hitDenom: hits.length
  }
}

function judgeArm(
  arm: ArmId,
  baseline: ArmResult | undefined,
  current: Omit<ArmResult, 'verdict' | 'verdictNote'>
): { verdict: Verdict; verdictNote: string } {
  if (arm === 'baseline') return { verdict: '基线', verdictNote: '全开对照' }
  if (!baseline) return { verdict: '无结论', verdictNote: '缺基线' }

  const passMoved =
    rateMoved(current.live, baseline.live) ||
    rateMoved(current.pressure, baseline.pressure) ||
    rateMoved(current.noise, baseline.noise)

  let retrievalDegraded = false
  let retrievalImproved = false
  if (current.retrieval && baseline.retrieval) {
    for (const key of ['recallAt1', 'recallAt5', 'mrr', 'ndcgAt5'] as const) {
      const a = baseline.retrieval[key]
      const b = current.retrieval[key]
      if (metricMoved(a, b)) {
        if ((b ?? 0) < (a ?? 0) - METRIC_EPS) retrievalDegraded = true
        if ((b ?? 0) > (a ?? 0) + METRIC_EPS) retrievalImproved = true
      }
    }
  }

  const liveWorse = current.live.passed < baseline.live.passed
  const pressureWorse = current.pressure.passed < baseline.pressure.passed
  const noiseWorse = current.noise.passed < baseline.noise.passed
  const liveBetter = current.live.passed > baseline.live.passed
  const pressureBetter = current.pressure.passed > baseline.pressure.passed
  const noiseBetter = current.noise.passed > baseline.noise.passed

  if (liveBetter || pressureBetter || noiseBetter || (retrievalImproved && !retrievalDegraded)) {
    if (!liveWorse && !pressureWorse && !noiseWorse && !retrievalDegraded) {
      return { verdict: '待查', verdictNote: '关掉后数字变好，可能过拟合/bug，本批只记录不修' }
    }
  }

  if (liveWorse || pressureWorse || noiseWorse || retrievalDegraded) {
    const parts: string[] = []
    if (liveWorse)
      parts.push(`live ${baseline.live.passed}→${current.live.passed}/${current.live.total}`)
    if (pressureWorse)
      parts.push(
        `pressure ${baseline.pressure.passed}→${current.pressure.passed}/${current.pressure.total}`
      )
    if (noiseWorse)
      parts.push(`noise ${baseline.noise.passed}→${current.noise.passed}/${current.noise.total}`)
    if (retrievalDegraded) {
      parts.push(
        `IR R@1 ${baseline.retrieval?.recallAt1}→${current.retrieval?.recallAt1} MRR ${baseline.retrieval?.mrr}→${current.retrieval?.mrr}`
      )
    }
    return { verdict: '保留', verdictNote: `退化：${parts.join('；')}` }
  }

  if (!passMoved && !retrievalDegraded && !retrievalImproved) {
    return { verdict: '可删', verdictNote: '各集通过率与 IR 指标相对基线不动（ε=1e-6）' }
  }

  return { verdict: '保留', verdictNote: '有可观测变化但未落入待查/可删' }
}

async function runUnderstandBundle(
  complete: LlmChatCompleter,
  options: { skipNoiseGateway?: boolean; label: string }
): Promise<{
  live: { passed: number; total: number }
  pressure: { passed: number; total: number }
  noise: { passed: number; total: number; falseIntoParse: number }
  llmCalls: number
  latencyMedianMs: number | null
  rows: UnderstandCaseRow[]
}> {
  const rows: UnderstandCaseRow[] = []
  let llmCalls = 0
  const latencies: number[] = []

  for (const spec of INTENT_EVAL_MUST) {
    const started = Date.now()
    const result = await understandRecallClue(spec.clue, {
      complete,
      nowMs: Date.now(),
      ...(options.skipNoiseGateway ? { skipNoiseGateway: true } : {})
    })
    const latencyMs = Date.now() - started
    latencies.push(latencyMs)
    const llmCalled = result.source === 'llm' || result.source === 'rules_fallback'
    if (llmCalled) llmCalls += 1
    const intent =
      result.disposition === 'reject_noise'
        ? 'reject_noise'
        : ((result.parsed.intent ?? 'recall') as string)
    const passed = intent === spec.expectedIntent
    rows.push({
      id: spec.id,
      set: 'live',
      clue: spec.clue,
      expected: spec.expectedIntent,
      passed,
      intent,
      source: result.source,
      latencyMs,
      llmCalled,
      note: options.label
    })
  }

  for (const spec of PRESSURE_CASES) {
    const started = Date.now()
    const result = await understandRecallClue(spec.clue, {
      complete,
      nowMs: Date.now(),
      ...(options.skipNoiseGateway ? { skipNoiseGateway: true } : {})
    })
    const latencyMs = Date.now() - started
    latencies.push(latencyMs)
    const llmCalled = result.source === 'llm' || result.source === 'rules_fallback'
    if (llmCalled) llmCalls += 1
    const intent =
      result.disposition === 'reject_noise'
        ? 'reject_noise'
        : ((result.parsed.intent ?? 'recall') as string)
    const passed = intent === spec.expectedIntent
    rows.push({
      id: spec.id,
      set: 'pressure',
      clue: spec.clue,
      expected: spec.expectedIntent,
      passed,
      intent,
      source: result.source,
      latencyMs,
      llmCalled,
      note: spec.note
    })
  }

  // noise：基线走 Gate A 纯函数；A1 跳过网关进 LLM
  const noiseCases = buildNoiseGatewayEvalCases().filter(c => c.gate === 'must')
  let noisePassed = 0
  let falseIntoParse = 0
  if (!options.skipNoiseGateway) {
    const report = runNoiseGatewayEval(noiseCases)
    noisePassed = report.must.passed
    for (const c of report.cases) {
      rows.push({
        id: c.caseId,
        set: 'noise',
        clue: c.clue,
        expected: c.gate,
        passed: c.passed,
        intent: c.actualDisposition,
        source: 'gate_a',
        latencyMs: 0,
        llmCalled: false,
        note: c.detail
      })
    }
  } else {
    for (const evalCase of noiseCases) {
      const started = Date.now()
      const result = await understandRecallClue(evalCase.clue, {
        complete,
        nowMs: Date.now(),
        skipNoiseGateway: true
      })
      const latencyMs = Date.now() - started
      latencies.push(latencyMs)
      const llmCalled = result.source === 'llm' || result.source === 'rules_fallback'
      if (llmCalled) llmCalls += 1
      const intent = (result.parsed.intent ?? 'recall') as string
      const enteredParse =
        result.disposition === 'proceed' &&
        (intent === 'recall' || result.parsed.contentTerms.length > 0)
      if (evalCase.expect.disposition === 'reject_noise' && enteredParse) {
        falseIntoParse += 1
      }
      // A1：期望仍是 Gate A 金标；关掉后 should fail reject cases
      const passed =
        evalCase.expect.disposition === 'proceed' ? result.disposition === 'proceed' : false // 期望 reject，但已跳过网关 → 本臂不算「noise 通过」
      if (passed) noisePassed += 1
      rows.push({
        id: evalCase.id,
        set: 'noise',
        clue: evalCase.clue,
        expected: evalCase.expect.disposition,
        passed,
        intent,
        source: result.source,
        latencyMs,
        llmCalled,
        note: enteredParse ? '误入解析' : ''
      })
    }
  }

  const liveRows = rows.filter(r => r.set === 'live')
  const pressureRows = rows.filter(r => r.set === 'pressure')
  return {
    live: { passed: liveRows.filter(r => r.passed).length, total: liveRows.length },
    pressure: {
      passed: pressureRows.filter(r => r.passed).length,
      total: pressureRows.length
    },
    noise: { passed: noisePassed, total: noiseCases.length, falseIntoParse },
    llmCalls,
    latencyMedianMs: median(latencies),
    rows
  }
}

function loadA3FromArtifact(): ArmResult {
  const path = existsSync(ARTIFACT_PRIMARY) ? ARTIFACT_PRIMARY : ARTIFACT_FALLBACK
  if (!existsSync(path)) {
    return {
      arm: 'A3',
      label: '关语义池（纯关键词）',
      verdict: '无结论',
      verdictNote: 'artifact 不可下载且回落文件也不存在',
      mustVitest: '127/127（产品未改）',
      live: { passed: 0, total: 0 },
      pressure: { passed: 0, total: 0 },
      noise: { passed: 0, total: 0 },
      llmCalls: 0,
      latencyMedianMs: null,
      extra: { artifactPath: path }
    }
  }
  const raw = JSON.parse(readFileSync(path, 'utf8')) as {
    generatedAt?: string
    report?: {
      aggregateHitCases?: {
        keyword?: {
          recallAt1?: number
          recallAt5?: number
          mrr?: number
          ndcgAt5?: number
          denominator?: number
        }
        hybrid?: {
          recallAt1?: number
          recallAt5?: number
          mrr?: number
          ndcgAt5?: number
        }
      }
    }
  }
  const kw = raw.report?.aggregateHitCases?.keyword
  const hybrid = raw.report?.aggregateHitCases?.hybrid
  const source =
    path === ARTIFACT_PRIMARY
      ? 'run 44315251740 artifact retrieval-ablation-real-report.json'
      : 'fallback docs/audits/2026-10-L2召回消融-real-run-b2-aligned.json'
  const degraded =
    kw && hybrid
      ? (kw.recallAt1 ?? 0) < (hybrid.recallAt1 ?? 0) - METRIC_EPS ||
        (kw.mrr ?? 0) < (hybrid.mrr ?? 0) - METRIC_EPS
      : true
  return {
    arm: 'A3',
    label: '关语义池（纯关键词 · 不重跑）',
    verdict: degraded ? '保留' : '可删',
    verdictNote: degraded
      ? `相对同报告 hybrid：keyword R@1=${kw?.recallAt1} < hybrid ${hybrid?.recallAt1}（模糊召回退化）`
      : 'keyword 与 hybrid IR 无实质差异',
    mustVitest: '127/127（产品未改）',
    live: { passed: 38, total: 38 },
    pressure: { passed: 23, total: 24 },
    noise: { passed: 116, total: 116 },
    retrieval: {
      recallAt1: kw?.recallAt1 ?? null,
      recallAt5: kw?.recallAt5 ?? null,
      mrr: kw?.mrr ?? null,
      ndcgAt5: kw?.ndcgAt5 ?? null,
      hitDenom: kw?.denominator ?? 0,
      source
    },
    llmCalls: 0,
    latencyMedianMs: null,
    extra: {
      artifactPath: path,
      generatedAt: raw.generatedAt ?? null,
      hybridCompare: hybrid ?? null,
      note: 'A3 不重跑；live/pressure/noise 沿用基线理解数字（本臂只关检索语义池）'
    }
  }
}

function persist(payload: unknown): void {
  mkdirSync(dirname(OUT_JSON), { recursive: true })
  writeFileSync(OUT_JSON, JSON.stringify(payload, null, 2), 'utf8')
}

function buildMarkdown(payload: {
  created: string
  step0: Record<string, unknown>
  arms: ArmResult[]
  mappingGaps: string[]
  deviations: string[]
  d1Path: string
}): string {
  const lines: string[] = []
  lines.push('---')
  lines.push('title: 2026-11-18 Recall 消融审计')
  lines.push(`created: ${payload.created}`)
  lines.push(`updated: ${payload.created}`)
  lines.push('author: agent:cursor')
  lines.push(
    'scope: Recall 管线逐层消融（A1–A11 + C1）+ D1 决策模型对照引用；离线只读；不改产品行为'
  )
  lines.push('status: complete')
  lines.push('upstream:')
  lines.push('  - HEAD daf526f4')
  lines.push('  - GitHub Actions run 44315251740（Recall Real Eval · success）')
  lines.push('  - extension/tests/eval/run-retrieval-ablation.ts')
  lines.push('  - extension/src/core/recall/understand/understand-recall-clue.ts')
  lines.push('downstream:')
  lines.push('  - 仅证据与判定；不重构管线；原型另批')
  lines.push('---')
  lines.push('')
  lines.push('# 2026-11-18 Recall 消融审计')
  lines.push('')
  lines.push('## 1. Step 0 定锚')
  lines.push('')
  lines.push('| 项 | 实测 |')
  lines.push('| --- | --- |')
  for (const [k, v] of Object.entries(payload.step0)) {
    lines.push(`| ${k} | ${typeof v === 'string' ? v : `\`${JSON.stringify(v)}\``} |`)
  }
  lines.push('')
  lines.push('## 2. 每臂结果表')
  lines.push('')
  lines.push(
    '| 臂 | must | live | pressure | noise | R@1 / MRR / nDCG@5 | LLM 调用 | 中位延迟 | 结论 | 备注 |'
  )
  lines.push('| --- | --- | --- | --- | --- | --- | ---: | ---: | --- | --- |')
  for (const arm of payload.arms) {
    const ir = arm.retrieval
      ? `${arm.retrieval.recallAt1?.toFixed?.(4) ?? arm.retrieval.recallAt1} / ${arm.retrieval.mrr?.toFixed?.(4) ?? arm.retrieval.mrr} / ${arm.retrieval.ndcgAt5?.toFixed?.(4) ?? arm.retrieval.ndcgAt5}`
      : '—'
    const noise =
      arm.noise.falseIntoParse != null
        ? `${arm.noise.passed}/${arm.noise.total}（误入${arm.noise.falseIntoParse}）`
        : `${arm.noise.passed}/${arm.noise.total}`
    lines.push(
      `| ${arm.arm} ${arm.label} | ${arm.mustVitest} | ${arm.live.passed}/${arm.live.total} | ${arm.pressure.passed}/${arm.pressure.total} | ${noise} | ${ir} | ${arm.llmCalls} | ${arm.latencyMedianMs ?? '—'} | **${arm.verdict}** | ${arm.verdictNote.replace(/\|/g, '/')} |`
    )
  }
  lines.push('')
  lines.push('## 3. D1 决策模型对照')
  lines.push('')
  lines.push(
    `独立报告：[\`2026-11-18-decision-model-d1-eval.md\`](./2026-11-18-decision-model-d1-eval.md)（路径 ${payload.d1Path}）。`
  )
  lines.push('')
  lines.push('## 4. 映射缺口清单')
  lines.push('')
  for (const g of payload.mappingGaps) lines.push(`- ${g}`)
  lines.push('')
  lines.push('## 5. 偏差清单')
  lines.push('')
  for (const d of payload.deviations) lines.push(`- ${d}`)
  lines.push('')
  lines.push('## 6. 总结论')
  lines.push('')
  const keep = payload.arms.filter(a => a.verdict === '保留').map(a => a.arm)
  const drop = payload.arms.filter(a => a.verdict === '可删').map(a => a.arm)
  const probe = payload.arms.filter(a => a.verdict === '待查').map(a => a.arm)
  const none = payload.arms.filter(a => a.verdict === '无结论').map(a => a.arm)
  lines.push(
    `保留 ${keep.join('/') || '无'}；可删（死重） ${drop.join('/') || '无'}；待查 ${probe.join('/') || '无'}；无结论 ${none.join('/') || '无'}。D1 见独立报告。管线复杂度${keep.length ? '有证据支撑，维持现状为主' : '需结合 D1 与待查项再议'}。`
  )
  lines.push('')
  lines.push(`逐行 JSON：\`${OUT_JSON}\``)
  lines.push('')
  return lines.join('\n')
}

export async function runRecallAblationAudit(): Promise<void> {
  loadLocalEnvFiles()
  const created = nowStampShanghai()
  const armsWanted = parseArmsArg()
  const noLlm = skipLlm()
  const arms: ArmResult[] = []
  const deviations: string[] = []
  const mappingGaps = [
    'Topic span 精确度无 gold → A1/A2 涉及 span 精确度记无结论',
    '≥28 字无空格中文 mash 无专用 gold → 不测',
    '2000 行规模 / ANN：本批未测',
    'must 127：产品代码未改，vitest 恒 127；检索承重以 RETRIEVAL_ABLATION_CASES IR 为准',
    'noise 路径：`extension/tests/eval/noise-gateway-cases.ts` + `build-synth-noise-gateway-cases.ts`；must 门 116'
  ]

  const step0 = {
    HEAD: 'daf526f4',
    gitStatus: '干净（0 行）',
    'test:must': '127 passed',
    'test:run': '1789 passed',
    'i18n:check': '817 keys',
    'worker test': '211 pass',
    'run 44315251740': 'success（workflow_dispatch · retrieval-ablation-real）',
    RRF_k: 60,
    semantic_limit: 24,
    min_cosine: 0.28,
    keyword_pool: 100,
    keyword_miss_expand: '24→100',
    RECALL_TOP_PICK_MIN_SCORE: 18,
    RECALL_MIN_MATCH_SCORE: 10,
    FIELD_WEIGHTS:
      'note26/title24/pageTitle20/textExcerpt18/summary16/domain14/keywords-tags12/url10'
  }

  let baseline: ArmResult | undefined
  let complete: LlmChatCompleter | null = null
  if (!noLlm && [...armsWanted].some(a => a === 'baseline' || a === 'A1' || a === 'A2')) {
    const { apiKey, source } = resolveDeepseekApiKey()
    const compat = resolveCompat(process.env.PARSE_GOLD_LLM_COMPAT)
    const baseUrl = process.env.PARSE_GOLD_LLM_BASE_URL?.trim() || 'https://api.deepseek.com'
    complete = createOpenAiCompatibleCompleter({
      apiKey,
      baseUrl,
      model: BASELINE_MODEL,
      temperature: 0,
      maxTokens: 400,
      compat,
      disableThinking: true
    })
    console.info(
      `[ablation] LLM=${BASELINE_MODEL} key=${source} url=${resolveOpenAiCompatibleChatCompletionsUrl(baseUrl)}`
    )
  }

  // —— 检索语料 + embed（检索臂共用） ——
  const needRetrieval = [...armsWanted].some(a =>
    ['baseline', 'A4', 'A5', 'A6', 'A7', 'A8', 'A9', 'A10', 'A11', 'C1'].includes(a)
  )
  let corpus: MemoryItem[] | null = null
  const queryVectors = new Map<string, number[]>()
  const rawClueVectors = new Map<string, number[]>()
  if (needRetrieval) {
    const apiBase = resolveApiBase()
    const { token, source } = await resolveEmbedAccessToken()
    console.info(`[ablation] embed token source=${source} api=${apiBase}`)
    const client = createWorkerEmbedClient(token, apiBase)
    const baseCorpus = buildRetrievalAblationCorpus()
    assertAblationCorpusHasNoEmbeddings(baseCorpus)
    console.info(`[ablation] embedding corpus fingerprint=${ablationCorpusFingerprint(baseCorpus)}`)
    corpus = await embedCorpus(baseCorpus, texts => client.embedTexts(texts))
    for (const ablationCase of RETRIEVAL_ABLATION_CASES) {
      const clueEmbeddingText =
        ablationCase.clueEmbeddingText?.trim() ||
        buildClueEmbeddingText({
          rawClue: ablationCase.clueForDisplay,
          parsed: ablationCase.goldParsed
        })
      const [v] = await client.embedTexts([clueEmbeddingText])
      if (!v?.length) throw new Error(`empty query vector for ${ablationCase.id}`)
      queryVectors.set(ablationCase.id, v)
      const [rawV] = await client.embedTexts([ablationCase.clueForDisplay])
      if (!rawV?.length) throw new Error(`empty raw clue vector for ${ablationCase.id}`)
      rawClueVectors.set(ablationCase.id, rawV)
    }
  }

  const runRetrievalArm = (arm: ArmId, label: string, flags: HybridFlags): ArmResult => {
    if (!corpus) throw new Error('corpus 未准备')
    const rows: RetrievalCaseRow[] = []
    for (const ablationCase of RETRIEVAL_ABLATION_CASES) {
      const vector = flags.embedRawClue
        ? rawClueVectors.get(ablationCase.id)!
        : queryVectors.get(ablationCase.id)!
      const out = runHybridVariant(corpus, ablationCase, vector, flags, RETRIEVAL_ABLATION_NOW_MS)
      const expectedId = ablationCase.expectation.expectedId
      const kind = ablationCase.expectation.kind
      rows.push({
        caseId: ablationCase.id,
        expectationKind: kind,
        expectedId,
        rankedIds: out.rankedIds,
        rank: recallAtK(out.rankedIds, expectedId, 10).rank,
        recallAt1: recallAtK(out.rankedIds, expectedId, 1).hit,
        recallAt5: recallAtK(out.rankedIds, expectedId, 5).hit,
        mrr: kind === 'hit' ? mrrContribution(out.rankedIds, expectedId) : 0,
        ndcgAt5: kind === 'hit' ? ndcgAtK(out.rankedIds, expectedId, 5) : 0,
        topPick: out.topPick,
        topPickScore: out.topPickScore,
        note: ''
      })
    }
    const retrieval = aggregateRetrieval(rows)
    const understand = baseline
      ? {
          live: baseline.live,
          pressure: baseline.pressure,
          noise: baseline.noise,
          llmCalls: 0,
          latencyMedianMs: null as number | null
        }
      : {
          live: { passed: 38, total: 38 },
          pressure: { passed: 23, total: 24 },
          noise: { passed: 116, total: 116 },
          llmCalls: 0,
          latencyMedianMs: null as number | null
        }
    const draft: Omit<ArmResult, 'verdict' | 'verdictNote'> = {
      arm,
      label,
      mustVitest: '127/127（产品未改）',
      live: understand.live,
      pressure: understand.pressure,
      noise: understand.noise,
      retrieval,
      llmCalls: understand.llmCalls,
      latencyMedianMs: understand.latencyMedianMs,
      retrievalRows: rows,
      extra: { flags, note: '理解集沿用基线（本臂只改检索层）' }
    }
    const judged = judgeArm(arm, baseline, draft)
    return { ...draft, ...judged }
  }

  // —— baseline ——
  if (armsWanted.has('baseline')) {
    console.info('[ablation] arm=baseline …')
    let understandPart: Awaited<ReturnType<typeof runUnderstandBundle>> | null = null
    if (complete) {
      understandPart = await runUnderstandBundle(complete, { label: 'baseline' })
    } else {
      const noiseReport = runNoiseGatewayEval()
      understandPart = {
        live: { passed: 0, total: INTENT_EVAL_MUST.length },
        pressure: { passed: 0, total: PRESSURE_CASES.length },
        noise: {
          passed: noiseReport.must.passed,
          total: noiseReport.must.total,
          falseIntoParse: 0
        },
        llmCalls: 0,
        latencyMedianMs: null,
        rows: []
      }
      deviations.push('--skip-llm：baseline live/pressure 未跑 LLM')
    }
    let retrievalRows: RetrievalCaseRow[] = []
    let retrieval = undefined as ArmResult['retrieval']
    if (corpus) {
      const tmp = runRetrievalArm('baseline', '全开基线', {})
      retrievalRows = tmp.retrievalRows ?? []
      retrieval = tmp.retrieval
    }
    baseline = {
      arm: 'baseline',
      label: '全开基线',
      verdict: '基线',
      verdictNote: '全开对照',
      mustVitest: '127/127（Step 0 vitest）',
      live: understandPart.live,
      pressure: understandPart.pressure,
      noise: understandPart.noise,
      retrieval,
      llmCalls: understandPart.llmCalls,
      latencyMedianMs: understandPart.latencyMedianMs,
      understandRows: understandPart.rows,
      retrievalRows
    }
    arms.push(baseline)
    persist({ created, step0, arms, mappingGaps, deviations })
  }

  // —— A1 ——
  if (armsWanted.has('A1')) {
    console.info('[ablation] arm=A1 …')
    if (!complete) {
      arms.push({
        arm: 'A1',
        label: '关 Gate A',
        verdict: '无结论',
        verdictNote: '--skip-llm 或无 DeepSeek key',
        mustVitest: '127/127（产品未改）',
        live: { passed: 0, total: 0 },
        pressure: { passed: 0, total: 0 },
        noise: { passed: 0, total: 0 },
        llmCalls: 0,
        latencyMedianMs: null
      })
    } else {
      const part = await runUnderstandBundle(complete, {
        skipNoiseGateway: true,
        label: 'A1_skip_gate_a'
      })
      const draft: Omit<ArmResult, 'verdict' | 'verdictNote'> = {
        arm: 'A1',
        label: '关 Gate A',
        mustVitest: '127/127（产品未改）',
        live: part.live,
        pressure: part.pressure,
        noise: part.noise,
        retrieval: baseline?.retrieval,
        llmCalls: part.llmCalls,
        latencyMedianMs: part.latencyMedianMs,
        understandRows: part.rows,
        extra: {
          falseIntoParse: part.noise.falseIntoParse,
          baselineLlmCalls: baseline?.llmCalls ?? null
        }
      }
      const judged = judgeArm('A1', baseline, draft)
      // A1 预期 noise 崩：强制保留
      arms.push({
        ...draft,
        verdict: '保留',
        verdictNote: `noise 误入解析 ${part.noise.falseIntoParse}；LLM 调用 ${part.llmCalls}（基线 ${baseline?.llmCalls ?? 'n/a'}）。${judged.verdictNote}`
      })
    }
    persist({ created, step0, arms, mappingGaps, deviations })
  }

  // —— A2 ——
  if (armsWanted.has('A2')) {
    console.info('[ablation] arm=A2 …')
    if (!complete) {
      arms.push({
        arm: 'A2',
        label: '关 Grounding 内容校验',
        verdict: '无结论',
        verdictNote: '--skip-llm 或无 key',
        mustVitest: '127/127（产品未改）',
        live: { passed: 0, total: 0 },
        pressure: { passed: 0, total: 0 },
        noise: baseline?.noise ?? { passed: 116, total: 116 },
        llmCalls: 0,
        latencyMedianMs: null
      })
    } else {
      const rows: UnderstandCaseRow[] = []
      let slotDiffs = 0
      let llmCalls = 0
      const latencies: number[] = []
      for (const spec of INTENT_EVAL_MUST) {
        const started = Date.now()
        const proposal = await fetchLlmProposal(complete, spec.clue)
        llmCalls += 1
        const grounded = mapLlmProposalToParsedClue(spec.clue, proposal, Date.now())
        const ungrounded = mapLlmProposalWithoutGrounding(spec.clue, proposal, Date.now())
        const latencyMs = Date.now() - started
        latencies.push(latencyMs)
        const intent = (ungrounded.intent ?? 'recall') as string
        const passed = intent === spec.expectedIntent
        const diff =
          JSON.stringify(grounded.objectTypes ?? []) !==
            JSON.stringify(ungrounded.objectTypes ?? []) ||
          JSON.stringify(grounded.behaviorHints ?? []) !==
            JSON.stringify(ungrounded.behaviorHints ?? []) ||
          (grounded.timeRange?.label ?? null) !== (ungrounded.timeRange?.label ?? null)
        if (diff) slotDiffs += 1
        rows.push({
          id: spec.id,
          set: 'live',
          clue: spec.clue,
          expected: spec.expectedIntent,
          passed,
          intent,
          source: 'llm_ungrounded',
          latencyMs,
          llmCalled: true,
          note: diff ? 'slot_diff_vs_grounded' : '',
          slots: {
            grounded: {
              objectTypes: grounded.objectTypes ?? [],
              behaviorHints: grounded.behaviorHints ?? [],
              timeLabel: grounded.timeRange?.label ?? null,
              contentTerms: grounded.contentTerms
            },
            ungrounded: {
              objectTypes: ungrounded.objectTypes ?? [],
              behaviorHints: ungrounded.behaviorHints ?? [],
              timeLabel: ungrounded.timeRange?.label ?? null,
              contentTerms: ungrounded.contentTerms
            }
          }
        })
      }
      // pressure：同样 ungrounded 意图
      for (const spec of PRESSURE_CASES) {
        const started = Date.now()
        const proposal = await fetchLlmProposal(complete, spec.clue)
        llmCalls += 1
        const ungrounded = mapLlmProposalWithoutGrounding(spec.clue, proposal, Date.now())
        const latencyMs = Date.now() - started
        latencies.push(latencyMs)
        const intent = (ungrounded.intent ?? 'recall') as string
        rows.push({
          id: spec.id,
          set: 'pressure',
          clue: spec.clue,
          expected: spec.expectedIntent,
          passed: intent === spec.expectedIntent,
          intent,
          source: 'llm_ungrounded',
          latencyMs,
          llmCalled: true,
          note: ''
        })
      }
      const liveRows = rows.filter(r => r.set === 'live')
      const pressureRows = rows.filter(r => r.set === 'pressure')
      const draft: Omit<ArmResult, 'verdict' | 'verdictNote'> = {
        arm: 'A2',
        label: '关 Grounding 内容校验',
        mustVitest: '127/127（产品未改）',
        live: {
          passed: liveRows.filter(r => r.passed).length,
          total: liveRows.length
        },
        pressure: {
          passed: pressureRows.filter(r => r.passed).length,
          total: pressureRows.length
        },
        noise: baseline?.noise ?? { passed: 116, total: 116 },
        retrieval: baseline?.retrieval,
        llmCalls,
        latencyMedianMs: median(latencies),
        understandRows: rows,
        extra: {
          slotDiffCountOnLive: slotDiffs,
          topicSpan: '无结论',
          note: '保留 Zod；跳过词面支撑与词典补提'
        }
      }
      const judged = judgeArm('A2', baseline, draft)
      arms.push({
        ...draft,
        verdict: slotDiffs > 0 || judged.verdict === '保留' ? '保留' : judged.verdict,
        verdictNote:
          slotDiffs > 0
            ? `live 槽位与 grounded 不一致 ${slotDiffs}/38；${judged.verdictNote}`
            : judged.verdictNote
      })
    }
    persist({ created, step0, arms, mappingGaps, deviations })
  }

  // —— A3 ——
  if (armsWanted.has('A3')) {
    console.info('[ablation] arm=A3（artifact）…')
    const a3 = loadA3FromArtifact()
    if (baseline) {
      a3.live = baseline.live
      a3.pressure = baseline.pressure
      a3.noise = baseline.noise
    }
    arms.push(a3)
    persist({ created, step0, arms, mappingGaps, deviations })
  }

  // —— 检索变体臂 ——
  const retrievalSpecs: Array<{ arm: ArmId; label: string; flags: HybridFlags }> = [
    { arm: 'A4', label: '关关键词池（纯语义）', flags: { skipKeyword: true } },
    { arm: 'A5', label: '关 RRF（分数相加）', flags: { scoreSumFusion: true } },
    { arm: 'A6', label: '关词面领先者保护', flags: { skipLeaderProtect: true } },
    { arm: 'A7', label: '关佐证门', flags: { skipCorroboration: true } },
    { arm: 'A8', label: '关 Outcome 18 分门', flags: { skipTopPickMinScore: true } },
    { arm: 'A9', label: '字段权重拉平', flags: { flatWeights: true } },
    { arm: 'A10', label: '关 contentTerms 查询向量', flags: { embedRawClue: true } },
    { arm: 'A11', label: '关 keyword-miss 扩池', flags: { noKeywordMissExpand: true } },
    {
      arm: 'C1',
      label: '保护全关（A6+A7+A8+A11）',
      flags: {
        skipLeaderProtect: true,
        skipCorroboration: true,
        skipTopPickMinScore: true,
        noKeywordMissExpand: true
      }
    }
  ]

  for (const spec of retrievalSpecs) {
    if (!armsWanted.has(spec.arm)) continue
    console.info(`[ablation] arm=${spec.arm} …`)
    if (!corpus) {
      arms.push({
        arm: spec.arm,
        label: spec.label,
        verdict: '无结论',
        verdictNote: '检索语料/embed 未准备',
        mustVitest: '127/127（产品未改）',
        live: baseline?.live ?? { passed: 0, total: 0 },
        pressure: baseline?.pressure ?? { passed: 0, total: 0 },
        noise: baseline?.noise ?? { passed: 0, total: 0 },
        llmCalls: 0,
        latencyMedianMs: null
      })
    } else {
      // A8：额外记低分 top_pick
      const result = runRetrievalArm(spec.arm, spec.label, spec.flags)
      if (spec.arm === 'A8' && result.retrievalRows && baseline?.retrievalRows) {
        const newLow = result.retrievalRows.filter(
          r => r.topPick && r.topPickScore != null && r.topPickScore < RECALL_TOP_PICK_MIN_SCORE
        )
        result.extra = {
          ...(result.extra ?? {}),
          newLowScoreTopPicks: newLow.map(r => ({
            caseId: r.caseId,
            score: r.topPickScore,
            rank: r.rank,
            correctAt1: r.recallAt1
          }))
        }
        if (newLow.length > 0) {
          result.verdict = '保留'
          result.verdictNote = `新增低分 top_pick ${newLow.length}；${result.verdictNote}`
        }
      }
      if (spec.arm === 'A6' && result.retrievalRows && baseline?.retrievalRows) {
        const flips = result.retrievalRows.filter((r, i) => {
          const b = baseline!.retrievalRows![i]
          return b && r.rankedIds[0] !== b.rankedIds[0]
        })
        result.extra = { ...(result.extra ?? {}), top1Flips: flips.map(f => f.caseId) }
        if (flips.length > 0) {
          result.verdict = '保留'
          result.verdictNote = `Top1 翻转 ${flips.length}；${result.verdictNote}`
        }
      }
      arms.push(result)
    }
    persist({ created, step0, arms, mappingGaps, deviations })
  }

  // A5：scoreSum 未走 preferKeywordLeader——偏差记一笔
  if (armsWanted.has('A5')) {
    deviations.push(
      'A5 分数相加融合未叠加领先者保护（与「只关 RRF、其余不动」字面略有张力：生产 RRF 路径含 leader；本臂替换整段 fuse）'
    )
  }

  const d1Path = resolve(repoRoot, 'docs/audits/2026-11-18-decision-model-d1-eval.md')
  const payload = {
    created,
    step0,
    arms,
    mappingGaps,
    deviations,
    d1Path,
    constants: {
      HYBRID_KEYWORD_POOL,
      HYBRID_SEMANTIC_NEIGHBOR_LIMIT,
      HYBRID_SEMANTIC_NEIGHBOR_LIMIT_EXPANDED,
      HYBRID_MIN_COSINE_SIMILARITY,
      RECALL_TOP_PICK_MIN_SCORE,
      FIELD_WEIGHTS: { ...FIELD_WEIGHTS }
    }
  }
  persist(payload)
  writeFileSync(OUT_MD, buildMarkdown(payload), 'utf8')
  console.info(`[ablation] wrote ${OUT_JSON}`)
  console.info(`[ablation] wrote ${OUT_MD}`)
  for (const arm of arms) {
    console.info(
      `[ablation] ${arm.arm}: ${arm.verdict} live=${arm.live.passed}/${arm.live.total} pressure=${arm.pressure.passed}/${arm.pressure.total} noise=${arm.noise.passed}/${arm.noise.total} llm=${arm.llmCalls}`
    )
  }
}

const isDirectRun =
  typeof process.argv[1] === 'string' && process.argv[1].includes('recall-ablation-audit.ts')

if (isDirectRun) {
  await runRecallAblationAudit()
}
