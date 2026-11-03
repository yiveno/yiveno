/**
 * 离线对比：规则 parseRecallClue vs LLM → ParsedRecallClue（不接产品主路径）。
 *
 * 用法：
 *   cd extension && bun run parse-gold:llm
 *
 * 环境变量：
 *   PARSE_GOLD_LLM_API_KEY   可选显式覆盖；否则按 COMPAT 用 DEEPSEEK_/OPENAI_/DASHSCOPE_API_KEY
 *   PARSE_GOLD_LLM_BASE_URL  默认 https://api.deepseek.com
 *   PARSE_GOLD_LLM_MODEL     默认 deepseek-chat（可用 deepseek-v4-flash / qwen-flash）
 *   PARSE_GOLD_LLM_COMPAT    可选 deepseek|openai|dashscope（默认 deepseek）
 *   PARSE_GOLD_LLM_GATE      可选 must|stretch|all（默认 all）
 *   PARSE_GOLD_LLM_JSON_OUT  可选；机器可读报告路径（相对 cwd 或绝对）
 *   PARSE_GOLD_GIT_SHA       可选；不设则尝试 `git rev-parse HEAD`
 *   PARSE_GOLD_LLM_GATE_MODE  absolute（默认：任一 must 回归 → exit 2）|
 *                             vs_baseline（仅相对基线**新增**回归才红；已知残差绿）
 *   PARSE_GOLD_LLM_BASELINE_PATH  vs_baseline 时快照路径（相对仓库根或绝对）；
 *                             未设且 model=deepseek-v4-flash 时用默认 field-v1 快照
 */

import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, isAbsolute, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

import {
  compareMustRegressionsToBaseline,
  extractParseGoldBaselineSnapshot,
  formatParseGoldBaselineCompareSummary
} from '../src/core/recall/eval/compare-parse-gold-baseline'
import {
  compareParseGoldWithLlm,
  formatParseGoldCompareSummary
} from '../src/core/recall/eval/compare-parse-gold'
import { formatSlotAgreementAggregateSummary } from '../src/core/recall/eval/metrics'
import { PARSE_GOLD_CASES, type ParseGoldCase } from '../src/core/recall/eval/parse-gold-cases'
import { PARSE_GOLD_NOW_MS } from '../src/core/recall/eval/parse-gold-now'
import {
  buildParseGoldLlmJsonReport,
  serializeParseGoldLlmJsonReport,
  type ParseGoldCompleterCallMetric
} from '../src/core/recall/eval/parse-gold-llm-report'
import { clearLlmParseCache } from '../src/core/recall/understand/llm-parse-cache'
import {
  completeOpenAiCompatibleChatDetailed,
  resolveOpenAiCompatibleChatCompletionsUrl,
  type OpenAiCompatibleChatCompat
} from '../src/core/recall/understand/openai-compatible-chat'
import type { LlmChatCompleter } from '../src/core/recall/understand/parse-recall-clue-with-llm'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(scriptDir, '../..')

/** deepseek-v4-flash 默认对照快照（已知 must 31/35 残差）。 */
const DEFAULT_BASELINE_BY_MODEL: Record<string, string> = {
  'deepseek-v4-flash': 'docs/audits/snapshots/2026-10-30-parse-gold-deepseek-v4-flash-field-v1.json'
}

type GateMode = 'absolute' | 'vs_baseline'

function resolveGateMode(raw: string | undefined): GateMode {
  const mode = raw?.trim() || 'absolute'
  if (mode === 'absolute' || mode === 'vs_baseline') {
    return mode
  }
  throw new Error(`PARSE_GOLD_LLM_GATE_MODE 无效: ${mode}（用 absolute|vs_baseline）`)
}

function resolveBaselinePath(model: string, explicit: string | undefined): string {
  const raw = explicit?.trim()
  if (raw) {
    return isAbsolute(raw) ? raw : resolve(repoRoot, raw)
  }
  const fallback = DEFAULT_BASELINE_BY_MODEL[model]
  if (!fallback) {
    throw new Error(`vs_baseline 需要 PARSE_GOLD_LLM_BASELINE_PATH（model=${model} 无默认快照）`)
  }
  return resolve(repoRoot, fallback)
}

