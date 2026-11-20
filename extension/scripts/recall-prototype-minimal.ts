/**
 * 最小 LLM 原生原型（P1）+ 解析模型对照组（P2）。
 *
 * 管线：clue → 解析(1) → bge-m3 Top50 → 重排(1) → Top5+理由
 * 无 Gate A / grounding / 关键词 / RRF / 保护层。
 *
 * 用法：
 *   cd extension && bun run scripts/recall-prototype-minimal.mjs
 *   cd extension && bun run scripts/recall-prototype-minimal.mjs -- --legs=p1
 *   cd extension && bun run scripts/recall-prototype-minimal.mjs -- --legs=p1,qwen4-max
 *
 * 环境（只从仓库根 / extension 的 .env*.local 加载）：
 *   DEEPSEEK_API_KEY | PARSE_GOLD_LLM_API_KEY（P1 解析+重排）
 *   DASHSCOPE_API_KEY（P2 qwen4-max）
 *   OPENAI_API_KEY（P2 gpt-6.2-sol 原生；缺则试 OPENROUTER_API_KEY 适配）
 *   腾讯 Hy4：本机无对应 key → 跳过
 *   SUPABASE_* 或 RETRIEVAL_ABLATION_ACCESS_TOKEN（真实 BGE）
 *   RETRIEVAL_ABLATION_API_BASE（默认 https://api.yiveno.com）
 *
 * 输出：
 *   docs/audits/2026-11-19-recall-prototype-minimal.md
 *   docs/audits/2026-11-19-recall-prototype-minimal.json
 *
 * 硬规则：不改产品文件；禁止 fake embedding；密钥不入库。
 */

import { createClient } from '@supabase/supabase-js'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { buildEmbeddingTextFromMemoryItem } from '../src/core/memory/build-embedding-text'
import type { MemoryItem } from '../src/core/memory/memory-item'
import { buildClueEmbeddingText } from '../src/core/recall/build-clue-embedding-text'
import { PRESSURE_CASES } from '../src/core/recall/eval/arbitrary-input-pressure-cases'
import { INTENT_EVAL_MUST } from '../src/core/recall/eval/intent-eval-cases'
import {
  meanMrr,
  meanNdcgAtK,
  meanRecallAtK,
  mrrContribution,
  ndcgAtK,
  recallAtK,
  stabilizeRankedIds
} from '../src/core/recall/eval/metrics'
import { RETRIEVAL_ABLATION_CASES } from '../src/core/recall/eval/retrieval-ablation-cases'
import {
  ablationCorpusFingerprint,
  assertAblationCorpusHasNoEmbeddings,
  buildRetrievalAblationCorpus
} from '../src/core/recall/eval/retrieval-ablation-corpus'
import { WORKER_EMBEDDING_MODEL_HINT } from '../src/core/recall/eval/retrieval-ablation-fusion-constants'
import { buildNoiseGatewayEvalCases } from '../src/core/recall/eval/run-noise-gateway-eval'
import { cosineSimilarity } from '../src/core/recall/hybrid-fusion'
import { extractContentTerms } from '../src/core/recall/parse-recall-clue'
import { parseJsonObjectFromLlmText } from '../src/core/recall/understand/extract-llm-json'
import {
  resolveOpenAiCompatibleChatCompletionsUrl,
  type OpenAiCompatibleChatCompat
} from '../src/core/recall/understand/openai-compatible-chat'
import { parseLlmChatUsage } from '../src/core/recall/understand/llm-chat-usage'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(scriptDir, '../..')
const OUT_JSON = resolve(repoRoot, 'docs/audits/2026-11-19-recall-prototype-minimal.json')
const OUT_MD = resolve(repoRoot, 'docs/audits/2026-11-19-recall-prototype-minimal.md')
const ABLATION_JSON = resolve(repoRoot, 'docs/audits/2026-11-18-recall-ablation-audit.json')
const DEFAULT_EVAL_EMAIL = 'retrieval-ablation-local@yiveno.dev'

const RERANK_MODEL = 'deepseek-v4-flash'
const PARSE_PROMPT_VERSION = 'prototype-minimal-v1'
const TOP_K_SEMANTIC = 50
const TOP_K_RERANK = 5
const TITLE_CLIP = 120
const EXCERPT_CLIP = 280
const PARSE_TIMEOUT_MS = 30_000
const RERANK_TIMEOUT_MS = 90_000
const METRIC_EPS = 1e-6

/** P1 解析 prompt（以产品 buildLlmParseClueMessages 为底，只保留 intent + contentTerms）。 */
export const PROTOTYPE_PARSE_SYSTEM_PROMPT = [
  'You convert a user recall clue into a JSON object for a personal memory finder.',
  'Output ONLY one JSON object. No markdown, no commentary.',
  'Schema keys (ONLY these two):',
  '- intent: recall|chitchat|question|instruction. recall = the user is trying to find something they saved, even vaguely (a time, a type, a topic, a feeling about something saved) — including questions ABOUT a saved item (e.g. "when did I save that article", "你是什么时候保存的那篇文章"). chitchat = the user is greeting, small-talking, commenting, OR asking who/what Yiveno is or what it can do (e.g. "good evening", "今天心情不错", "你是哪位", "你是干什么的"). question = the user asks a world/factual question with a direct answer, NOT about Yiveno identity/name/capability and NOT about finding a saved item (e.g. "how many days are in a leap year", "谁写了红楼梦", "what is the boiling point of water"). instruction = the user asks Yiveno to DO something, generate something, remind them, or delete something (e.g. "remind me to water the plants", "write a haiku", "delete my notes", "帮我翻译这段英文"). When unsure, choose recall — never block a possible recall attempt.',
  '- contentTerms: array of single lowercase tokens (split multi-word entities: ["li","bai"] not ["li bai"]). Drop fillers (the, a, about, saved, read, that, trying, remember, thing, looked, from, at, …) and words that only encode time/type/behavior/note without topic. These are POSITIVE want terms only. When intent is chitchat, question, or instruction, use [].',
  'Rules:',
  '- Zero-anchor assistant requests (e.g. "suggest something fun") → intent chitchat; contentTerms [].',
  '- Do not invent memory ids or database operations. JSON proposal only.',
  '- Do NOT emit timeLabel, objectTypes, behaviorHints, confidence, assistantReply, or any other keys.'
].join('\n')

const RERANK_SYSTEM_PROMPT = [
  'You rerank personal memory candidates for a find-things product.',
  'Output ONLY one JSON object. No markdown, no commentary.',
  'Schema:',
  '- ranked: array of up to 5 objects: { "id": string, "reason": string }',
  'Rules:',
  '- Order by relevance to the user clue (most relevant first).',
  '- Only use ids from the provided candidates.',
  '- reason: one short sentence in the same language as the clue.',
  '- If none are relevant, return {"ranked":[]}.',
  '- Do not invent ids. Do not mention gold answers or evaluation.'
].join('\n')

type IntentLabel = 'recall' | 'chitchat' | 'question' | 'instruction'
type LegId = 'p1' | 'gpt-6.2-sol' | 'qwen4-max' | 'hy4-flash'

interface TokenUsage {
  promptTokens: number | null
  completionTokens: number | null
}

interface ChatResult {
  text: string
  latencyMs: number
  usage: TokenUsage
}

interface ProviderConfig {
  legId: LegId
  label: string
  role: 'parse' | 'rerank'
  model: string
  apiKey: string
  keySource: string
  baseUrl: string
  compat: OpenAiCompatibleChatCompat
  /** $/1M tokens；null = 官方价未核实，只报 tokens */
  priceInPerM: number | null
  priceOutPerM: number | null
  note: string
}

interface UnderstandRow {
  id: string
  set: 'live' | 'pressure' | 'noise'
  clue: string
  expected: string
  passed: boolean
  intent: string
  contentTerms: string[]
  parseLatencyMs: number
  parsePromptTokens: number | null
  parseCompletionTokens: number | null
  falseIntoParse: boolean
  note: string
  error?: string
}

