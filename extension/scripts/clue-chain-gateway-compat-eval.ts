/**
 * Stage 1 · CF Gateway compat 候选模型对照（仅 eval harness，不进产品主路径）。
 *
 * 用法：
 *   cd extension && bun scripts/clue-chain-gateway-compat-eval.mjs --arm=deepseek
 *   cd extension && bun scripts/clue-chain-gateway-compat-eval.mjs --arm=gemini
 *
 * 环境：.env.shared.local 的 DEEPSEEK_API_KEY / GOOGLE_AI_API_KEY；
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

/** 与 Stage 2 harness 同固定时钟，两组可比。 */
const FIXED_NOW_MS = Date.parse('2026-07-25T12:00:00.000Z')

type EvalArm = 'deepseek' | 'gemini'

interface ArmConfig {
  arm: EvalArm
  model: string
  /** openai-compatible-chat profile：决定请求体字段（google ≡ dashscope：max_tokens、不发思考）。 */
  bodyCompat: OpenAiCompatibleChatCompat
  apiKeyEnv: 'DEEPSEEK_API_KEY' | 'GOOGLE_AI_API_KEY'
  /** 每分钟最大 HTTP 请求数；null = 不限速。 */
  maxRpm: number | null
  label: string
}

const ARM_CONFIGS: Record<EvalArm, ArmConfig> = {
  deepseek: {
    arm: 'deepseek',
    model: 'deepseek/deepseek-flash',
    bodyCompat: 'deepseek',
    apiKeyEnv: 'DEEPSEEK_API_KEY',
    maxRpm: null,
    label: 'control-deepseek-flash'
  },
  gemini: {
    arm: 'gemini',
    model: 'google-ai-studio/gemini-3.5-flash-lite',
    // google 体：max_tokens、omit thinking —— 与 dashscope/perplexity profile 等价
    bodyCompat: 'dashscope',
    apiKeyEnv: 'GOOGLE_AI_API_KEY',
    maxRpm: 12,
    label: 'candidate-gemini-3.5-flash-lite'
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
  if (raw === 'deepseek' || raw === 'gemini') return raw
  throw new Error('须指定 --arm=deepseek|gemini 或 COMPAT_EVAL_ARM')
}

function percentile(sorted: number[], p: number): number | null {
  if (sorted.length === 0) return null
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1))
  return sorted[idx]!
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
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
}

/** 滑动窗口 RPM 限速 + 429 退避（最多再试 2 次）。 */
function createGatewayCompatCompleter(input: {
  completionsUrl: string
  apiKey: string
  model: string
  bodyCompat: OpenAiCompatibleChatCompat
  maxRpm: number | null
  gatewayToken?: string
  meter: RequestMeter
  /** eval 专用 fetch 超时（毫秒）；默认 60s，避免限速排队后 12s 产品预算误杀。 */
  fetchTimeoutMs: number
}): LlmChatCompleter {
  const recentStarts: number[] = []

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
      body: buildBody(messages, temperature, 400),
      signal: AbortSignal.timeout(input.fetchTimeoutMs)
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
    input.meter.latenciesMs.push(latencyMs)
    input.meter.httpCalls += 1

    if (!response.ok) {
      const rawMessage = payload.error?.message || response.statusText || 'chat_completions_failed'
      const err = new Error(rawMessage) as Error & { status?: number }
      err.status = response.status
      throw err
    }

    const usage = parseLlmChatUsage(payload.usage)
    if (usage.promptTokens == null && usage.completionTokens == null && usage.totalTokens == null) {
      input.meter.usageMissing += 1
    } else {
      input.meter.promptTokens += usage.promptTokens ?? 0
      input.meter.completionTokens += usage.completionTokens ?? 0
      input.meter.totalTokens +=
        usage.totalTokens ?? (usage.promptTokens ?? 0) + (usage.completionTokens ?? 0)
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
        const status = (error as { status?: number })?.status
        const msg = error instanceof Error ? error.message : String(error)
        const is429 = status === 429 || /\b429\b|rate.?limit|too many requests/i.test(msg)
        if (!is429 || attempt >= 2) {
          throw error
        }
        input.meter.retries429 += 1
        const backoffMs = 5_000 * (attempt + 1)
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
  const timeoutMs = Number(process.env.CLUE_CHAIN_TIMEOUT_MS?.trim() || 60_000)
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
    jsonEmptyOrFail: 0
  }

  const complete = createGatewayCompatCompleter({
    completionsUrl,
    apiKey,
    model: cfg.model,
    bodyCompat: cfg.bodyCompat,
    maxRpm: cfg.maxRpm,
    gatewayToken,
    meter,
    fetchTimeoutMs
  })

  console.info(
    `[compat-eval] arm=${arm} model=${cfg.model} bodyCompat=${cfg.bodyCompat} key=${cfg.apiKeyEnv} rpm=${cfg.maxRpm ?? 'unlimited'} cases=${cases.length} head=${head.slice(0, 8)} nowMs=${nowMs} fetchTimeoutMs=${fetchTimeoutMs}`
  )
  console.info(`[compat-eval] endpoint=compat/chat/completions cache=skip useCache=cleared`)

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
            jsonEmptyOrFail: meter.jsonEmptyOrFail
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

  const parseRuns = await runClueChainParseBatch({
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
      // 边跑边存，便于限速长跑中断后续跑
      const merged = new Map(parseCheckpoint)
      // onCaseDone 在 batch 内顺序推入；用当前已输出列表不便，落盘整批已完成靠下方最终 + 周期性
    }
  })

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
    httpCalls: meter.httpCalls,
    retries429: meter.retries429,
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
