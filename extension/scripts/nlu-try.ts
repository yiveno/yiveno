/**
 * Recall 流水线 · 理解阶段试跑（NLU）。
 *
 * 只测「线索 → ParsedRecallClue」这一段，但必须走产品同款编排：
 *   Side Panel / Hybrid → `understandRecallClue`（噪音网关 → 模式 → LLM|规则 → 降级）
 *
 * 用法：
 *   cd extension && bun run nlu:try -- "last week coffee bookmark"
 *   cd extension && bun run nlu:try:rules -- "…"   # 强制规则（lexical）
 *
 * Completer（有 Key 时）：与 Settings 开发直连 `yiveno.dev.clueLlm` 同源工厂
 * `createOpenAiCompatibleCompleter`（非另写一套解析）。Node CLI 读不到 Chrome 登录态，
 * 故不走托管 `/api/ai/hosted/complete`；要测托管配额请用本机扩展 Side Panel。
 *
 * 环境变量（可选）：
 *   PARSE_GOLD_LLM_API_KEY | DEEPSEEK_API_KEY | OPENAI_API_KEY | DASHSCOPE_API_KEY
 *   PARSE_GOLD_LLM_BASE_URL / PARSE_GOLD_LLM_MODEL / PARSE_GOLD_LLM_COMPAT
 *   NLU_TRY_NOW_MS — 固定时钟毫秒；缺省 = Date.now()
 *   NLU_TRY_FORCE_MODE=lexical — 强制规则（对齐 Omnibox forceMode）
 */

import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import type { ParsedRecallClue } from '../src/core/recall/parse-recall-clue-types'
import {
  resolveOpenAiCompatibleChatCompletionsUrl,
  type OpenAiCompatibleChatCompat
} from '../src/core/recall/understand/openai-compatible-chat'
import {
  createOpenAiCompatibleCompleter,
  type LlmChatCompleter
} from '../src/core/recall/understand/parse-recall-clue-with-llm'
import {
  understandRecallClue,
  type UnderstandRecallClueResult
} from '../src/core/recall/understand/understand-recall-clue'
import type { ClueUnderstandingMode } from '../src/core/recall/understand/select-clue-understanding-mode'
import type { NluTryNextStageHandoff, NluTryParsedSlotsView, NluTryReport } from './nlu-try-report'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(scriptDir, '../..')

