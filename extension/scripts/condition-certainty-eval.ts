/**
 * 解析确定度评测：gold 12 + 同类变体 24，走 nlu:try 同款 understandRecallClue + 开发直连。
 *
 * 用法：
 *   cd extension && bun run condition-certainty:eval
 *
 * 环境：DEEPSEEK_API_KEY | PARSE_GOLD_LLM_API_KEY（必需）
 *
 * 门槛：gold 12/12；变体 ≥80%。
 */

import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import type {
  ConditionCertainty,
  PreferenceOperator,
  RecallObjectType
} from '../src/core/recall/parse-recall-clue-types'
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

type SlotKind = 'contentTerms' | 'timeRange' | 'preferenceOperator' | 'objectTypes'

type Expectation = {
  slot: SlotKind
  certainty: ConditionCertainty
  /** contentTerms：期望含该 token；objectTypes：期望类型；其余忽略 */
  key?: string
}

type CaseRow = {
  id: string
  kind: 'gold' | 'variant'
  clue: string
  expect: Expectation
}

const CASES: CaseRow[] = [
  // contentTerms × hedge / neutral / firm
  {
    id: 'g-ct-hedge',
    kind: 'gold',
    clue: '好像是 RAG',
    expect: { slot: 'contentTerms', certainty: 'hedge', key: 'rag' }
  },
  {
    id: 'v-ct-hedge-1',
    kind: 'variant',
    clue: 'I think it was RAG',
    expect: { slot: 'contentTerms', certainty: 'hedge', key: 'rag' }
  },
  {
    id: 'v-ct-hedge-2',
    kind: 'variant',
    clue: 'maybe RAG',
    expect: { slot: 'contentTerms', certainty: 'hedge', key: 'rag' }
  },
  {
    id: 'g-ct-neutral',
    kind: 'gold',
    clue: 'the article about RAG',
    expect: { slot: 'contentTerms', certainty: 'neutral', key: 'rag' }
  },
  {
    id: 'v-ct-neutral-1',
    kind: 'variant',
    clue: 'find that RAG article I saved',
    expect: { slot: 'contentTerms', certainty: 'neutral', key: 'rag' }
  },
  {
    id: 'v-ct-neutral-2',
    kind: 'variant',
    clue: 'RAG 那篇文章',
    expect: { slot: 'contentTerms', certainty: 'neutral', key: 'rag' }
  },
  {
    id: 'g-ct-firm',
    kind: 'gold',
    clue: '我记得很清楚是讲 RAG 的那篇',
    expect: { slot: 'contentTerms', certainty: 'firm', key: 'rag' }
  },
  {
    id: 'v-ct-firm-1',
    kind: 'variant',
    clue: 'I clearly remember the RAG article',
    expect: { slot: 'contentTerms', certainty: 'firm', key: 'rag' }
  },
  {
    id: 'v-ct-firm-2',
    kind: 'variant',
    clue: 'definitely that RAG piece',
    expect: { slot: 'contentTerms', certainty: 'firm', key: 'rag' }
  },

  // timeRange × hedge / neutral / firm
  {
    id: 'g-tr-hedge',
    kind: 'gold',
    clue: '好像是昨天存的那篇文章',
    expect: { slot: 'timeRange', certainty: 'hedge' }
  },
  {
    id: 'v-tr-hedge-1',
    kind: 'variant',
    clue: 'I think I saved it yesterday',
    expect: { slot: 'timeRange', certainty: 'hedge' }
  },
  {
    id: 'v-tr-hedge-2',
    kind: 'variant',
    clue: 'maybe yesterday that article',
    expect: { slot: 'timeRange', certainty: 'hedge' }
  },
  {
    id: 'g-tr-neutral',
    kind: 'gold',
    clue: 'yesterday article about RAG',
    expect: { slot: 'timeRange', certainty: 'neutral' }
  },
  {
    id: 'v-tr-neutral-1',
    kind: 'variant',
    clue: 'the article I saved yesterday',
    expect: { slot: 'timeRange', certainty: 'neutral' }
  },
  {
    id: 'v-tr-neutral-2',
    kind: 'variant',
    clue: '昨天存的那篇讲 RAG 的',
    expect: { slot: 'timeRange', certainty: 'neutral' }
  },
  {
    id: 'g-tr-firm',
    kind: 'gold',
    clue: '我记得很清楚是昨天存的',
    expect: { slot: 'timeRange', certainty: 'firm' }
  },
  {
    id: 'v-tr-firm-1',
    kind: 'variant',
    clue: 'I clearly remember saving it yesterday',
    expect: { slot: 'timeRange', certainty: 'firm' }
  },
  {
    id: 'v-tr-firm-2',
    kind: 'variant',
    clue: 'definitely yesterday',
    expect: { slot: 'timeRange', certainty: 'firm' }
  },

  // preferenceOperator × hedge / neutral / firm
  {
    id: 'g-po-hedge',
    kind: 'gold',
    clue: '好像是我最常看的那个网站',
    expect: { slot: 'preferenceOperator', certainty: 'hedge' }
  },
  {
    id: 'v-po-hedge-1',
    kind: 'variant',
    clue: 'I think the site I visit most',
    expect: { slot: 'preferenceOperator', certainty: 'hedge' }
  },
  {
    id: 'v-po-hedge-2',
    kind: 'variant',
    clue: 'maybe my most-visited website',
    expect: { slot: 'preferenceOperator', certainty: 'hedge' }
  },
  {
    id: 'g-po-neutral',
    kind: 'gold',
    clue: '我最常看的网站是哪个',
    expect: { slot: 'preferenceOperator', certainty: 'neutral' }
  },
  {
    id: 'v-po-neutral-1',
    kind: 'variant',
    clue: 'what site do I visit the most',
    expect: { slot: 'preferenceOperator', certainty: 'neutral' }
  },
  {
    id: 'v-po-neutral-2',
    kind: 'variant',
    clue: 'the website I open most often',
    expect: { slot: 'preferenceOperator', certainty: 'neutral' }
  },
  {
    id: 'g-po-firm',
    kind: 'gold',
    clue: '我记得很清楚是我最喜欢的那个网站',
    expect: { slot: 'preferenceOperator', certainty: 'firm' }
  },
  {
    id: 'v-po-firm-1',
    kind: 'variant',
    clue: 'I clearly remember my favorite website',
    expect: { slot: 'preferenceOperator', certainty: 'firm' }
  },
  {
    id: 'v-po-firm-2',
    kind: 'variant',
    clue: 'definitely my favorite site',
    expect: { slot: 'preferenceOperator', certainty: 'firm' }
  },

  // objectTypes × hedge / neutral / firm
  {
    id: 'g-ot-hedge',
    kind: 'gold',
    clue: '好像是一首诗',
    expect: { slot: 'objectTypes', certainty: 'hedge', key: 'poem' }
  },
  {
    id: 'v-ot-hedge-1',
    kind: 'variant',
    clue: 'I think it was a poem',
    expect: { slot: 'objectTypes', certainty: 'hedge', key: 'poem' }
  },
  {
    id: 'v-ot-hedge-2',
    kind: 'variant',
    clue: 'maybe that poem I saved',
    expect: { slot: 'objectTypes', certainty: 'hedge', key: 'poem' }
  },
  {
    id: 'g-ot-neutral',
    kind: 'gold',
    clue: 'that poem about Li Bai',
    expect: { slot: 'objectTypes', certainty: 'neutral', key: 'poem' }
  },
  {
    id: 'v-ot-neutral-1',
    kind: 'variant',
    clue: 'find the poem I saved',
    expect: { slot: 'objectTypes', certainty: 'neutral', key: 'poem' }
  },
  {
    id: 'v-ot-neutral-2',
    kind: 'variant',
    clue: '李白的那首诗',
    expect: { slot: 'objectTypes', certainty: 'neutral', key: 'poem' }
  },
  {
    id: 'g-ot-firm',
    kind: 'gold',
    clue: '我记得很清楚是一首诗',
    expect: { slot: 'objectTypes', certainty: 'firm', key: 'poem' }
  },
  {
    id: 'v-ot-firm-1',
    kind: 'variant',
    clue: 'I clearly remember it was a poem',
    expect: { slot: 'objectTypes', certainty: 'firm', key: 'poem' }
  },
  {
    id: 'v-ot-firm-2',
    kind: 'variant',
    clue: 'definitely a poem',
    expect: { slot: 'objectTypes', certainty: 'firm', key: 'poem' }
  }
]

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

