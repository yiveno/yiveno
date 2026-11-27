/**
 * Stage 1 · CF Gateway compat 候选模型对照（仅 eval harness，不进产品主路径）。
 *
 * 用法：
 *   cd extension && bun scripts/clue-chain-gateway-compat-eval.mjs --arm=deepseek
 *   cd extension && bun scripts/clue-chain-gateway-compat-eval.mjs --arm=gemini
 *   cd extension && bun scripts/clue-chain-gateway-compat-eval.mjs --arm=groq
 *
 * 环境：.env.shared.local 的 DEEPSEEK_API_KEY / GOOGLE_AI_API_KEY / GROQ_API_KEY；
 * Gateway 账号/id 从 worker/wrangler.toml vars 读（不打印）。
 */

import { execSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  DEFAULT_CLUE_CHAIN_FIXTURE_FILES,
  loadClueChainCasesFromFixtures
} from '../tests/eval/clue-chain/load-cases'
import {
  buildClueChainParseReport,
  formatClueChainReportConsole
} from '../tests/eval/clue-chain/report'
import { runClueChainParseBatch } from '../tests/eval/clue-chain/run-parse-case'
import { scoreClueChainCase } from '../tests/eval/clue-chain/score-case'
import { judgeTopicSemantic } from '../tests/eval/clue-chain/topic-judge'
import type {
  ClueChainParseReport,
  ClueChainParseRunCase,
  ClueChainTopicJudgeResult
} from '../tests/eval/clue-chain/types'
import { clearLlmParseCache } from '../src/core/recall/understand/llm-parse-cache'
import { parseLlmChatUsage } from '../src/core/recall/understand/llm-chat-usage'
import type { LlmChatCompleter } from '../src/core/recall/understand/parse-recall-clue-with-llm'
import type { OpenAiCompatibleChatCompat } from '../src/core/recall/understand/openai-compatible-chat'
import { resolveRecallTopic } from '../src/core/recall/recall-topic'
import { understandRecallClue } from '../src/core/recall/understand/understand-recall-clue'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const extensionRoot = resolve(scriptDir, '..')
const repoRoot = resolve(extensionRoot, '..')
const runsDir = resolve(extensionRoot, 'tests/eval/clue-chain/runs')

/** 与 Stage 2 harness 同固定时钟，三组可比。 */
const FIXED_NOW_MS = Date.parse('2026-07-25T12:00:00.000Z')

/**
 * Groq GPT-OSS：官方最小 reasoning = `low`（无 `none`）；字段为 `max_completion_tokens`。
 * 见 https://console.groq.com/docs/reasoning （2026-11-27 核实）。
 * 既有两组 maxTokens=400；低 reasoning 会吃 completion 预算，故抬到 1024，报告中记差异。
 */
const GROQ_MAX_COMPLETION_TOKENS = 1024
const GROQ_REASONING_EFFORT = 'low' as const
/** 免费层 TPM 8K 紧约束下的分钟预算上限（预留余量）。 */
const GROQ_TPM_BUDGET = 7_000
/** 发请求前预占估算（入+出）；回包后按 usage 校正。 */
const GROQ_ESTIMATED_TOKENS_PER_CALL = 3_200

type EvalArm = 'deepseek' | 'gemini' | 'groq'

/** eval-only 体型：`groq` 不进产品 OpenAiCompatibleChatCompat。 */
type EvalBodyCompat = OpenAiCompatibleChatCompat | 'groq'

interface ArmConfig {
  arm: EvalArm
  model: string
  /** 请求体字段分档（google ≡ dashscope；groq = GPT-OSS 官方字段）。 */
  bodyCompat: EvalBodyCompat
  apiKeyEnv: 'DEEPSEEK_API_KEY' | 'GOOGLE_AI_API_KEY' | 'GROQ_API_KEY'
  /** 每分钟最大 HTTP 请求数；null = 不按 RPM 限速。 */
  maxRpm: number | null
  /** 分钟窗口 token 预算；null = 不按 TPM 限速。 */
  maxTpmBudget: number | null
  /** 发请求前预占 token 估算；仅 maxTpmBudget 生效时用。 */
  estimatedTokensPerCall: number | null
  /** completion 上限；未设则 400（与既有两组一致）。 */
  maxCompletionTokens: number
  label: string
}