/** 从仓库根 .env*.local 注入缺失的环境变量（不覆盖已有）。 */
function loadLocalEnvFiles(): void {
  const roots = [resolve(scriptDir, '../..'), resolve(scriptDir, '..')]
  const names = ['.env.shared.local', '.env.development.local', '.env.local']
  for (const root of roots) {
    for (const name of names) {
      const path = resolve(root, name)
      if (!existsSync(path)) {
        continue
      }
      const text = readFileSync(path, 'utf8')
      for (const line of text.split('\n')) {
        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith('#')) {
          continue
        }
        const eq = trimmed.indexOf('=')
        if (eq <= 0) {
          continue
        }
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

/**
 * 按 compat 选厂商 Key，避免同文件里 DeepSeek Key 抢先打到百炼/OpenAI。
 * `PARSE_GOLD_LLM_API_KEY` 仍为显式覆盖（任意 compat）。
 */
function resolveApiKey(compat: OpenAiCompatibleChatCompat): {
  apiKey: string | undefined
  source: string | undefined
} {
  const explicit = process.env.PARSE_GOLD_LLM_API_KEY?.trim()
  if (explicit) {
    return { apiKey: explicit, source: 'PARSE_GOLD_LLM_API_KEY' }
  }
  if (compat === 'dashscope') {
    const key = process.env.DASHSCOPE_API_KEY?.trim()
    return { apiKey: key, source: key ? 'DASHSCOPE_API_KEY' : undefined }
  }
  if (compat === 'openai') {
    const key = process.env.OPENAI_API_KEY?.trim()
    return { apiKey: key, source: key ? 'OPENAI_API_KEY' : undefined }
  }
  const deepseek = process.env.DEEPSEEK_API_KEY?.trim()
  if (deepseek) {
    return { apiKey: deepseek, source: 'DEEPSEEK_API_KEY' }
  }
  return { apiKey: undefined, source: undefined }
}

function filterCases(gate: string | undefined): ParseGoldCase[] {
  if (!gate || gate === 'all') {
    return PARSE_GOLD_CASES
  }
  if (gate === 'must' || gate === 'stretch') {
    return PARSE_GOLD_CASES.filter(item => item.gate === gate)
  }
  throw new Error(`PARSE_GOLD_LLM_GATE 无效: ${gate}（用 must|stretch|all）`)
}

function resolveCompat(raw: string | undefined): OpenAiCompatibleChatCompat {
  const compat = raw?.trim() || 'deepseek'
  if (compat === 'deepseek' || compat === 'openai' || compat === 'dashscope') return compat
  throw new Error('PARSE_GOLD_LLM_COMPAT invalid; use deepseek|openai|dashscope')
}

function resolveGitSha(): string {
  const fromEnv = process.env.PARSE_GOLD_GIT_SHA?.trim()
  if (fromEnv) {
    return fromEnv
  }
  const result = spawnSync('git', ['rev-parse', 'HEAD'], {
    cwd: repoRoot,
    encoding: 'utf8'
  })
  if (result.status === 0 && result.stdout.trim()) {
    return result.stdout.trim()
  }
  return 'MISSING'
}

function defaultJsonOutPath(model: string): string {
  const day = new Date().toISOString().slice(0, 10)
  const safeModel = model.replace(/[^a-zA-Z0-9._-]+/g, '_')
  return resolve(repoRoot, `docs/audits/snapshots/${day}-parse-gold-${safeModel}.json`)
}

function resolveJsonOutPath(model: string): string {
  const raw = process.env.PARSE_GOLD_LLM_JSON_OUT?.trim()
  if (!raw) {
    return defaultJsonOutPath(model)
  }
  return isAbsolute(raw) ? raw : resolve(process.cwd(), raw)
}

export async function runParseGoldLlmCli(): Promise<void> {
  loadLocalEnvFiles()

  const baseUrl = process.env.PARSE_GOLD_LLM_BASE_URL?.trim() || 'https://api.deepseek.com'
  const model =
    process.env.PARSE_GOLD_LLM_MODEL?.trim() ||
    process.env.AI_HOSTED_MODEL?.trim() ||
    'deepseek-chat'
  const gateFilter = process.env.PARSE_GOLD_LLM_GATE?.trim() || 'all'
  const cases = filterCases(gateFilter)
  const compat = resolveCompat(process.env.PARSE_GOLD_LLM_COMPAT)
  const { apiKey, source: apiKeySource } = resolveApiKey(compat)
  if (!apiKey) {
    const hint =
      compat === 'dashscope'
        ? 'DASHSCOPE_API_KEY 或 PARSE_GOLD_LLM_API_KEY'
        : compat === 'openai'
          ? 'OPENAI_API_KEY 或 PARSE_GOLD_LLM_API_KEY'
          : 'DEEPSEEK_API_KEY 或 PARSE_GOLD_LLM_API_KEY'
    console.error(`缺少 API Key：请设置 ${hint}`)
    process.exitCode = 1
    return
  }

  const temperature = 0
  const maxTokens = 400
  const disableThinking = true
  const gitSha = resolveGitSha()
  const jsonOut = resolveJsonOutPath(model)
  const command = `PARSE_GOLD_LLM_COMPAT=${compat} PARSE_GOLD_LLM_MODEL=${model} PARSE_GOLD_LLM_GATE=${gateFilter} bun run parse-gold:llm`
  const completionsUrl = resolveOpenAiCompatibleChatCompletionsUrl(baseUrl)

  console.info(
    `[parse-gold:llm] compat=${compat} model=${model} key=${apiKeySource} base=${baseUrl} path=${completionsUrl} cases=${cases.length} git=${gitSha.slice(0, 8)}`
  )

  // 独立进程本已空缓存；仍显式清空，防止同进程二次调用串模
  clearLlmParseCache()

  const callMetrics: ParseGoldCompleterCallMetric[] = []
  const complete: LlmChatCompleter = async messages => {
    const detailed = await completeOpenAiCompatibleChatDetailed(
      {
        apiKey,
        baseUrl,
        model,
        temperature,
        maxTokens,
        compat,
        disableThinking
      },
      messages
    )
    callMetrics.push({
      latencyMs: detailed.latencyMs,
      usage: detailed.usage
    })
    return detailed.text
  }

  const report = await compareParseGoldWithLlm({
    cases,
    complete,
    nowMs: PARSE_GOLD_NOW_MS,
    useCache: false
  })
  console.info(formatParseGoldCompareSummary(report))

  const capturedAt = new Date().toISOString()
  const jsonReport = buildParseGoldLlmJsonReport({
    compare: report,
    callMetrics,
    meta: {
      capturedAt,
      gitSha,
      model,
      baseUrl,
      compat,
      temperature,
      maxTokens,
      disableThinking,
      nowMsIso: new Date(PARSE_GOLD_NOW_MS).toISOString(),
      nowMs: PARSE_GOLD_NOW_MS,
      gateFilter,
      caseCount: cases.length,
      command,
      repoRoot
    }
  })
  console.info(formatSlotAgreementAggregateSummary(jsonReport.slotAgreement))

  mkdirSync(dirname(jsonOut), { recursive: true })
  writeFileSync(jsonOut, serializeParseGoldLlmJsonReport(jsonReport), 'utf8')
  const digest = createHash('sha256').update(readFileSync(jsonOut)).digest('hex').slice(0, 12)
  console.info(
    `[parse-gold:llm] json=${jsonOut} schema=${jsonReport.schemaVersion} slotProtocol=${jsonReport.slotAgreement.protocol} l1=${jsonReport.layers.L1_schema.passed}/${cases.length} sha256prefix=${digest}`
  )

  const authBlocked = report.llm.cases.some(item =>
    /authentication|unauthorized|invalid.*api.?key|401/i.test(item.detail)
  )
  if (authBlocked) {
    console.error(
      '[parse-gold:llm] API 鉴权失败：请更新 PARSE_GOLD_LLM_API_KEY（或厂商 Key）后重试'
    )
    process.exitCode = 1
    return
  }

  const gateMode = resolveGateMode(process.env.PARSE_GOLD_LLM_GATE_MODE)
  if (gateMode === 'vs_baseline') {
    let baselinePath: string
    try {
      baselinePath = resolveBaselinePath(model, process.env.PARSE_GOLD_LLM_BASELINE_PATH)
    } catch (error) {
      console.error(error instanceof Error ? error.message : error)
      process.exitCode = 1
      return
    }
    if (!existsSync(baselinePath)) {
      console.error(`[parse-gold:llm] 基线快照不存在: ${baselinePath}`)
      process.exitCode = 1
      return
    }
    let baselineRaw: unknown
    try {
      baselineRaw = JSON.parse(readFileSync(baselinePath, 'utf8')) as unknown
    } catch (error) {
      console.error(
        `[parse-gold:llm] 基线快照无法解析: ${baselinePath}`,
        error instanceof Error ? error.message : error
      )
      process.exitCode = 1
      return
    }
    let baseline
    try {
      baseline = extractParseGoldBaselineSnapshot(baselineRaw)
    } catch (error) {
      console.error(
        `[parse-gold:llm] 基线快照结构无效: ${baselinePath}`,
        error instanceof Error ? error.message : error
      )
      process.exitCode = 1
      return
    }
    if (baseline.model !== model) {
      console.warn(
        `[parse-gold:llm] 警告：基线 model=${baseline.model} 与本次 model=${model} 不一致；仍按回归 id 集合比较`
      )
    }
    const compared = compareMustRegressionsToBaseline({
      currentMustRegressedByLlm: report.mustRegressedByLlm,
      baseline
    })
    console.info(
      formatParseGoldBaselineCompareSummary(compared, {
        baselinePath,
        baselineMustScore: baseline.llmMustScore
      })
    )
    // 仅新增 must 回归才红；已知残差（如 31/35 那 4 条）绿
    if (!compared.passed) {
      process.exitCode = 2
    }
    return
  }

  // absolute：任一 must 回归 → exit 2（本地严门禁；无 key 的 PR CI 不跑本脚本）
  if (report.mustRegressedByLlm.length > 0) {
    process.exitCode = 2
  }
}

const isDirectBunRun =
  typeof process.argv[1] === 'string' && process.argv[1].includes('run-parse-gold-llm.ts')

if (isDirectBunRun) {
  runParseGoldLlmCli().catch(error => {
    console.error(error instanceof Error ? error.message : error)
    process.exit(1)
  })
}