function resolveApiKey(compat: OpenAiCompatibleChatCompat): string {
  const explicit = process.env.PARSE_GOLD_LLM_API_KEY?.trim()
  if (explicit) {
    return explicit
  }
  if (compat === 'dashscope') {
    const key = process.env.DASHSCOPE_API_KEY?.trim()
    if (!key) {
      throw new Error('缺少 DASHSCOPE_API_KEY / PARSE_GOLD_LLM_API_KEY')
    }
    return key
  }
  if (compat === 'openai') {
    const key = process.env.OPENAI_API_KEY?.trim()
    if (!key) {
      throw new Error('缺少 OPENAI_API_KEY / PARSE_GOLD_LLM_API_KEY')
    }
    return key
  }
  const deepseek = process.env.DEEPSEEK_API_KEY?.trim()
  if (!deepseek) {
    throw new Error('缺少 DEEPSEEK_API_KEY / PARSE_GOLD_LLM_API_KEY')
  }
  return deepseek
}

function buildCompleter(): LlmChatCompleter {
  const compat = resolveCompat(process.env.PARSE_GOLD_LLM_COMPAT)
  const apiKey = resolveApiKey(compat)
  const model =
    process.env.PARSE_GOLD_LLM_MODEL?.trim() ||
    process.env.AI_HOSTED_MODEL?.trim() ||
    'deepseek-chat'
  const baseUrl = process.env.PARSE_GOLD_LLM_BASE_URL?.trim() || 'https://api.deepseek.com'
  const completionsUrl = resolveOpenAiCompatibleChatCompletionsUrl(baseUrl)
  console.info(
    `[condition-certainty:eval] completer=dev-direct compat=${compat} model=${model} path=${completionsUrl}`
  )
  return createOpenAiCompatibleCompleter({
    apiKey,
    baseUrl,
    model,
    temperature: 0,
    maxTokens: 500,
    compat,
    disableThinking: true
  })
}