const ARM_CONFIGS: Record<EvalArm, ArmConfig> = {
  deepseek: {
    arm: 'deepseek',
    model: 'deepseek/deepseek-flash',
    bodyCompat: 'deepseek',
    apiKeyEnv: 'DEEPSEEK_API_KEY',
    maxRpm: null,
    maxTpmBudget: null,
    estimatedTokensPerCall: null,
    maxCompletionTokens: 400,
    label: 'control-deepseek-flash'
  },
  gemini: {
    arm: 'gemini',
    model: 'google-ai-studio/gemini-3.5-flash-lite',
    // google 体：max_tokens、omit thinking —— 与 dashscope/perplexity profile 等价
    bodyCompat: 'dashscope',
    apiKeyEnv: 'GOOGLE_AI_API_KEY',
    maxRpm: 12,
    maxTpmBudget: null,
    estimatedTokensPerCall: null,
    maxCompletionTokens: 400,
    label: 'candidate-gemini-3.5-flash-lite'
  },
  groq: {
    arm: 'groq',
    model: 'groq/openai/gpt-oss-120b',
    bodyCompat: 'groq',
    apiKeyEnv: 'GROQ_API_KEY',
    // 约 ≤2 HTTP/min，与 7K TPM 预算同向；硬约束仍走 maxTpmBudget
    maxRpm: 2,
    maxTpmBudget: GROQ_TPM_BUDGET,
    estimatedTokensPerCall: GROQ_ESTIMATED_TOKENS_PER_CALL,
    maxCompletionTokens: GROQ_MAX_COMPLETION_TOKENS,
    label: 'candidate-groq-gpt-oss-120b'
  }
}

function loadLocalEnvFiles(): void {
  const roots = [repoRoot, extensionRoot]
  const names = ['.env.shared.local', '.env.development.local', '.env.local', 'worker/.dev.vars']
  for (const root of roots) {
    for (const name of names) {
      const path = resolve(root === repoRoot ? repoRoot : root, name)
      // worker/.dev.vars 相对 repoRoot
      const full =
        name.startsWith('worker/') && root === repoRoot
          ? resolve(repoRoot, name)
          : resolve(root, name)
      if (!existsSync(full)) continue
      const text = readFileSync(full, 'utf8')
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
        if (process.env[key] === undefined) {
          process.env[key] = value
        }
      }
    }
  }
}

/** 从 wrangler.toml [vars] 读 Gateway 账号（不打印值）。 */
function readGatewayIdsFromWrangler(): { accountId: string; gatewayId: string } {
  const path = resolve(repoRoot, 'worker/wrangler.toml')
  const text = readFileSync(path, 'utf8')
  const account =
    process.env.AI_GATEWAY_ACCOUNT_ID?.trim() ||
    text.match(/^\s*AI_GATEWAY_ACCOUNT_ID\s*=\s*"([^"]+)"/m)?.[1]
  const gateway =
    process.env.AI_GATEWAY_ID?.trim() || text.match(/^\s*AI_GATEWAY_ID\s*=\s*"([^"]+)"/m)?.[1]
  if (!account || !gateway) {
    throw new Error('缺 AI_GATEWAY_ACCOUNT_ID / AI_GATEWAY_ID（wrangler vars 或 env）')
  }
  return { accountId: account, gatewayId: gateway }
}

function resolveGitHead(): string {
  try {
    return execSync('git rev-parse HEAD', { cwd: repoRoot, encoding: 'utf8' }).trim()
  } catch {
    return 'unknown'
  }
}

function parseArm(): EvalArm {
  const arg = process.argv.find(a => a.startsWith('--arm='))?.slice('--arm='.length)
  const env = process.env.COMPAT_EVAL_ARM?.trim()
  const raw = arg || env || ''
  if (raw === 'deepseek' || raw === 'gemini' || raw === 'groq') return raw
  throw new Error('须指定 --arm=deepseek|gemini|groq 或 COMPAT_EVAL_ARM')
}

function percentile(sorted: number[], p: number): number | null {
  if (sorted.length === 0) return null
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1))
  return sorted[idx]!
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