interface RetrievalRow {
  caseId: string
  clue: string
  expectationKind: 'hit' | 'miss'
  expectedId: string
  intent: string
  contentTerms: string[]
  queryVectorFallback: 'contentTerms' | 'rawClue' | null
  top50Ids: string[]
  goldInTop50: boolean | null
  rankedIds: string[]
  reasons: Record<string, string>
  rank: number | null
  recallAt1: boolean
  recallAt5: boolean
  mrr: number
  ndcgAt5: number
  parseLatencyMs: number
  embedLatencyMs: number
  rerankLatencyMs: number
  totalLatencyMs: number
  parsePromptTokens: number | null
  parseCompletionTokens: number | null
  rerankPromptTokens: number | null
  rerankCompletionTokens: number | null
  embedCalls: number
  note: string
  error?: string
  /** 失败诊断链 */
  diagnosis?: {
    parseOk: boolean
    goldInTop50: boolean | null
    rerankTop1: string | null
    rerankReasonTop1: string | null
    localizableStep: 'parse' | 'retrieval' | 'rerank' | 'unclear' | 'n/a'
    reasonTrustworthy: boolean | null
    detail: string
  }
}

interface LegResult {
  legId: LegId
  label: string
  status: 'ran' | 'skipped_no_access' | 'skipped_no_conclusion'
  skipReason?: string
  parseProvider?: ProviderConfig
  rerankProvider?: ProviderConfig
  live: { passed: number; total: number }
  pressure: { passed: number; total: number }
  noise: { passed: number; total: number; falseIntoParse: number }
  retrieval: {
    recallAt1: number | null
    recallAt5: number | null
    mrr: number | null
    ndcgAt5: number | null
    hitDenom: number
  } | null
  llmCalls: { parse: number; rerank: number; total: number }
  tokens: {
    parsePrompt: number
    parseCompletion: number
    rerankPrompt: number
    rerankCompletion: number
  }
  costUsd: number | null
  costNote: string
  latency: {
    parseMedianMs: number | null
    embedMedianMs: number | null
    rerankMedianMs: number | null
    totalMedianMs: number | null
  }
  understandRows: UnderstandRow[]
  retrievalRows: RetrievalRow[]
  verdict?: string
  verdictNote?: string
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

function clip(text: string, max: number): string {
  const t = text.trim()
  if (t.length <= max) return t
  return t.slice(0, max)
}

function isIntentLabel(value: string): value is IntentLabel {
  return (
    value === 'recall' || value === 'chitchat' || value === 'question' || value === 'instruction'
  )
}

function parseLegsArg(): Set<LegId> {
  const all: LegId[] = ['p1', 'gpt-6.2-sol', 'qwen4-max', 'hy4-flash']
  const arg = process.argv.find(a => a.startsWith('--legs='))
  if (!arg) return new Set(all)
  const list = arg
    .slice('--legs='.length)
    .split(',')
    .map(s => s.trim())
    .filter(Boolean) as LegId[]
  return new Set(list.length ? list : all)
}

async function completeChat(
  provider: Pick<ProviderConfig, 'apiKey' | 'baseUrl' | 'model' | 'compat' | 'keySource'>,
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
  options: { temperature?: number; maxTokens?: number; timeoutMs: number }
): Promise<ChatResult> {
  const temperature = options.temperature ?? 0
  const maxTokens = options.maxTokens ?? 400
  const compat = provider.compat
  const url = resolveOpenAiCompatibleChatCompletionsUrl(provider.baseUrl)
  const body: Record<string, unknown> = {
    model: provider.model,
    messages,
    temperature
  }
  // OpenRouter：走 openai 兼容但用 max_tokens，避免部分路由拒 reasoning_effort
  const viaOpenRouter = provider.keySource === 'OPENROUTER_API_KEY'
  if (compat === 'openai' && !viaOpenRouter) {
    body.max_completion_tokens = maxTokens
    body.reasoning_effort = 'none'
  } else if (compat === 'dashscope' || viaOpenRouter) {
    body.max_tokens = maxTokens
  } else {
    body.max_tokens = maxTokens
    body.thinking = { type: 'disabled' }
  }

  const startedAt = Date.now()
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    authorization: `Bearer ${provider.apiKey}`
  }
  if (viaOpenRouter) {
    headers['HTTP-Referer'] = 'https://yiveno.com'
    headers['X-Title'] = 'Yiveno recall-prototype-minimal'
  }
  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(options.timeoutMs)
  })
  const payload = (await response.json().catch(() => ({}))) as {
    choices?: Array<{
      finish_reason?: string
      message?: { content?: string; reasoning_content?: string }
    }>
    usage?: {
      prompt_tokens?: number
      completion_tokens?: number
      total_tokens?: number
    }
    error?: { message?: string }
  }
  const latencyMs = Date.now() - startedAt
  if (!response.ok) {
    const raw = payload.error?.message || response.statusText || 'chat_completions_failed'
    const message = raw
      .replace(/sk-[a-zA-Z0-9]+/g, 'sk-***')
      .replace(/api key:\s*\S+/gi, 'api key: ***')
    throw new Error(message)
  }
  const message = payload.choices?.[0]?.message
  const text = message?.content?.trim() || message?.reasoning_content?.trim()
  if (!text) {
    throw new Error(`chat_empty_response:${payload.choices?.[0]?.finish_reason ?? 'unknown'}`)
  }
  const usage = parseLlmChatUsage(payload.usage)
  return {
    text,
    latencyMs,
    usage: {
      promptTokens: usage.promptTokens,
      completionTokens: usage.completionTokens
    }
  }
}

function resolveDeepseekKey(): { apiKey: string; source: string } | null {
  const explicit = process.env.PARSE_GOLD_LLM_API_KEY?.trim()
  if (explicit) return { apiKey: explicit, source: 'PARSE_GOLD_LLM_API_KEY' }
  const deepseek = process.env.DEEPSEEK_API_KEY?.trim()
  if (deepseek) return { apiKey: deepseek, source: 'DEEPSEEK_API_KEY' }
  return null
}

function resolveParseProviders(): Record<
  LegId,
  ProviderConfig | { skipped: true; reason: string }
> {
  const deepseek = resolveDeepseekKey()
  const deepseekBase = process.env.PARSE_GOLD_LLM_BASE_URL?.trim() || 'https://api.deepseek.com'
  const out: Record<LegId, ProviderConfig | { skipped: true; reason: string }> = {
    p1: deepseek
      ? {
          legId: 'p1',
          label: 'P1 deepseek-v4-flash',
          role: 'parse',
          model: 'deepseek-v4-flash',
          apiKey: deepseek.apiKey,
          keySource: deepseek.source,
          baseUrl: deepseekBase,
          compat: 'deepseek',
          // 本机未核实到可复述的官方 $/1M；只报 tokens
          priceInPerM: null,
          priceOutPerM: null,
          note: '解析+重排同模型；成本只报 tokens（官方价未在本批核实）'
        }
      : { skipped: true, reason: '缺少 DEEPSEEK_API_KEY / PARSE_GOLD_LLM_API_KEY' },
    'gpt-6.2-sol': (() => {
      const openai = process.env.OPENAI_API_KEY?.trim()
      if (openai) {
        return {
          legId: 'gpt-6.2-sol' as const,
          label: 'P2 GPT-6.2 Sol',
          role: 'parse' as const,
          model: 'gpt-6.2-sol',
          apiKey: openai,
          keySource: 'OPENAI_API_KEY',
          baseUrl: 'https://api.openai.com',
          compat: 'openai' as const,
          priceInPerM: 2,
          priceOutPerM: 10,
          note: 'OpenAI 原生'
        }
      }
      const ork = process.env.OPENROUTER_API_KEY?.trim()
      if (ork) {
        return {
          legId: 'gpt-6.2-sol' as const,
          label: 'P2 GPT-6.2 Sol (OpenRouter 适配)',
          role: 'parse' as const,
          model: 'openai/gpt-6.2-sol',
          apiKey: ork,
          keySource: 'OPENROUTER_API_KEY',
          baseUrl: 'https://openrouter.ai/api/v1',
          compat: 'openai' as const,
          priceInPerM: 2,
          priceOutPerM: 10,
          note: '无 OPENAI_API_KEY；经 OpenRouter OpenAI 兼容端点最小适配'
        }
      }
      return { skipped: true as const, reason: '无 OPENAI_API_KEY / OPENROUTER_API_KEY' }
    })(),
    'qwen4-max': (() => {
      const key = process.env.DASHSCOPE_API_KEY?.trim()
      if (!key) return { skipped: true as const, reason: '缺少 DASHSCOPE_API_KEY' }
      return {
        legId: 'qwen4-max' as const,
        label: 'P2 Qwen4-Max',
        role: 'parse' as const,
        model: 'qwen4-max',
        apiKey: key,
        keySource: 'DASHSCOPE_API_KEY',
        baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
        compat: 'dashscope' as const,
        priceInPerM: 1.5,
        priceOutPerM: 4.5,
        note: 'DashScope compatible-mode；模型 id 实探为 qwen4-max'
      }
    })(),
    'hy4-flash': {
      skipped: true,
      reason: '本机 .env*.local 无腾讯 / Hunyuan / Hy4 API key'
    }
  }
  return out
}