function readCertainty(
  parsed: {
    certainty?: {
      timeRange?: ConditionCertainty
      preferenceOperator?: ConditionCertainty
      contentTerms?: Record<string, ConditionCertainty>
      objectTypes?: Record<string, ConditionCertainty>
    }
    contentTerms: string[]
    objectTypes?: RecallObjectType[]
    preferenceOperator?: PreferenceOperator
    timeRange?: { label: string }
  },
  expect: Expectation
): { got: ConditionCertainty; detail: string } {
  const c = parsed.certainty
  if (expect.slot === 'timeRange') {
    const got = c?.timeRange ?? 'neutral'
    return {
      got,
      detail: `timeRange certainty=${got} (want ${expect.certainty}); label=${parsed.timeRange?.label ?? 'none'}`
    }
  }
  if (expect.slot === 'preferenceOperator') {
    const got = c?.preferenceOperator ?? 'neutral'
    return {
      got,
      detail: `preferenceOperator certainty=${got} (want ${expect.certainty}); op=${parsed.preferenceOperator ?? 'none'}`
    }
  }
  if (expect.slot === 'contentTerms') {
    const key = (expect.key ?? '').toLowerCase()
    const fromMap = c?.contentTerms?.[key]
    const got = fromMap ?? 'neutral'
    return {
      got,
      detail: `contentTerms[${key}] certainty=${got} (want ${expect.certainty}); terms=[${parsed.contentTerms.join(',')}]`
    }
  }
  const key = (expect.key ?? '').toLowerCase()
  const fromMap = c?.objectTypes?.[key]
  const got = fromMap ?? 'neutral'
  return {
    got,
    detail: `objectTypes[${key}] certainty=${got} (want ${expect.certainty}); types=[${(parsed.objectTypes ?? []).join(',')}]`
  }
}