interface RateLimitSnapshot {
  at: string
  attempt: number
  status: number
  retryAfter: string | null
  limitRequests: string | null
  remainingRequests: string | null
  resetRequests: string | null
  limitTokens: string | null
  remainingTokens: string | null
  resetTokens: string | null
  errorPreview: string
}

interface RequestMeter {
  latenciesMs: number[]
  promptTokens: number
  completionTokens: number
  totalTokens: number
  usageMissing: number
  httpCalls: number
  retries429: number
  jsonEmptyOrFail: number
  rateLimitEvents: RateLimitSnapshot[]
}

class DailyQuotaExhaustedError extends Error {
  readonly kind = 'daily_quota_exhausted' as const
  constructor(message: string) {
    super(message)
    this.name = 'DailyQuotaExhaustedError'
  }
}

function isDailyQuotaMessage(message: string): boolean {
  return /tokens?\s*per\s*day|TPD|daily\s*(token|quota|limit)|requests?\s*per\s*day|RPD|per day/i.test(
    message
  )
}

function readRateLimitHeaders(
  response: Response
): Omit<RateLimitSnapshot, 'at' | 'attempt' | 'status' | 'errorPreview'> {
  return {
    retryAfter: response.headers.get('retry-after'),
    limitRequests: response.headers.get('x-ratelimit-limit-requests'),
    remainingRequests: response.headers.get('x-ratelimit-remaining-requests'),
    resetRequests: response.headers.get('x-ratelimit-reset-requests'),
    limitTokens: response.headers.get('x-ratelimit-limit-tokens'),
    remainingTokens: response.headers.get('x-ratelimit-remaining-tokens'),
    resetTokens: response.headers.get('x-ratelimit-reset-tokens')
  }
}