function resolveRerankProvider(): ProviderConfig | null {
  const deepseek = resolveDeepseekKey()
  if (!deepseek) return null
  return {
    legId: 'p1',
    label: 'rerank deepseek-v4-flash',
    role: 'rerank',
    model: RERANK_MODEL,
    apiKey: deepseek.apiKey,
    keySource: deepseek.source,
    baseUrl: process.env.PARSE_GOLD_LLM_BASE_URL?.trim() || 'https://api.deepseek.com',
    compat: 'deepseek',
    priceInPerM: null,
    priceOutPerM: null,
    note: 'P2 各腿重排恒为此模型'
  }
}

function resolveApiBase(): string {
  const raw =
    process.env.RETRIEVAL_ABLATION_API_BASE?.trim() ||
    process.env.RECALL_ABLATION_API_BASE?.trim() ||
    'https://api.yiveno.com'
  return raw.replace(/\/$/, '')
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
      user_metadata: { purpose: 'recall_prototype_minimal' }
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
    async embedTexts(
      texts: readonly string[]
    ): Promise<{ vectors: number[][]; latencyMs: number }> {
      const started = Date.now()
      const response = await fetch(`${apiBaseUrl}/api/ai/embed`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${accessToken}`,
          'content-type': 'application/json'
        },
        body: JSON.stringify({ texts: [...texts] })
      })
      const body: unknown = await response.json().catch(() => null)
      const latencyMs = Date.now() - started
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
      return { vectors: data.embeddings, latencyMs }
    }
  }
}

async function embedCorpus(
  items: MemoryItem[],
  embedTexts: (texts: readonly string[]) => Promise<{ vectors: number[][]; latencyMs: number }>
): Promise<MemoryItem[]> {
  const texts = items.map(item => buildEmbeddingTextFromMemoryItem(item))
  const vectors: number[][] = []
  const BATCH = 8
  for (let offset = 0; offset < texts.length; offset += BATCH) {
    const slice = texts.slice(offset, offset + BATCH)
    const batch = await embedTexts(slice)
    vectors.push(...batch.vectors)
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

function itemTitle(item: MemoryItem): string {
  if (item.type === 'bookmark') {
    return clip(item.clues.title ?? item.payload.title, TITLE_CLIP)
  }
  return clip(item.clues.title ?? item.payload.pageTitle, TITLE_CLIP)
}

function itemExcerpt(item: MemoryItem): string {
  if (item.type === 'text_excerpt') {
    return clip(item.clues.textExcerpt ?? item.payload.selectedText, EXCERPT_CLIP)
  }
  return clip(item.clues.textExcerpt ?? item.clues.summary ?? item.payload.url, EXCERPT_CLIP)
}

function normalizeContentTerms(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  const joined = raw
    .filter((t): t is string => typeof t === 'string')
    .map(t => t.trim().toLowerCase())
    .filter(Boolean)
    .join(' ')
  return extractContentTerms(joined)
}

async function parseClue(
  provider: ProviderConfig,
  clue: string
): Promise<{
  intent: IntentLabel
  contentTerms: string[]
  latencyMs: number
  usage: TokenUsage
}> {
  const chat = await completeChat(
    provider,
    [
      { role: 'system', content: PROTOTYPE_PARSE_SYSTEM_PROMPT },
      { role: 'user', content: `Clue:\n${clue}` }
    ],
    { temperature: 0, maxTokens: 300, timeoutMs: PARSE_TIMEOUT_MS }
  )
  const raw = parseJsonObjectFromLlmText(chat.text)
  if (typeof raw !== 'object' || raw === null) {
    throw new Error('parse_not_object')
  }
  const intentRaw = (raw as { intent?: unknown }).intent
  if (typeof intentRaw !== 'string' || !isIntentLabel(intentRaw)) {
    throw new Error(`parse_bad_intent:${String(intentRaw)}`)
  }
  const contentTerms = normalizeContentTerms((raw as { contentTerms?: unknown }).contentTerms)
  return {
    intent: intentRaw,
    contentTerms,
    latencyMs: chat.latencyMs,
    usage: chat.usage
  }
}

async function rerankCandidates(
  provider: ProviderConfig,
  clue: string,
  candidates: Array<{ id: string; title: string; excerpt: string }>
): Promise<{
  ranked: Array<{ id: string; reason: string }>
  latencyMs: number
  usage: TokenUsage
}> {
  const lines = candidates.map(
    (c, i) => `${i + 1}. id=${c.id}\ntitle=${c.title}\nexcerpt=${c.excerpt}`
  )
  const chat = await completeChat(
    provider,
    [
      { role: 'system', content: RERANK_SYSTEM_PROMPT },
      {
        role: 'user',
        content: `Clue:\n${clue}\n\nCandidates (${candidates.length}):\n${lines.join('\n\n')}`
      }
    ],
    { temperature: 0, maxTokens: 900, timeoutMs: RERANK_TIMEOUT_MS }
  )
  const raw = parseJsonObjectFromLlmText(chat.text)
  if (typeof raw !== 'object' || raw === null) {
    throw new Error('rerank_not_object')
  }
  const rankedRaw = (raw as { ranked?: unknown }).ranked
  if (!Array.isArray(rankedRaw)) {
    throw new Error('rerank_missing_ranked')
  }
  const allowed = new Set(candidates.map(c => c.id))
  const ranked: Array<{ id: string; reason: string }> = []
  const seen = new Set<string>()
  for (const entry of rankedRaw) {
    if (typeof entry !== 'object' || entry === null) continue
    const id = (entry as { id?: unknown }).id
    const reason = (entry as { reason?: unknown }).reason
    if (typeof id !== 'string' || !allowed.has(id) || seen.has(id)) continue
    seen.add(id)
    ranked.push({
      id,
      reason: typeof reason === 'string' ? clip(reason, 200) : ''
    })
    if (ranked.length >= TOP_K_RERANK) break
  }
  return { ranked, latencyMs: chat.latencyMs, usage: chat.usage }
}

function top50ByCosine(
  queryVector: number[],
  corpus: MemoryItem[]
): Array<{ id: string; similarity: number; item: MemoryItem }> {
  const scored: Array<{ id: string; similarity: number; item: MemoryItem }> = []
  for (const item of corpus) {
    const embedding = item.clues.embedding
    if (!Array.isArray(embedding) || embedding.length === 0) continue
    scored.push({
      id: item.id,
      similarity: cosineSimilarity(queryVector, embedding),
      item
    })
  }
  scored.sort((a, b) => b.similarity - a.similarity)
  return scored.slice(0, TOP_K_SEMANTIC)
}

function emptyLegSkeleton(legId: LegId, label: string): LegResult {
  return {
    legId,
    label,
    status: 'ran',
    live: { passed: 0, total: 0 },
    pressure: { passed: 0, total: 0 },
    noise: { passed: 0, total: 0, falseIntoParse: 0 },
    retrieval: null,
    llmCalls: { parse: 0, rerank: 0, total: 0 },
    tokens: {
      parsePrompt: 0,
      parseCompletion: 0,
      rerankPrompt: 0,
      rerankCompletion: 0
    },
    costUsd: null,
    costNote: '',
    latency: {
      parseMedianMs: null,
      embedMedianMs: null,
      rerankMedianMs: null,
      totalMedianMs: null
    },
    understandRows: [],
    retrievalRows: []
  }
}

function addTokens(bag: LegResult['tokens'], kind: 'parse' | 'rerank', usage: TokenUsage): void {
  if (kind === 'parse') {
    bag.parsePrompt += usage.promptTokens ?? 0
    bag.parseCompletion += usage.completionTokens ?? 0
  } else {
    bag.rerankPrompt += usage.promptTokens ?? 0
    bag.rerankCompletion += usage.completionTokens ?? 0
  }
}

function estimateCostUsd(
  parseProvider: ProviderConfig,
  rerankProvider: ProviderConfig,
  tokens: LegResult['tokens']
): { costUsd: number | null; note: string } {
  const parseIn = parseProvider.priceInPerM
  const parseOut = parseProvider.priceOutPerM
  const rerankIn = rerankProvider.priceInPerM
  const rerankOut = rerankProvider.priceOutPerM
  if (parseIn == null || parseOut == null || rerankIn == null || rerankOut == null) {
    return {
      costUsd: null,
      note: '解析或重排官方 $/1M 未齐全核实 → 只报 tokens（P1 deepseek 价未核实；重排同）'
    }
  }
  const usd =
    (tokens.parsePrompt * parseIn +
      tokens.parseCompletion * parseOut +
      tokens.rerankPrompt * rerankIn +
      tokens.rerankCompletion * rerankOut) /
    1_000_000
  return {
    costUsd: usd,
    note: `parse $${parseIn}/$${parseOut} + rerank $${rerankIn}/$${rerankOut} per 1M`
  }
}

async function runLeg(options: {
  legId: LegId
  parseProvider: ProviderConfig
  rerankProvider: ProviderConfig
  corpus: MemoryItem[]
  embedClient: ReturnType<typeof createWorkerEmbedClient>
}): Promise<LegResult> {
  const { legId, parseProvider, rerankProvider, corpus, embedClient } = options
  const result = emptyLegSkeleton(legId, parseProvider.label)
  result.parseProvider = {
    ...parseProvider,
    apiKey: '***'
  }
  result.rerankProvider = {
    ...rerankProvider,
    apiKey: '***'
  }

  const parseLatencies: number[] = []
  const embedLatencies: number[] = []
  const rerankLatencies: number[] = []
  const totalLatencies: number[] = []

  const noiseCases = buildNoiseGatewayEvalCases().filter(c => c.gate === 'must')

  // —— live ——
  for (const spec of INTENT_EVAL_MUST) {
    try {
      const parsed = await parseClue(parseProvider, spec.clue)
      result.llmCalls.parse += 1
      addTokens(result.tokens, 'parse', parsed.usage)
      parseLatencies.push(parsed.latencyMs)
      totalLatencies.push(parsed.latencyMs)
      const passed = parsed.intent === spec.expectedIntent
      result.understandRows.push({
        id: spec.id,
        set: 'live',
        clue: spec.clue,
        expected: spec.expectedIntent,
        passed,
        intent: parsed.intent,
        contentTerms: parsed.contentTerms,
        parseLatencyMs: parsed.latencyMs,
        parsePromptTokens: parsed.usage.promptTokens,
        parseCompletionTokens: parsed.usage.completionTokens,
        falseIntoParse: false,
        note: ''
      })
    } catch (error) {
      result.llmCalls.parse += 1
      result.understandRows.push({
        id: spec.id,
        set: 'live',
        clue: spec.clue,
        expected: spec.expectedIntent,
        passed: false,
        intent: 'error',
        contentTerms: [],
        parseLatencyMs: 0,
        parsePromptTokens: null,
        parseCompletionTokens: null,
        falseIntoParse: false,
        note: 'json_or_call_failed',
        error: error instanceof Error ? error.message : String(error)
      })
    }
  }

  // —— pressure ——
  for (const spec of PRESSURE_CASES) {
    try {
      const parsed = await parseClue(parseProvider, spec.clue)
      result.llmCalls.parse += 1
      addTokens(result.tokens, 'parse', parsed.usage)
      parseLatencies.push(parsed.latencyMs)
      totalLatencies.push(parsed.latencyMs)
      const passed = parsed.intent === spec.expectedIntent
      result.understandRows.push({
        id: spec.id,
        set: 'pressure',
        clue: spec.clue,
        expected: spec.expectedIntent,
        passed,
        intent: parsed.intent,
        contentTerms: parsed.contentTerms,
        parseLatencyMs: parsed.latencyMs,
        parsePromptTokens: parsed.usage.promptTokens,
        parseCompletionTokens: parsed.usage.completionTokens,
        falseIntoParse: false,
        note: spec.note
      })
    } catch (error) {
      result.llmCalls.parse += 1
      result.understandRows.push({
        id: spec.id,
        set: 'pressure',
        clue: spec.clue,
        expected: spec.expectedIntent,
        passed: false,
        intent: 'error',
        contentTerms: [],
        parseLatencyMs: 0,
        parsePromptTokens: null,
        parseCompletionTokens: null,
        falseIntoParse: false,
        note: spec.note,
        error: error instanceof Error ? error.message : String(error)
      })
    }
  }

  // —— noise：全进解析；期望 intent != recall ——
  let falseIntoParse = 0
  for (const evalCase of noiseCases) {
    const expectReject = evalCase.expect.disposition === 'reject_noise'
    try {
      const parsed = await parseClue(parseProvider, evalCase.clue)
      result.llmCalls.parse += 1
      addTokens(result.tokens, 'parse', parsed.usage)
      parseLatencies.push(parsed.latencyMs)
      totalLatencies.push(parsed.latencyMs)
      const enteredRecall = parsed.intent === 'recall'
      if (expectReject && enteredRecall) falseIntoParse += 1
      const passed = expectReject ? !enteredRecall : enteredRecall
      result.understandRows.push({
        id: evalCase.id,
        set: 'noise',
        clue: evalCase.clue,
        expected: expectReject ? 'reject(intent!=recall)' : 'proceed(recall)',
        passed,
        intent: parsed.intent,
        contentTerms: parsed.contentTerms,
        parseLatencyMs: parsed.latencyMs,
        parsePromptTokens: parsed.usage.promptTokens,
        parseCompletionTokens: parsed.usage.completionTokens,
        falseIntoParse: expectReject && enteredRecall,
        note: evalCase.note
      })
    } catch (error) {
      result.llmCalls.parse += 1
      // JSON 失败：对期望 reject 的 noise 不算「误入 recall」，但计失败
      result.understandRows.push({
        id: evalCase.id,
        set: 'noise',
        clue: evalCase.clue,
        expected: expectReject ? 'reject(intent!=recall)' : 'proceed(recall)',
        passed: false,
        intent: 'error',
        contentTerms: [],
        parseLatencyMs: 0,
        parsePromptTokens: null,
        parseCompletionTokens: null,
        falseIntoParse: false,
        note: evalCase.note,
        error: error instanceof Error ? error.message : String(error)
      })
    }
  }

  const liveRows = result.understandRows.filter(r => r.set === 'live')
  const pressureRows = result.understandRows.filter(r => r.set === 'pressure')
  const noiseRows = result.understandRows.filter(r => r.set === 'noise')
  result.live = {
    passed: liveRows.filter(r => r.passed).length,
    total: liveRows.length
  }
  result.pressure = {
    passed: pressureRows.filter(r => r.passed).length,
    total: pressureRows.length
  }
  result.noise = {
    passed: noiseRows.filter(r => r.passed).length,
    total: noiseRows.length,
    falseIntoParse
  }

  // —— retrieval IR ——
  for (const ablationCase of RETRIEVAL_ABLATION_CASES) {
    const clue = ablationCase.clueForDisplay
    const expectedId = ablationCase.expectation.expectedId
    const kind = ablationCase.expectation.kind
    const startedTotal = Date.now()
    let parseLatencyMs = 0
    let embedLatencyMs = 0
    let rerankLatencyMs = 0
    let intent: string = 'error'
    let contentTerms: string[] = []
    let queryVectorFallback: RetrievalRow['queryVectorFallback'] = null
    let top50Ids: string[] = []
    let rankedIds: string[] = []
    const reasons: Record<string, string> = {}
    let embedCalls = 0
    let note = ''
    let error: string | undefined
    let goldInTop50: boolean | null = null
    let diagnosis: RetrievalRow['diagnosis']

    try {
      const parsed = await parseClue(parseProvider, clue)
      result.llmCalls.parse += 1
      addTokens(result.tokens, 'parse', parsed.usage)
      parseLatencyMs = parsed.latencyMs
      parseLatencies.push(parsed.latencyMs)
      intent = parsed.intent
      contentTerms = parsed.contentTerms

      if (parsed.intent !== 'recall') {
        note = 'intent_not_recall_skip_retrieval'
        goldInTop50 = null
        diagnosis = {
          parseOk: true,
          goldInTop50: null,
          rerankTop1: null,
          rerankReasonTop1: null,
          localizableStep: 'parse',
          reasonTrustworthy: null,
          detail: `intent=${parsed.intent}，未检索`
        }
      } else {
        const embedText =
          contentTerms.length > 0
            ? buildClueEmbeddingText({
                rawClue: clue,
                parsed: {
                  raw: clue,
                  contentTerms,
                  confidence: 'medium'
                }
              })
            : clue
        queryVectorFallback = contentTerms.length > 0 ? 'contentTerms' : 'rawClue'
        const embedOut = await embedClient.embedTexts([embedText])
        embedCalls = 1
        embedLatencyMs = embedOut.latencyMs
        embedLatencies.push(embedLatencyMs)
        const queryVector = embedOut.vectors[0]
        if (!queryVector?.length) throw new Error('empty_query_vector')

        const top50 = top50ByCosine(queryVector, corpus)
        top50Ids = top50.map(t => t.id)
        goldInTop50 = top50Ids.includes(expectedId)

        const candidatePayload = top50.map(t => ({
          id: t.id,
          title: itemTitle(t.item),
          excerpt: itemExcerpt(t.item)
        }))
        const reranked = await rerankCandidates(rerankProvider, clue, candidatePayload)
        result.llmCalls.rerank += 1
        addTokens(result.tokens, 'rerank', reranked.usage)
        rerankLatencyMs = reranked.latencyMs
        rerankLatencies.push(rerankLatencyMs)
        rankedIds = stabilizeRankedIds(reranked.ranked.map(r => r.id))
        for (const r of reranked.ranked) reasons[r.id] = r.reason

        if (rankedIds.length === 0) {
          note = 'no_match_empty_rerank'
        }

        const top1 = rankedIds[0] ?? null
        const top1Reason = top1 ? (reasons[top1] ?? null) : null
        let localizableStep: NonNullable<RetrievalRow['diagnosis']>['localizableStep'] = 'unclear'
        let reasonTrustworthy: boolean | null = null
        let detail = ''
        if (kind === 'hit') {
          if (!goldInTop50) {
            localizableStep = 'retrieval'
            reasonTrustworthy =
              top1 != null && top1Reason != null ? !top1Reason.toLowerCase().includes('gold') : null
            if (top1 && !goldInTop50) {
              // 重排理由声称最相关，但正解不在 Top50 → 理由相对失败原因不可信定位
              reasonTrustworthy = false
              detail = '正解不在 Top50；若理由称某候选最相关 → 理由不可信（相对失败根因）'
            } else {
              detail = '正解不在余弦 Top50'
            }
          } else if (top1 !== expectedId) {
            localizableStep = 'rerank'
            reasonTrustworthy = true
            detail = `正解在 Top50 但重排 Top1=${top1 ?? 'null'}`
          } else {
            localizableStep = 'n/a'
            reasonTrustworthy = true
            detail = '命中'
          }
        } else {
          localizableStep = 'n/a'
          reasonTrustworthy = null
          detail = '负例行，IR 主指标不计'
        }
        diagnosis = {
          parseOk: true,
          goldInTop50,
          rerankTop1: top1,
          rerankReasonTop1: top1Reason,
          localizableStep,
          reasonTrustworthy,
          detail
        }
      }
    } catch (err) {
      error = err instanceof Error ? err.message : String(err)
      note = 'pipeline_error'
      diagnosis = {
        parseOk: false,
        goldInTop50,
        rerankTop1: null,
        rerankReasonTop1: null,
        localizableStep: 'parse',
        reasonTrustworthy: null,
        detail: error
      }
    }

    const totalLatencyMs = Date.now() - startedTotal
    totalLatencies.push(totalLatencyMs)
    const stableRanked = stabilizeRankedIds(rankedIds)
    const row: RetrievalRow = {
      caseId: ablationCase.id,
      clue,
      expectationKind: kind,
      expectedId,
      intent,
      contentTerms,
      queryVectorFallback,
      top50Ids,
      goldInTop50,
      rankedIds: stableRanked,
      reasons,
      rank: recallAtK(stableRanked, expectedId, 50).rank,
      recallAt1: recallAtK(stableRanked, expectedId, 1).hit,
      recallAt5: recallAtK(stableRanked, expectedId, 5).hit,
      mrr: kind === 'hit' ? mrrContribution(stableRanked, expectedId) : 0,
      ndcgAt5: kind === 'hit' ? ndcgAtK(stableRanked, expectedId, 5) : 0,
      parseLatencyMs,
      embedLatencyMs,
      rerankLatencyMs,
      totalLatencyMs,
      parsePromptTokens: null,
      parseCompletionTokens: null,
      rerankPromptTokens: null,
      rerankCompletionTokens: null,
      embedCalls,
      note,
      error,
      diagnosis
    }
    result.retrievalRows.push(row)
    console.info(
      `[prototype] ${legId} retrieval ${ablationCase.id} intent=${intent} r@1=${row.recallAt1} ${note || error || 'ok'}`
    )
  }

  const hits = result.retrievalRows.filter(r => r.expectationKind === 'hit')
  const queries = hits.map(r => ({ rankedIds: r.rankedIds, goldId: r.expectedId }))
  result.retrieval = {
    recallAt1: meanRecallAtK(queries, 1).mean,
    recallAt5: meanRecallAtK(queries, 5).mean,
    mrr: meanMrr(queries).mean,
    ndcgAt5: meanNdcgAtK(queries, 5).mean,
    hitDenom: hits.length
  }

  result.llmCalls.total = result.llmCalls.parse + result.llmCalls.rerank
  result.latency = {
    parseMedianMs: median(parseLatencies),
    embedMedianMs: median(embedLatencies),
    rerankMedianMs: median(rerankLatencies),
    totalMedianMs: median(totalLatencies)
  }
  const cost = estimateCostUsd(parseProvider, rerankProvider, result.tokens)
  result.costUsd = cost.costUsd
  result.costNote = cost.note
  return result
}

function fmtRate(r: { passed: number; total: number }): string {
  return `${r.passed}/${r.total}`
}

function fmtIr(r: LegResult['retrieval']): string {
  if (!r) return '—'
  const a = r.recallAt1?.toFixed(4) ?? 'null'
  const b = r.mrr?.toFixed(4) ?? 'null'
  const c = r.ndcgAt5?.toFixed(4) ?? 'null'
  return `${a} / ${b} / ${c}`
}

function loadAblationBaseline(): {
  live: { passed: number; total: number }
  pressure: { passed: number; total: number }
  noise: { passed: number; total: number }
  retrieval: {
    recallAt1: number
    mrr: number
    ndcgAt5: number
    hitDenom: number
  }
  llmCalls: number
  latencyMedianMs: number
  understandRowCount: number
  retrievalRowCount: number
} {
  const raw = JSON.parse(readFileSync(ABLATION_JSON, 'utf8')) as {
    arms: Array<{
      arm: string
      live: { passed: number; total: number }
      pressure: { passed: number; total: number }
      noise: { passed: number; total: number }
      retrieval?: {
        recallAt1: number
        mrr: number
        ndcgAt5: number
        hitDenom: number
      }
      llmCalls: number
      latencyMedianMs: number
      understandRows?: unknown[]
      retrievalRows?: unknown[]
    }>
  }
  const baseline = raw.arms.find(a => a.arm === 'baseline')
  if (!baseline?.retrieval) {
    throw new Error('ablation JSON 缺少 baseline.retrieval')
  }
  return {
    live: baseline.live,
    pressure: baseline.pressure,
    noise: baseline.noise,
    retrieval: {
      recallAt1: baseline.retrieval.recallAt1,
      mrr: baseline.retrieval.mrr,
      ndcgAt5: baseline.retrieval.ndcgAt5,
      hitDenom: baseline.retrieval.hitDenom
    },
    llmCalls: baseline.llmCalls,
    latencyMedianMs: baseline.latencyMedianMs,
    understandRowCount: baseline.understandRows?.length ?? 0,
    retrievalRowCount: baseline.retrievalRows?.length ?? 0
  }
}

function judgeP1(
  p1: LegResult,
  baseline: ReturnType<typeof loadAblationBaseline>
): {
  quality: string
  cost: string
  latency: string
  explainability: string
  overall: string
  details: Record<string, string>
} {
  const worseSets: string[] = []
  const betterSets: string[] = []
  const check = (
    name: string,
    a: { passed: number; total: number },
    b: { passed: number; total: number }
  ) => {
    if (a.passed < b.passed) worseSets.push(`${name} ${b.passed}/${b.total}→${a.passed}/${a.total}`)
    else if (a.passed > b.passed)
      betterSets.push(`${name} ${b.passed}/${b.total}→${a.passed}/${a.total}`)
  }
  check('live', p1.live, baseline.live)
  check('pressure', p1.pressure, baseline.pressure)
  check('noise', p1.noise, baseline.noise)

  const ir = p1.retrieval
  let irWorse = false
  let irBetter = false
  if (ir) {
    const diffs = [
      ['R@1', ir.recallAt1, baseline.retrieval.recallAt1],
      ['MRR', ir.mrr, baseline.retrieval.mrr],
      ['nDCG@5', ir.ndcgAt5, baseline.retrieval.ndcgAt5]
    ] as const
    for (const [name, a, b] of diffs) {
      if (a == null) continue
      if (a + METRIC_EPS < b) {
        irWorse = true
        worseSets.push(`${name} ${b.toFixed(4)}→${a.toFixed(4)}`)
      } else if (a > b + METRIC_EPS) {
        irBetter = true
        betterSets.push(`${name} ${b.toFixed(4)}→${a.toFixed(4)}`)
      }
    }
  }

  let quality: string
  if (worseSets.length === 0 && (betterSets.length > 0 || irBetter)) quality = '质量更优'
  else if (worseSets.length === 0) quality = '质量持平'
  else quality = '质量落后'

  // 成本：管线 62 次 / (understand+retrieval 行) 作每 query 平均对照
  const baselineQueryDenom = baseline.understandRowCount + baseline.retrievalRowCount
  const baselineCallsPerQuery =
    baselineQueryDenom > 0 ? baseline.llmCalls / baselineQueryDenom : null
  const p1QueryDenom = p1.understandRows.length + p1.retrievalRows.length
  const p1CallsPerQuery = p1QueryDenom > 0 ? p1.llmCalls.total / p1QueryDenom : null
  let cost: string
  if (p1CallsPerQuery != null && baselineCallsPerQuery != null) {
    cost =
      p1CallsPerQuery < baselineCallsPerQuery
        ? '成本更低'
        : p1CallsPerQuery > baselineCallsPerQuery
          ? '成本更高'
          : '成本持平'
  } else {
    cost = '成本更高'
  }

  const p1Med = p1.latency.totalMedianMs
  let latency: string
  if (p1Med == null) latency = '延迟未知'
  else if (p1Med < baseline.latencyMedianMs) latency = '延迟更低'
  else if (p1Med > baseline.latencyMedianMs) latency = '延迟更高'
  else latency = '延迟持平'

  const failedRetrieval = p1.retrievalRows.filter(r => r.expectationKind === 'hit' && !r.recallAt1)
  const localizable = failedRetrieval.filter(
    r => r.diagnosis && r.diagnosis.localizableStep !== 'unclear'
  )
  const explainability =
    failedRetrieval.length === 0
      ? '可解释性：本批 hit 无 Top1 失败（或无可诊 case）'
      : `可解释性：${localizable.length}/${failedRetrieval.length} 个 Top1 失败可定位到单步`

  let overall: string
  if (quality === '质量持平' || quality === '质量更优') {
    if (cost === '成本更低' && (latency === '延迟更低' || latency === '延迟持平')) {
      overall = '原型全面达到或超过现管线'
    } else {
      overall = `原型部分达到（${[cost !== '成本更低' ? cost : null, latency.includes('更高') ? latency : null].filter(Boolean).join('；') || '见分维'}）`
    }
  } else {
    overall = '原型明显落后（现管线复杂度有证据支撑，维持）'
  }

  return {
    quality,
    cost,
    latency,
    explainability,
    overall,
    details: {
      worseSets: worseSets.join('；') || '无',
      betterSets: betterSets.join('；') || '无',
      baselineCallsPerQuery: baselineCallsPerQuery?.toFixed(4) ?? 'null',
      p1CallsPerQuery: p1CallsPerQuery?.toFixed(4) ?? 'null',
      baselineQueryDenom: String(baselineQueryDenom),
      p1QueryDenom: String(p1QueryDenom),
      irWorse: String(irWorse),
      irBetter: String(irBetter)
    }
  }
}

function judgeP2(leg: LegResult, p1: LegResult): string {
  if (leg.status === 'skipped_no_access') return '无可用接入'
  if (leg.status === 'skipped_no_conclusion') return '无结论'
  if (!leg.retrieval || !p1.retrieval) return '无结论'
  const intentOk =
    leg.live.passed >= p1.live.passed &&
    leg.pressure.passed >= p1.pressure.passed &&
    leg.noise.passed >= p1.noise.passed
  const irOk =
    (leg.retrieval.recallAt1 ?? 0) + METRIC_EPS >= (p1.retrieval.recallAt1 ?? 0) &&
    (leg.retrieval.mrr ?? 0) + METRIC_EPS >= (p1.retrieval.mrr ?? 0) &&
    (leg.retrieval.ndcgAt5 ?? 0) + METRIC_EPS >= (p1.retrieval.ndcgAt5 ?? 0)
  if (!intentOk || !irOk) return '不换'
  return '值得考虑'
}

function renderMd(input: {
  created: string
  updated: string
  step0: Record<string, unknown>
  baseline: ReturnType<typeof loadAblationBaseline>
  legs: LegResult[]
  p1Judgment: ReturnType<typeof judgeP1> | null
  deviations: string[]
  mappingGaps: string[]
}): string {
  const { created, updated, step0, baseline, legs, p1Judgment, deviations, mappingGaps } = input
  const p1 = legs.find(l => l.legId === 'p1' && l.status === 'ran')
  const lines: string[] = []
  lines.push('---')
  lines.push('title: 2026-11-19 Recall 最小 LLM 原生原型（P1）+ 解析模型对照（P2）')
  lines.push(`created: ${created}`)
  lines.push(`updated: ${updated}`)
  lines.push('author: agent:cursor')
  lines.push(
    'scope: 离线只读实验；P1 一次解析 + bge-m3 Top50 + 一次 LLM 重排；P2 只换解析模型；不改产品行为'
  )
  lines.push('status: complete')
  lines.push('upstream:')
  lines.push('  - docs/audits/2026-11-18-recall-ablation-audit.md')
  lines.push('  - extension/scripts/recall-ablation-audit.ts')
  lines.push('  - extension/src/core/recall/eval/retrieval-ablation-cases.ts')
  lines.push('downstream:')
  lines.push('  - 仅证据与判定；不重构管线；不推进模型接入')
  lines.push('---')
  lines.push('')
  lines.push('# 2026-11-19 Recall 最小 LLM 原生原型')
  lines.push('')
  lines.push('## 1. Step 0 定锚')
  lines.push('')
  lines.push('| 项 | 实测 |')
  lines.push('| --- | --- |')
  for (const [k, v] of Object.entries(step0)) {
    lines.push(`| ${k} | ${typeof v === 'string' ? v : `\`${JSON.stringify(v)}\``} |`)
  }
  lines.push(
    `| 消融基线 live/pressure/noise | ${fmtRate(baseline.live)} / ${fmtRate(baseline.pressure)} / ${fmtRate(baseline.noise)} |`
  )
  lines.push(
    `| 消融基线 IR R@1/MRR/nDCG@5 | ${baseline.retrieval.recallAt1.toFixed(4)} / ${baseline.retrieval.mrr.toFixed(4)} / ${baseline.retrieval.ndcgAt5.toFixed(4)}（hitDenom=${baseline.retrieval.hitDenom}） |`
  )
  lines.push(
    `| 消融基线 LLM 调用 / 中位延迟 | ${baseline.llmCalls} / ${baseline.latencyMedianMs} ms |`
  )
  lines.push('')
  lines.push('## 2. P1 对照表')
  lines.push('')
  if (!p1 || !p1Judgment) {
    lines.push('P1 未跑通。')
  } else {
    lines.push('| 维度 | 原型数字 | 管线基线数字 | 结论 | 备注 |')
    lines.push('| --- | --- | --- | --- | --- |')
    lines.push(
      `| 质量（live/pressure/noise） | ${fmtRate(p1.live)} / ${fmtRate(p1.pressure)} / ${fmtRate(p1.noise)}（误入${p1.noise.falseIntoParse}） | ${fmtRate(baseline.live)} / ${fmtRate(baseline.pressure)} / ${fmtRate(baseline.noise)} | ${p1Judgment.quality} | 更差集：${p1Judgment.details.worseSets}；更好集：${p1Judgment.details.betterSets} |`
    )
    lines.push(
      `| 质量（IR） | ${fmtIr(p1.retrieval)} | ${baseline.retrieval.recallAt1.toFixed(4)} / ${baseline.retrieval.mrr.toFixed(4)} / ${baseline.retrieval.ndcgAt5.toFixed(4)} | （并入质量维） | hitDenom=${p1.retrieval?.hitDenom ?? 0} |`
    )
    lines.push(
      `| 成本 | LLM ${p1.llmCalls.total}（parse ${p1.llmCalls.parse} + rerank ${p1.llmCalls.rerank}）；每 query 均 ${p1Judgment.details.p1CallsPerQuery} 次；tokens parse ${p1.tokens.parsePrompt}/${p1.tokens.parseCompletion} rerank ${p1.tokens.rerankPrompt}/${p1.tokens.rerankCompletion}；$ ${p1.costUsd ?? '未估'} | 全集 LLM ${baseline.llmCalls}；每 query 均 ${p1Judgment.details.baselineCallsPerQuery}（分母=understandRows ${baseline.understandRowCount}+retrievalRows ${baseline.retrievalRowCount}） | ${p1Judgment.cost} | ${p1.costNote} |`
    )
    lines.push(
      `| 延迟 | 总中位 ${p1.latency.totalMedianMs} ms（parse ${p1.latency.parseMedianMs} / embed ${p1.latency.embedMedianMs} / rerank ${p1.latency.rerankMedianMs}） | ${baseline.latencyMedianMs} ms | ${p1Judgment.latency} | 口径：本臂全部墙钟样本中位（理解行+检索行） |`
    )
    lines.push(`| 可解释性 | 见 §4 | — | ${p1Judgment.explainability} | — |`)
    lines.push('')
    lines.push(`**总判：** ${p1Judgment.overall}`)
  }
  lines.push('')
  lines.push('## 3. P2 解析模型对照')
  lines.push('')
  lines.push(
    '| 模型 | 意图分类（live / pressure / noise） | IR（R@1 / MRR / nDCG@5） | 延迟中位 | tokens | 成本估算 | 结论 |'
  )
  lines.push('| --- | --- | --- | ---: | --- | ---: | --- |')
  for (const leg of legs.filter(l => l.legId !== 'p1' || true)) {
    if (leg.legId === 'p1') {
      lines.push(
        `| ${leg.label}（对照） | ${fmtRate(leg.live)} / ${fmtRate(leg.pressure)} / ${fmtRate(leg.noise)} | ${fmtIr(leg.retrieval)} | ${leg.latency.totalMedianMs ?? '—'} | parse ${leg.tokens.parsePrompt}/${leg.tokens.parseCompletion}；rerank ${leg.tokens.rerankPrompt}/${leg.tokens.rerankCompletion} | ${leg.costUsd ?? '未估'} | P1 基线 |`
      )
      continue
    }
    if (leg.status !== 'ran') {
      lines.push(
        `| ${leg.label} | — | — | — | — | — | **${leg.verdict ?? leg.status}**（${leg.skipReason ?? ''}） |`
      )
      continue
    }
    lines.push(
      `| ${leg.label} | ${fmtRate(leg.live)} / ${fmtRate(leg.pressure)} / ${fmtRate(leg.noise)} | ${fmtIr(leg.retrieval)} | ${leg.latency.totalMedianMs ?? '—'} | parse ${leg.tokens.parsePrompt}/${leg.tokens.parseCompletion}；rerank ${leg.tokens.rerankPrompt}/${leg.tokens.rerankCompletion} | ${leg.costUsd ?? '未估'} | **${leg.verdict}** |`
    )
  }
  lines.push('')
  lines.push('## 4. 可解释性（失败诊断链）')
  lines.push('')
  if (p1) {
    const fails = p1.retrievalRows.filter(r => r.expectationKind === 'hit' && !r.recallAt1)
    if (fails.length === 0) {
      lines.push('P1 hit 集无 Top1 失败。')
    } else {
      lines.push(
        '| caseId | 解析 intent/terms | Top50 含正解 | 重排 Top1 | 理由 | 可定位步骤 | 理由可信 |'
      )
      lines.push('| --- | --- | --- | --- | --- | --- | --- |')
      for (const f of fails) {
        const d = f.diagnosis
        lines.push(
          `| ${f.caseId} | ${f.intent} / [${f.contentTerms.join(', ')}] | ${f.goldInTop50} | ${d?.rerankTop1 ?? '—'} | ${(d?.rerankReasonTop1 ?? '').replace(/\|/g, '/').slice(0, 80) || '—'} | ${d?.localizableStep ?? '—'} | ${d?.reasonTrustworthy ?? '—'} |`
        )
      }
    }
    const liveFails = p1.understandRows.filter(r => !r.passed)
    lines.push('')
    lines.push(`理解失败行数：${liveFails.length}（live+pressure+noise）。`)
  }
  lines.push('')
  lines.push('## 5. 映射缺口清单')
  lines.push('')
  for (const g of mappingGaps) lines.push(`- ${g}`)
  lines.push('')
  lines.push('## 6. 偏差清单')
  lines.push('')
  for (const d of deviations) lines.push(`- ${d}`)
  lines.push('')
  lines.push('## 7. 总结论')
  lines.push('')
  if (p1Judgment) {
    lines.push(p1Judgment.overall)
  } else {
    lines.push('P1 未完成，无总判。')
  }
  lines.push('')
  lines.push('## 附录 A · P1 解析 prompt 全文')
  lines.push('')
  lines.push('```')
  lines.push(PROTOTYPE_PARSE_SYSTEM_PROMPT)
  lines.push('```')
  lines.push('')
  lines.push(`promptVersion: ${PARSE_PROMPT_VERSION}`)
  lines.push('')
  lines.push('## 附录 B · 重排截断规则')
  lines.push('')
  lines.push(
    `- 候选 Top ${TOP_K_SEMANTIC}；每条 title≤${TITLE_CLIP} 字符、excerpt≤${EXCERPT_CLIP} 字符；重排输出 Top ${TOP_K_RERANK}。`
  )
  lines.push(`- 无余弦门（不用 0.28）；无池上限 24；无关键词 / RRF / 保护层。`)
  lines.push(
    `- 解析超时 ${PARSE_TIMEOUT_MS}ms；重排超时 ${RERANK_TIMEOUT_MS}ms（脚本本地 fetch，非产品 12s）。`
  )
  lines.push('')
  lines.push(`逐行 JSON：\`${OUT_JSON}\``)
  lines.push('')
  return lines.join('\n')
}

export async function runRecallPrototypeMinimal(): Promise<void> {
  loadLocalEnvFiles()
  const created = nowStampShanghai()
  const legsWanted = parseLegsArg()
  const baseline = loadAblationBaseline()
  const parseProviders = resolveParseProviders()
  const rerankProvider = resolveRerankProvider()
  if (!rerankProvider) {
    throw new Error('缺少 DEEPSEEK_API_KEY / PARSE_GOLD_LLM_API_KEY（重排必需）')
  }

  const apiBase = resolveApiBase()
  const { token, source } = await resolveEmbedAccessToken()
  console.info(`[prototype] embed token source=${source} api=${apiBase}`)
  const embedClient = createWorkerEmbedClient(token, apiBase)
  const baseCorpus = buildRetrievalAblationCorpus()
  assertAblationCorpusHasNoEmbeddings(baseCorpus)
  console.info(`[prototype] embedding corpus fingerprint=${ablationCorpusFingerprint(baseCorpus)}`)
  const corpus = await embedCorpus(baseCorpus, texts => embedClient.embedTexts(texts))

  const legs: LegResult[] = []
  const deviations: string[] = []

  // GPT OpenRouter 适配记偏差
  const gptProv = parseProviders['gpt-6.2-sol']
  if (gptProv && !('skipped' in gptProv) && gptProv.keySource === 'OPENROUTER_API_KEY') {
    deviations.push(
      'P2 gpt-6.2-sol：无 OPENAI_API_KEY，改用 OPENROUTER_API_KEY + model `openai/gpt-6.2-sol`（OpenAI 兼容最小适配）'
    )
  }

  for (const legId of ['p1', 'gpt-6.2-sol', 'qwen4-max', 'hy4-flash'] as LegId[]) {
    if (!legsWanted.has(legId)) continue
    const prov = parseProviders[legId]
    if ('skipped' in prov && prov.skipped) {
      const skipped = emptyLegSkeleton(legId, legId)
      skipped.status = 'skipped_no_access'
      skipped.skipReason = prov.reason
      skipped.verdict = '无可用接入'
      legs.push(skipped)
      console.info(`[prototype] skip ${legId}: ${prov.reason}`)
      continue
    }
    console.info(`[prototype] run ${legId} parse=${prov.model} rerank=${rerankProvider.model}`)
    try {
      const leg = await runLeg({
        legId,
        parseProvider: prov,
        rerankProvider,
        corpus,
        embedClient
      })
      legs.push(leg)
    } catch (error) {
      const failed = emptyLegSkeleton(legId, prov.label)
      failed.status = 'skipped_no_conclusion'
      failed.skipReason = error instanceof Error ? error.message : String(error)
      failed.verdict = '无结论'
      legs.push(failed)
      deviations.push(`腿 ${legId} 运行中抛错停下该腿：${failed.skipReason}`)
      console.error(`[prototype] leg ${legId} failed:`, failed.skipReason)
    }
  }

  const p1 = legs.find(l => l.legId === 'p1' && l.status === 'ran') ?? null
  const p1Judgment = p1 ? judgeP1(p1, baseline) : null
  for (const leg of legs) {
    if (leg.legId === 'p1') {
      leg.verdict = p1Judgment?.overall ?? '无结论'
      continue
    }
    if (leg.status === 'ran' && p1) {
      leg.verdict = judgeP2(leg, p1)
      leg.verdictNote = '质量不低于 P1-deepseek 才值得考虑'
    }
  }

  const mappingGaps = [
    'Topic span 精确度无 gold → 无结论',
    '≥28 字无空格中文 mash 无专用 gold → 不测',
    '2000 行规模 / ANN：本批未测（语义池仍暴力扫表）',
    'BRIDGE 对照组不在本批',
    'noise 路径：`extension/src/core/recall/eval/noise-gateway-cases.ts` + `build-synth-noise-gateway-cases.ts`；must 门 116；原型无 Gate A，期望 intent!=recall'
  ]

  deviations.push(
    '检索 IR 走原型 live 解析（非消融固定 goldParsed），以便四步管线端到端对照；与消融「跳过 live NLU」设计不同，已在 IR 解读时计入理解方差'
  )
  deviations.push(
    `重排/解析超时分别为 ${RERANK_TIMEOUT_MS}/${PARSE_TIMEOUT_MS}ms（产品 CLUE_LLM_COMPLETE_TIMEOUT_MS=12000 对 50 候选过紧）`
  )
  deviations.push(
    'P1 deepseek 官方 $/1M 本批未核实 → 成本维以 LLM 调用次数与 tokens 为主，$ 标未估'
  )

  // Step 0 门禁数字由会话开头实测写入；此处补 HEAD / 工作区摘要供报告自洽
  let head = 'unknown'
  let gitStatusShort = ''
  try {
    const { execSync } = await import('node:child_process')
    head = execSync('git log -1 --oneline', { cwd: repoRoot, encoding: 'utf8' }).trim()
    gitStatusShort = execSync('git status --short', { cwd: repoRoot, encoding: 'utf8' }).trim()
  } catch {
    // ignore
  }
  const step0 = {
    HEAD: head,
    gitStatusShort: gitStatusShort || '（干净）',
    gitStatusLines: gitStatusShort ? gitStatusShort.split('\n').length : 0,
    reportDate: '2026-11-19',
    parsePromptVersion: PARSE_PROMPT_VERSION,
    corpusFingerprint: ablationCorpusFingerprint(baseCorpus),
    embedApi: apiBase,
    embedTokenSource: source,
    topKSemantic: TOP_K_SEMANTIC,
    titleClip: TITLE_CLIP,
    excerptClip: EXCERPT_CLIP,
    gatesFromSessionStep0: {
      testMust: 127,
      testRun: 1789,
      i18n: 817,
      worker: 211
    }
  }

  const updated = nowStampShanghai()
  const payload = {
    created,
    updated,
    step0,
    baseline,
    p1Judgment,
    legs: legs.map(l => ({
      ...l,
      parseProvider: l.parseProvider ? { ...l.parseProvider, apiKey: '***' } : undefined,
      rerankProvider: l.rerankProvider ? { ...l.rerankProvider, apiKey: '***' } : undefined
    })),
    mappingGaps,
    deviations,
    prompts: {
      parseSystem: PROTOTYPE_PARSE_SYSTEM_PROMPT,
      rerankSystem: RERANK_SYSTEM_PROMPT
    }
  }

  mkdirSync(dirname(OUT_JSON), { recursive: true })
  writeFileSync(OUT_JSON, JSON.stringify(payload, null, 2))
  writeFileSync(
    OUT_MD,
    renderMd({
      created,
      updated,
      step0,
      baseline,
      legs,
      p1Judgment,
      deviations,
      mappingGaps
    })
  )
  console.info(`[prototype] wrote ${OUT_MD}`)
  console.info(`[prototype] wrote ${OUT_JSON}`)
}