/** 从仓库根 / extension 本地 env 注入缺失变量（不覆盖已有）。 */
function loadLocalEnvFiles(): void {
  const roots = [repoRoot, resolve(scriptDir, '..')]
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

function resolveCompat(raw: string | undefined): OpenAiCompatibleChatCompat {
  const compat = raw?.trim() || 'deepseek'
  if (compat === 'deepseek' || compat === 'openai' || compat === 'dashscope') {
    return compat
  }
  throw new Error('PARSE_GOLD_LLM_COMPAT invalid; use deepseek|openai|dashscope')
}

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

/**
 * 从 argv 取出线索正文。
 * 支持：`bun run nlu:try -- "…"`（bun 可能留下 `--`）与直接传参。
 */
function resolveClueFromArgv(argv: string[]): string | null {
  const args = argv.slice(2).filter(item => item !== '--')
  const joined = args.join(' ').trim()
  return joined.length > 0 ? joined : null
}

/** 终端可读槽位摘要（去掉 embedding 等大字段）。类型见 `NluTryParsedSlotsView`。 */
function formatParsedSlots(parsed: ParsedRecallClue): NluTryParsedSlotsView {
  return {
    timeLabel: parsed.timeRange?.label ?? null,
    timeRange: parsed.timeRange ? { from: parsed.timeRange.from, to: parsed.timeRange.to } : null,
    timeConfidence: parsed.timeConfidence ?? null,
    objectTypes: parsed.objectTypes ?? [],
    behaviorHints: parsed.behaviorHints ?? [],
    noteHint: parsed.noteHint ?? false,
    contentTerms: parsed.contentTerms,
    excludeContentTerms: parsed.excludeContentTerms ?? [],
    confidence: parsed.confidence,
    topic: parsed.topic
      ? {
          terms: parsed.topic.terms,
          source: parsed.topic.source,
          strength: parsed.topic.strength
        }
      : null
  }
}

/**
 * 下一环（Hybrid）真实接手的契约。类型见 `NluTryNextStageHandoff`。
 */
function formatNextStageHandoff(result: UnderstandRecallClueResult): NluTryNextStageHandoff {
  if (result.disposition === 'reject_noise') {
    return {
      continues: false,
      next: 'end_no_match',
      reason: result.rejectReason,
      payload: null,
      note: '噪音网关拒绝：Hybrid 不拿 parsed，流水线在理解阶段结束'
    }
  }
  return {
    continues: true,
    next: 'mergeRecallDialogTurn → topic → retrieve',
    payload: formatParsedSlots(result.parsed),
    meta: {
      understandSource: result.source,
      mode: result.mode,
      filterClueDebug: result.filterClue
    },
    note: '下一环主输入 = payload（ParsedRecallClue）；首轮无 accumulated 时 merge 结果≈本 parsed'
  }
}

function buildNluTryReport(result: UnderstandRecallClueResult): NluTryReport {
  return {
    disposition: result.disposition,
    rejectReason: result.rejectReason,
    mode: result.mode,
    source: result.source,
    filterClue: result.filterClue,
    parsed: formatParsedSlots(result.parsed),
    nextStageHandoff: formatNextStageHandoff(result)
  }
}

function formatUnderstandResult(result: UnderstandRecallClueResult): string {
  return JSON.stringify(buildNluTryReport(result), null, 2)
}

function resolveForceMode(): ClueUnderstandingMode | undefined {
  const raw = process.env.NLU_TRY_FORCE_MODE?.trim()
  if (!raw) {
    return undefined
  }
  if (raw === 'lexical' || raw === 'semantic') {
    return raw
  }
  throw new Error(`NLU_TRY_FORCE_MODE 无效: ${raw}（用 lexical|semantic）`)
}

export async function runNluTryCli(): Promise<void> {
  loadLocalEnvFiles()

  const clue = resolveClueFromArgv(process.argv)
  if (!clue) {
    console.error(
      '用法: bun run nlu:try -- "<口语线索>"\n例: bun run nlu:try -- "bookmark about coffee last week"\n走产品同款 understandRecallClue（Recall 理解阶段）'
    )
    process.exitCode = 1
    return
  }

  const nowMsRaw = process.env.NLU_TRY_NOW_MS?.trim()
  const nowMs = nowMsRaw ? Number(nowMsRaw) : Date.now()
  if (!Number.isFinite(nowMs)) {
    console.error(`NLU_TRY_NOW_MS 无效: ${nowMsRaw}`)
    process.exitCode = 1
    return
  }

  const forceMode = resolveForceMode()
  const compat = resolveCompat(process.env.PARSE_GOLD_LLM_COMPAT)
  const { apiKey, source: apiKeySource } = resolveApiKey(compat)

  let complete: LlmChatCompleter | undefined
  if (apiKey && forceMode !== 'lexical') {
    const baseUrl = process.env.PARSE_GOLD_LLM_BASE_URL?.trim() || 'https://api.deepseek.com'
    const model =
      process.env.PARSE_GOLD_LLM_MODEL?.trim() ||
      process.env.AI_HOSTED_MODEL?.trim() ||
      'deepseek-chat'
    const completionsUrl = resolveOpenAiCompatibleChatCompletionsUrl(baseUrl)
    // 与 refreshClueLlmCompleter 的 yiveno.dev.clueLlm 分支同一工厂
    complete = createOpenAiCompatibleCompleter({
      apiKey,
      baseUrl,
      model,
      temperature: 0,
      maxTokens: 400,
      compat,
      disableThinking: true
    })
    console.info(
      `[nlu:try] stage=understandRecallClue completer=dev-direct compat=${compat} model=${model} key=${apiKeySource} path=${completionsUrl}`
    )
  } else if (forceMode === 'lexical') {
    console.info('[nlu:try] stage=understandRecallClue forceMode=lexical（无 LLM，对齐 Omnibox）')
  } else {
    console.info(
      '[nlu:try] stage=understandRecallClue completer=none（无 Key → 与产品无 completer 时同：规则）'
    )
  }

  console.info(`[nlu:try] clue=${JSON.stringify(clue)} nowMs=${nowMs}`)

  const result = await understandRecallClue(clue, {
    nowMs,
    ...(complete ? { complete } : {}),
    ...(forceMode ? { forceMode } : {})
  })

  console.info('[nlu:try] result:')
  console.info(formatUnderstandResult(result))
}

const isDirectRun = typeof process.argv[1] === 'string' && process.argv[1].includes('nlu-try.ts')

if (isDirectRun) {
  await runNluTryCli()
}