/** 滑动窗口 RPM / TPM 限速 + 429 退避（最多再试 2 次）。 */
function createGatewayCompatCompleter(input: {
  completionsUrl: string
  apiKey: string
  model: string
  bodyCompat: EvalBodyCompat
  maxRpm: number | null
  maxTpmBudget: number | null
  estimatedTokensPerCall: number | null
  maxCompletionTokens: number
  gatewayToken?: string
  meter: RequestMeter
  /** eval 专用 fetch 超时（毫秒）；默认 60s，避免限速排队后 12s 产品预算误杀。 */
  fetchTimeoutMs: number
}): LlmChatCompleter {
  const recentStarts: number[] = []
  const tokenWindow: Array<{ at: number; tokens: number }> = []

  async function waitForRpmSlot(): Promise<void> {
    if (input.maxRpm == null || input.maxRpm <= 0) return
    for (;;) {
      const now = Date.now()
      while (recentStarts.length > 0 && now - recentStarts[0]! >= 60_000) {
        recentStarts.shift()
      }
      if (recentStarts.length < input.maxRpm) {
        recentStarts.push(now)
        return
      }
      const waitMs = 60_000 - (now - recentStarts[0]!) + 50
      await sleep(Math.max(waitMs, 250))
    }
  }

  async function waitForTpmSlot(estimate: number): Promise<number> {
    if (input.maxTpmBudget == null || input.maxTpmBudget <= 0) return -1
    for (;;) {
      const now = Date.now()
      while (tokenWindow.length > 0 && now - tokenWindow[0]!.at >= 60_000) {
        tokenWindow.shift()
      }
      const used = tokenWindow.reduce((sum, row) => sum + row.tokens, 0)
      if (used + estimate <= input.maxTpmBudget) {
        tokenWindow.push({ at: now, tokens: estimate })
        return tokenWindow.length - 1
      }
      const waitMs = 60_000 - (now - tokenWindow[0]!.at) + 50
      console.info(
        `[compat-eval] TPM 预算等待 ${Math.round(waitMs)}ms（used=${used}+est=${estimate} > budget=${input.maxTpmBudget}）`
      )
      await sleep(Math.max(waitMs, 500))
    }
  }

  function settleTokenReservation(index: number, actualTokens: number): void {
    if (index < 0 || index >= tokenWindow.length) return
    tokenWindow[index] = { ...tokenWindow[index]!, tokens: Math.max(1, actualTokens) }
  }

  function buildBody(
    messages: Array<{ role: string; content: string }>,
    temperature: number,
    maxTokens: number
  ): string {
    const base = {
      model: input.model,
      messages,
      temperature
    }
    if (input.bodyCompat === 'groq') {
      // Groq GPT-OSS：官方最小 reasoning_effort=low；max_completion_tokens；隐藏 reasoning 以利 JSON
      return JSON.stringify({
        ...base,
        max_completion_tokens: maxTokens,
        reasoning_effort: GROQ_REASONING_EFFORT,
        include_reasoning: false
      })
    }
    if (input.bodyCompat === 'openai') {
      return JSON.stringify({
        ...base,
        max_completion_tokens: maxTokens,
        reasoning_effort: 'none'
      })
    }
    if (input.bodyCompat === 'dashscope' || input.bodyCompat === 'perplexity') {
      return JSON.stringify({ ...base, max_tokens: maxTokens })
    }
    // deepseek
    return JSON.stringify({
      ...base,
      max_tokens: maxTokens,
      thinking: { type: 'disabled' }
    })
  }

  async function once(
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
    temperature: number
  ): Promise<string> {
    await waitForRpmSlot()
    const estimate = input.estimatedTokensPerCall ?? 0
    const reserveIndex = await waitForTpmSlot(estimate)
    const headers: Record<string, string> = {
      'content-type': 'application/json',
      authorization: `Bearer ${input.apiKey}`,
      'user-agent': 'yiveno-eval/gateway-compat',
      'cf-aig-collect-log-payload': 'false',
      'cf-aig-skip-cache': 'true'
    }
    if (input.gatewayToken) {
      headers['cf-aig-authorization'] = `Bearer ${input.gatewayToken}`
    }

    const startedAt = Date.now()
    const response = await fetch(input.completionsUrl, {
      method: 'POST',
      headers,
      body: buildBody(messages, temperature, input.maxCompletionTokens),
      signal: AbortSignal.timeout(input.fetchTimeoutMs)
    })
    const rateHeaders = readRateLimitHeaders(response)
    const payload = (await response.json().catch(() => ({}))) as {
      choices?: Array<{
        finish_reason?: string
        message?: { content?: string; reasoning_content?: string; reasoning?: string }
      }>
      usage?: {
        prompt_tokens?: number
        completion_tokens?: number
        total_tokens?: number
      }
      error?: { message?: string }
    }
    const latencyMs = Date.now() - startedAt
    input.meter.latenciesMs.push(latencyMs)
    input.meter.httpCalls += 1

    if (!response.ok) {
      const rawMessage = payload.error?.message || response.statusText || 'chat_completions_failed'
      settleTokenReservation(reserveIndex, 0)
      const snapshot: RateLimitSnapshot = {
        at: new Date().toISOString(),
        attempt: input.meter.retries429 + 1,
        status: response.status,
        ...rateHeaders,
        errorPreview: rawMessage.slice(0, 240)
      }
      if (response.status === 429) {
        input.meter.rateLimitEvents.push(snapshot)
        console.warn(
          `[compat-eval] 429 headers remaining-tokens=${rateHeaders.remainingTokens} reset-tokens=${rateHeaders.resetTokens} remaining-requests=${rateHeaders.remainingRequests} reset-requests=${rateHeaders.resetRequests} retry-after=${rateHeaders.retryAfter}`
        )
      }
      if (response.status === 429 && isDailyQuotaMessage(rawMessage)) {
        throw new DailyQuotaExhaustedError(rawMessage)
      }
      const err = new Error(rawMessage) as Error & {
        status?: number
        rateLimit?: Omit<RateLimitSnapshot, 'at' | 'attempt' | 'status' | 'errorPreview'>
      }
      err.status = response.status
      err.rateLimit = rateHeaders
      throw err
    }

    const usage = parseLlmChatUsage(payload.usage)
    const actualTotal =
      usage.totalTokens ?? (usage.promptTokens ?? 0) + (usage.completionTokens ?? 0)
    settleTokenReservation(reserveIndex, actualTotal > 0 ? actualTotal : estimate || 1)
    if (usage.promptTokens == null && usage.completionTokens == null && usage.totalTokens == null) {
      input.meter.usageMissing += 1
    } else {
      input.meter.promptTokens += usage.promptTokens ?? 0
      input.meter.completionTokens += usage.completionTokens ?? 0
      input.meter.totalTokens += actualTotal
    }

    const message = payload.choices?.[0]?.message
    const text = message?.content?.trim() || message?.reasoning_content?.trim()
    if (!text) {
      input.meter.jsonEmptyOrFail += 1
      throw new Error(`chat_empty_response:${payload.choices?.[0]?.finish_reason ?? 'unknown'}`)
    }
    return text
  }

  return async (messages, options) => {
    const temperature = options.temperature ?? 0
    let lastError: unknown
    for (let attempt = 0; attempt <= 2; attempt += 1) {
      try {
        return await once(messages, temperature)
      } catch (error) {
        lastError = error
        if (error instanceof DailyQuotaExhaustedError) {
          throw error
        }
        const status = (error as { status?: number })?.status
        const msg = error instanceof Error ? error.message : String(error)
        const is429 = status === 429 || /\b429\b|rate.?limit|too many requests/i.test(msg)
        if (!is429 || attempt >= 2) {
          throw error
        }
        input.meter.retries429 += 1
        const rateLimit = (error as { rateLimit?: RateLimitSnapshot })?.rateLimit
        const retryAfterSec = Number(rateLimit?.retryAfter)
        const backoffMs =
          Number.isFinite(retryAfterSec) && retryAfterSec > 0
            ? Math.ceil(retryAfterSec * 1000) + 250
            : 5_000 * (attempt + 1)
        console.warn(`[compat-eval] 429 退避 ${backoffMs}ms（第 ${attempt + 1} 次重试）`)
        await sleep(backoffMs)
      }
    }
    throw lastError instanceof Error ? lastError : new Error(String(lastError))
  }
}