function slotPresent(
  parsed: {
    contentTerms: string[]
    objectTypes?: RecallObjectType[]
    preferenceOperator?: PreferenceOperator
    timeRange?: { label: string }
  },
  expect: Expectation
): boolean {
  if (expect.slot === 'timeRange') {
    return Boolean(parsed.timeRange?.label)
  }
  if (expect.slot === 'preferenceOperator') {
    return Boolean(parsed.preferenceOperator)
  }
  if (expect.slot === 'contentTerms') {
    const key = (expect.key ?? '').toLowerCase()
    return parsed.contentTerms.some(term => term.toLowerCase() === key)
  }
  const key = (expect.key ?? '').toLowerCase()
  return (parsed.objectTypes ?? []).some(type => type.toLowerCase() === key)
}

function evaluateCase(
  row: CaseRow,
  parsed: {
    certainty?: {
      timeRange?: ConditionCertainty
      preferenceOperator?: ConditionCertainty
      contentTerms?: Record<string, ConditionCertainty>
      objectTypes?: Record<string, ConditionCertainty>
    }
    contentTerms: string[]
    objectTypes?: RecallObjectType[]
    preferenceOperator?: PreferenceOperator
    timeRange?: { label: string }
  }
): { ok: boolean; detail: string } {
  if (!slotPresent(parsed, row.expect)) {
    return {
      ok: false,
      detail: `slot ${row.expect.slot} missing on parsed`
    }
  }
  const { got, detail } = readCertainty(parsed, row.expect)
  return { ok: got === row.expect.certainty, detail }
}

export async function runConditionCertaintyEval(): Promise<void> {
  loadLocalEnvFiles()
  const complete = buildCompleter()
  let goldPass = 0
  let variantPass = 0
  const goldTotal = CASES.filter(row => row.kind === 'gold').length
  const variantTotal = CASES.filter(row => row.kind === 'variant').length
  const failures: string[] = []

  for (const row of CASES) {
    const result = await understandRecallClue(row.clue, {
      forceMode: 'semantic',
      complete,
      nowMs: Date.UTC(2026, 10, 25, 12, 0, 0)
    })
    if (result.disposition === 'reject_noise') {
      failures.push(`${row.id} REJECT_NOISE`)
      console.log(`FAIL ${row.id} [${row.kind}] ${row.clue} → reject_noise`)
      continue
    }
    const check = evaluateCase(row, result.parsed)
    if (check.ok) {
      if (row.kind === 'gold') {
        goldPass += 1
      } else {
        variantPass += 1
      }
      console.log(`PASS ${row.id} [${row.kind}] ${row.clue}`)
    } else {
      failures.push(`${row.id}: ${check.detail}`)
      console.log(`FAIL ${row.id} [${row.kind}] ${row.clue} → ${check.detail}`)
    }
  }

  console.log('')
  console.log(`gold ${goldPass}/${goldTotal}`)
  console.log(`variant ${variantPass}/${variantTotal}`)
  const goldOk = goldPass === goldTotal
  const variantOk = variantTotal === 0 ? true : variantPass / variantTotal >= 0.8
  if (!goldOk || !variantOk) {
    console.error('condition-certainty-eval 未达标（gold 须 100%，变体 ≥80%）')
    if (failures.length > 0) {
      console.error(failures.join('\n'))
    }
    process.exitCode = 1
  }
}
