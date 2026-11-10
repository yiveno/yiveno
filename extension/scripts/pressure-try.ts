/**
 * 任意输入压力集试跑（R10 · H12）。
 * 只汇报、不挡门禁：循环 PRESSURE_CASES，每条过产品同款 understandRecallClue，
 * 逐条打印对照，末尾汇总；跑完永远 exit 0（用例不符不失败）。
 *
 * 用法：
 *   cd extension && bun run pressure:try            # 默认主路径（有 Key → LLM）
 *   cd extension && NLU_TRY_FORCE_MODE=lexical bun run pressure:try  # 规则垫片诊断
 *
 * 环境变量与 nlu:try 同款：
 *   PARSE_GOLD_LLM_API_KEY | DEEPSEEK_API_KEY | OPENAI_API_KEY | DASHSCOPE_API_KEY
 *   PARSE_GOLD_LLM_BASE_URL / PARSE_GOLD_LLM_MODEL / PARSE_GOLD_LLM_COMPAT
 *   NLU_TRY_NOW_MS — 固定时钟毫秒；缺省 = Date.now()
 *   NLU_TRY_FORCE_MODE=lexical — 强制规则（诊断用；≠听懂验收）
 */

import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { PRESSURE_CASES } from '../src/core/recall/eval/arbitrary-input-pressure-cases'
import {
  resolveOpenAiCompatibleChatCompletionsUrl,
  type OpenAiCompatibleChatCompat
} from '../src/core/recall/understand/openai-compatible-chat'
import {
  createOpenAiCompatibleCompleter,
  type LlmChatCompleter
} from '../src/core/recall/understand/parse-recall-clue-with-llm'
import { understandRecallClue } from '../src/core/recall/understand/understand-recall-clue'
import type { ClueUnderstandingMode } from '../src/core/recall/understand/select-clue-understanding-mode'

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

/** 线索预览：超过 60 字符截断显示。 */
function formatCluePreview(clue: string): string {
  if (clue.length <= 60) {
    return clue
  }
  return `${clue.slice(0, 60)}…(${clue.length} chars)`
}

type PressureRow = {
  id: string
  group: string
  expected: string
  actual: string
  source: string
  disposition: string
  matched: boolean
  rejectReason?: string
  terms?: number
  clueTruncated?: boolean
  error?: string
}

export async function runPressureTryCli(): Promise<void> {
  loadLocalEnvFiles()

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
      `[pressure:try] stage=understandRecallClue completer=dev-direct compat=${compat} model=${model} key=${apiKeySource} path=${completionsUrl}`
    )
  } else if (forceMode === 'lexical') {
    console.info(
      '[pressure:try] stage=understandRecallClue forceMode=lexical（规则垫片/Omnibox 诊断；≠听懂验收）'
    )
  } else {
    console.info(
      '[pressure:try] stage=understandRecallClue completer=none（无 Key → 降级垫片 rules；mode=lexical）'
    )
  }

  console.info(`[pressure:try] cases=${PRESSURE_CASES.length} nowMs=${nowMs}`)

  const rows: PressureRow[] = []

  for (const c of PRESSURE_CASES) {
    try {
      const result = await understandRecallClue(c.clue, {
        nowMs,
        ...(complete ? { complete } : {}),
        ...(forceMode ? { forceMode } : {})
      })

      const disposition = result.disposition
      const source = result.source
      let actual: string
      let rejectReason: string | undefined
      if (disposition === 'reject_noise') {
        actual = 'rejected_noise'
        rejectReason = result.rejectReason ?? undefined
      } else {
        actual = result.parsed.intent ?? 'recall'
      }

      const matched = actual === c.expectedIntent
      const terms =
        disposition === 'proceed' && actual === 'recall'
          ? result.parsed.contentTerms.length
          : undefined
      const clueTruncated = result.clueTruncated === true ? true : undefined

      const extras: string[] = []
      if (rejectReason) {
        extras.push(`rejectReason=${rejectReason}`)
      }
      if (typeof terms === 'number') {
        extras.push(`terms=${terms}`)
      }
      if (clueTruncated) {
        extras.push('clueTruncated')
      }

      console.info(
        `${c.id} [${c.group}] clue=${JSON.stringify(formatCluePreview(c.clue))} expected=${c.expectedIntent} actual=${actual} source=${source} disposition=${disposition}${extras.length > 0 ? ` ${extras.join(' ')}` : ''} ${matched ? '✓' : '✗'}`
      )

      rows.push({
        id: c.id,
        group: c.group,
        expected: c.expectedIntent,
        actual,
        source,
        disposition,
        matched,
        ...(rejectReason ? { rejectReason } : {}),
        ...(typeof terms === 'number' ? { terms } : {}),
        ...(clueTruncated ? { clueTruncated: true } : {})
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.info(
        `${c.id} [${c.group}] clue=${JSON.stringify(formatCluePreview(c.clue))} expected=${c.expectedIntent} actual=error source=error disposition=error error=${message} ✗`
      )
      rows.push({
        id: c.id,
        group: c.group,
        expected: c.expectedIntent,
        actual: 'error',
        source: 'error',
        disposition: 'error',
        matched: false,
        error: message
      })
    }
  }

  const matchedCount = rows.filter(row => row.matched).length
  const mismatched = rows.filter(row => !row.matched)
  const mismatchedIds = mismatched.map(row => row.id).join(',') || 'none'
  const mismatchDetail =
    mismatched.length === 0
      ? 'none'
      : mismatched
          .map(
            row =>
              `${row.id} expected=${row.expected} actual=${row.actual} source=${row.source} disposition=${row.disposition}${row.rejectReason ? ` rejectReason=${row.rejectReason}` : ''}${row.error ? ` error=${row.error}` : ''}`
          )
          .join('; ')

  console.info(`[pressure:try] summary: matched ${matchedCount}/${PRESSURE_CASES.length}`)
  console.info(`[pressure:try] mismatched: ${mismatchedIds}`)
  console.info(`[pressure:try] mismatch detail: ${mismatchDetail}`)
  console.info('[pressure:try] exit=0 (report-only; mismatches do not fail)')
  process.exitCode = 0
}

const isDirectRun =
  typeof process.argv[1] === 'string' && process.argv[1].includes('pressure-try.ts')

if (isDirectRun) {
  await runPressureTryCli()
}