function withResolvedTopicTerms(run: ClueChainParseRunCase): ClueChainParseRunCase {
  if (!run.parsed) return run
  const topicTerms = resolveRecallTopic(run.parsed)?.terms ?? run.parsed.contentTerms ?? []
  if (
    topicTerms.length === run.topicTermsActual.length &&
    topicTerms.every((term, index) => term === run.topicTermsActual[index])
  ) {
    return run
  }
  return { ...run, topicTermsActual: topicTerms }
}

function stripParsedEmbedding(report: ClueChainParseReport): ClueChainParseReport {
  return {
    ...report,
    cases: report.cases.map(row => {
      if (!row.run.parsed?.topic?.embedding) return row
      const { embedding: _embedding, ...topicRest } = row.run.parsed.topic
      return {
        ...row,
        run: {
          ...row.run,
          parsed: {
            ...row.run.parsed,
            topic: topicRest
          }
        }
      }
    })
  }
}

export async function runClueChainGatewayCompatEval(): Promise<void> {
  loadLocalEnvFiles()
  clearLlmParseCache()
  mkdirSync(runsDir, { recursive: true })

  const arm = parseArm()
  const cfg = ARM_CONFIGS[arm]
  const apiKey = process.env[cfg.apiKeyEnv]?.trim()
  if (!apiKey) {
    throw new Error(`缺 ${cfg.apiKeyEnv}`)
  }

  const { accountId, gatewayId } = readGatewayIdsFromWrangler()
  const completionsUrl = `https://gateway.ai.cloudflare.com/v1/${accountId}/${gatewayId}/compat/chat/completions`
  const gatewayToken = process.env.AI_GATEWAY_TOKEN?.trim() || undefined

  const head = resolveGitHead()
  const startedAt = new Date().toISOString()
  const { cases: allCases, fixtureFiles } = loadClueChainCasesFromFixtures(
    DEFAULT_CLUE_CHAIN_FIXTURE_FILES
  )
  const limitRaw = process.env.CLUE_CHAIN_LIMIT?.trim()
  const limit = limitRaw ? Number(limitRaw) : allCases.length
  if (!Number.isFinite(limit) || limit <= 0) {
    throw new Error(`CLUE_CHAIN_LIMIT 无效: ${limitRaw}`)
  }
  const cases = allCases.slice(0, limit)
  const nowMs = Number(process.env.CLUE_CHAIN_NOW_MS?.trim() || FIXED_NOW_MS)
  // Groq 2 RPM / TPM 预算排队会使单条 understand（含 chitchat 二次调用）远超 60s；
  // 未设环境变量时默认 5min，避免限速等待被误记为模型超时。
  const defaultTimeoutMs = cfg.arm === 'groq' ? 300_000 : 60_000
  const timeoutMs = Number(process.env.CLUE_CHAIN_TIMEOUT_MS?.trim() || defaultTimeoutMs)
  const maxAttempts = Number(process.env.CLUE_CHAIN_MAX_ATTEMPTS?.trim() || 2)
  const fetchTimeoutMs = Number(process.env.COMPAT_EVAL_FETCH_TIMEOUT_MS?.trim() || 60_000)
  const checkpointPath = resolve(runsDir, `checkpoint-compat-${cfg.arm}.json`)
  const resume = process.env.CLUE_CHAIN_RESUME === '1'

  const meter: RequestMeter = {
    latenciesMs: [],
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
    usageMissing: 0,
    httpCalls: 0,
    retries429: 0,
    jsonEmptyOrFail: 0,
    rateLimitEvents: []
  }

  const complete = createGatewayCompatCompleter({
    completionsUrl,
    apiKey,
    model: cfg.model,
    bodyCompat: cfg.bodyCompat,
    maxRpm: cfg.maxRpm,
    maxTpmBudget: cfg.maxTpmBudget,
    estimatedTokensPerCall: cfg.estimatedTokensPerCall,
    maxCompletionTokens: cfg.maxCompletionTokens,
    gatewayToken,
    meter,
    fetchTimeoutMs
  })

  console.info(
    `[compat-eval] arm=${arm} model=${cfg.model} bodyCompat=${cfg.bodyCompat} key=${cfg.apiKeyEnv} rpm=${cfg.maxRpm ?? 'unlimited'} tpmBudget=${cfg.maxTpmBudget ?? 'unlimited'} maxCompletionTokens=${cfg.maxCompletionTokens} cases=${cases.length} head=${head.slice(0, 8)} nowMs=${nowMs} fetchTimeoutMs=${fetchTimeoutMs}`
  )
  console.info(`[compat-eval] endpoint=compat/chat/completions cache=skip useCache=cleared`)
  if (cfg.arm === 'groq') {
    console.info(
      `[compat-eval] groq body: reasoning_effort=${GROQ_REASONING_EFFORT} include_reasoning=false max_completion_tokens=${GROQ_MAX_COMPLETION_TOKENS} (既有两组=400)`
    )
  }

  type CheckpointShape = {
    parseRuns?: ClueChainParseRunCase[]
    topicJudges?: Array<[string, ClueChainTopicJudgeResult]>
    meterPartial?: Partial<RequestMeter>
  }
  let checkpoint: CheckpointShape = {}
  if (resume && existsSync(checkpointPath)) {
    checkpoint = JSON.parse(readFileSync(checkpointPath, 'utf8')) as CheckpointShape
    console.info(
      `[compat-eval] resume checkpoint parse=${checkpoint.parseRuns?.length ?? 0} judges=${checkpoint.topicJudges?.length ?? 0}`
    )
    if (checkpoint.meterPartial?.latenciesMs) {
      meter.latenciesMs.push(...checkpoint.meterPartial.latenciesMs)
      meter.promptTokens += checkpoint.meterPartial.promptTokens ?? 0
      meter.completionTokens += checkpoint.meterPartial.completionTokens ?? 0
      meter.totalTokens += checkpoint.meterPartial.totalTokens ?? 0
      meter.usageMissing += checkpoint.meterPartial.usageMissing ?? 0
      meter.httpCalls += checkpoint.meterPartial.httpCalls ?? 0
      meter.retries429 += checkpoint.meterPartial.retries429 ?? 0
      meter.jsonEmptyOrFail += checkpoint.meterPartial.jsonEmptyOrFail ?? 0
      if (checkpoint.meterPartial.rateLimitEvents) {
        meter.rateLimitEvents.push(...checkpoint.meterPartial.rateLimitEvents)
      }
    }
  }

  const saveCheckpoint = (
    parseRuns: ClueChainParseRunCase[],
    topicJudges: Map<string, ClueChainTopicJudgeResult>
  ): void => {
    writeFileSync(
      checkpointPath,
      JSON.stringify(
        {
          updatedAt: new Date().toISOString(),
          parseRuns,
          topicJudges: [...topicJudges.entries()],
          meterPartial: {
            latenciesMs: meter.latenciesMs,
            promptTokens: meter.promptTokens,
            completionTokens: meter.completionTokens,
            totalTokens: meter.totalTokens,
            usageMissing: meter.usageMissing,
            httpCalls: meter.httpCalls,
            retries429: meter.retries429,
            jsonEmptyOrFail: meter.jsonEmptyOrFail,
            rateLimitEvents: meter.rateLimitEvents
          }
        },
        null,
        2
      ),
      'utf8'
    )
  }

  const parseCheckpoint = new Map<string, ClueChainParseRunCase>()
  if (checkpoint.parseRuns) {
    for (const run of checkpoint.parseRuns) {
      parseCheckpoint.set(run.id, run)
    }
  }

  let parseRuns: ClueChainParseRunCase[]
  try {
    parseRuns = await runClueChainParseBatch({
      cases,
      nowMs,
      maxAttempts,
      timeoutMs,
      checkpoint: parseCheckpoint,
      understand: (clue, options) =>
        understandRecallClue(clue, {
          nowMs: options.nowMs,
          complete
        }),
      onCaseDone: (result, index, total) => {
        const status = result.error ? `ERR ${result.error}` : `ok src=${result.source}`
        console.info(`[compat-eval] parse ${index + 1}/${total} id=${result.id} ${status}`)
        // 边跑边存：写入同一 Map，限速/TPD 中断后续跑
        parseCheckpoint.set(result.id, result)
        saveCheckpoint([...parseCheckpoint.values()], new Map(checkpoint.topicJudges ?? []))
      }
    })
  } catch (error) {
    if (error instanceof DailyQuotaExhaustedError) {
      const done = parseCheckpoint.size
      saveCheckpoint([...parseCheckpoint.values()], new Map(checkpoint.topicJudges ?? []))
      console.error(
        `[compat-eval] TPD/日配额耗尽，已 checkpoint。parse 已完成 ${done}/${cases.length}。用 CLUE_CHAIN_RESUME=1 续跑。msg=${error.message}`
      )
      process.exitCode = 2
      return
    }
    throw error
  }

  const enrichedRuns = parseRuns.map(withResolvedTopicTerms)
  const topicJudges = new Map<string, ClueChainTopicJudgeResult>(checkpoint.topicJudges ?? [])
  saveCheckpoint(enrichedRuns, topicJudges)

  for (let index = 0; index < enrichedRuns.length; index += 1) {
    const run = enrichedRuns[index]!
    if (topicJudges.has(run.id)) {
      console.info(
        `[compat-eval] judge ${index + 1}/${enrichedRuns.length} id=${run.id} resume-hit match=${topicJudges.get(run.id)!.match}`
      )
      continue
    }
    if (run.category === 'C') {
      topicJudges.set(run.id, { match: true, reason: 'C 类跳过 topic judge' })
      saveCheckpoint(enrichedRuns, topicJudges)
      continue
    }
    if (!run.parsed) {
      topicJudges.set(run.id, { match: false, reason: '无 parsed，跳过 judge' })
      saveCheckpoint(enrichedRuns, topicJudges)
      continue
    }
    try {
      const judge = await judgeTopicSemantic({
        clue: run.clue,
        expectedTopic: run.expected.topic,
        actualTopicTerms: run.topicTermsActual,
        complete
      })
      topicJudges.set(run.id, judge)
      console.info(
        `[compat-eval] judge ${index + 1}/${enrichedRuns.length} id=${run.id} match=${judge.match}`
      )
    } catch (error) {
      if (error instanceof DailyQuotaExhaustedError) {
        saveCheckpoint(enrichedRuns, topicJudges)
        console.error(
          `[compat-eval] TPD/日配额耗尽于 judge，已 checkpoint。judge 已完成 ${topicJudges.size}/${enrichedRuns.length}。用 CLUE_CHAIN_RESUME=1 续跑。msg=${error.message}`
        )
        process.exitCode = 2
        return
      }
      const message = error instanceof Error ? error.message : String(error)
      topicJudges.set(run.id, { match: false, reason: `judge 异常: ${message}` })
      console.warn(
        `[compat-eval] judge ${index + 1}/${enrichedRuns.length} id=${run.id} ERR ${message}`
      )
    }
    saveCheckpoint(enrichedRuns, topicJudges)
  }

  const rows = enrichedRuns.map(run => {
    const topicJudge = topicJudges.get(run.id) ?? null
    const score = scoreClueChainCase(run, topicJudge)
    return { run, score, topicJudge }
  })

  const finishedAt = new Date().toISOString()
  const report = stripParsedEmbedding(
    buildClueChainParseReport({
      head,
      startedAt,
      finishedAt,
      fixtureFiles,
      llm: {
        parseCompat: cfg.bodyCompat,
        parseModel: cfg.model,
        judgeModel: cfg.model,
        direct: false
      },
      rows
    })
  )

  // JSON 解析失败：LLM 路径失败降级（rules_fallback）或硬失败
  const jsonParseFailures = enrichedRuns.filter(
    run =>
      run.source === 'rules_fallback' ||
      (!run.parsed && !run.skipped) ||
      (run.error != null && /json|parse|empty_response/i.test(run.error))
  ).length

  const sortedLat = [...meter.latenciesMs].sort((a, b) => a - b)
  const metrics = {
    arm: cfg.arm,
    label: cfg.label,
    model: cfg.model,
    bodyCompat: cfg.bodyCompat,
    endpointKind: 'cloudflare-ai-gateway-compat',
    skipCacheHeader: true,
    parseCacheCleared: true,
    temperature: 0,
    nowMs,
    maxCompletionTokens: cfg.maxCompletionTokens,
    maxRpm: cfg.maxRpm,
    maxTpmBudget: cfg.maxTpmBudget,
    groqRequestBody:
      cfg.arm === 'groq'
        ? {
            reasoning_effort: GROQ_REASONING_EFFORT,
            include_reasoning: false,
            max_completion_tokens: GROQ_MAX_COMPLETION_TOKENS,
            vsOtherArmsMaxTokens: 400,
            note: 'GPT-OSS 官方无 reasoning_effort=none；最小为 low。completion 抬到 1024 以免低 reasoning 占满 400 截断 JSON。'
          }
        : null,
    httpCalls: meter.httpCalls,
    retries429: meter.retries429,
    rateLimitEvents: meter.rateLimitEvents,
    jsonParseFailures,
    jsonEmptyOrFail: meter.jsonEmptyOrFail,
    latencyMs: {
      count: sortedLat.length,
      p50: percentile(sortedLat, 50),
      p95: percentile(sortedLat, 95),
      max: sortedLat.length ? sortedLat[sortedLat.length - 1]! : null
    },
    tokens: {
      prompt: meter.promptTokens,
      completion: meter.completionTokens,
      total: meter.totalTokens,
      usageMissingCalls: meter.usageMissing
    },
    summary: report.summary,
    clusters: report.clusters
  }

  const stamp = finishedAt.replace(/[:.]/g, '-').replace('T', '_').slice(0, 19)
  const outPath = resolve(runsDir, `run-compat-${cfg.label}_${stamp}_${head.slice(0, 8)}.json`)
  const payload = {
    ...report,
    compatEval: metrics
  }
  writeFileSync(outPath, JSON.stringify(payload, null, 2), 'utf8')
  writeFileSync(
    resolve(runsDir, `latest-compat-${cfg.arm}.json`),
    JSON.stringify(payload, null, 2),
    'utf8'
  )

  console.info(formatClueChainReportConsole(report))
  console.info(
    `[compat-eval] metrics jsonParseFailures=${jsonParseFailures} p50=${metrics.latencyMs.p50} p95=${metrics.latencyMs.p95} tokens=${meter.promptTokens}/${meter.completionTokens} retries429=${meter.retries429}`
  )
  console.info(`[compat-eval] wrote ${outPath}`)
}
