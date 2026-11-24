/**
 * 偏好算子解析评测：gold 9 + 变体 9，走 nlu:try 同款 understandRecallClue + 开发直连。
 *
 * 用法：
 *   cd extension && bun run behavior-preference:eval
 *
 * 环境：DEEPSEEK_API_KEY | PARSE_GOLD_LLM_API_KEY（必需）
 */

import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import type {
  PreferenceOperator,
  PreferenceTarget
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

type Expectation = {
  operator: PreferenceOperator | null
  target: PreferenceTarget | null
  /** 期望 contentTerms 含这些词（小写）；null = 无 topic */
  topicIncludes: string[] | null
}

type CaseRow = {
  id: string
  kind: 'gold' | 'variant'
  clue: string
  expect: Expectation
}

const CASES: CaseRow[] = [
  {
    id: 'g1',
    kind: 'gold',
    clue: '我最喜欢的那个网站',
    expect: { operator: 'favorite', target: 'site', topicIncludes: null }
  },
  {
    id: 'v1',
    kind: 'variant',
    clue: 'which website is my favorite',
    expect: { operator: 'favorite', target: 'site', topicIncludes: null }
  },
  {
    id: 'g2',
    kind: 'gold',
    clue: '我最常看的网站是哪个',
    expect: { operator: 'most_frequent', target: 'site', topicIncludes: null }
  },
  {
    id: 'v2',
    kind: 'variant',
    clue: 'what site do I visit the most',
    expect: { operator: 'most_frequent', target: 'site', topicIncludes: null }
  },
  {
    id: 'g3',
    kind: 'gold',
    clue: '最近总看的网站',
    expect: { operator: 'recent_frequent', target: 'site', topicIncludes: null }
  },
  {
    id: 'v3',
    kind: 'variant',
    clue: 'sites I keep opening lately',
    expect: { operator: 'recent_frequent', target: 'site', topicIncludes: null }
  },
  {
    id: 'g4',
    kind: 'gold',
    clue: '我常看的',
    expect: { operator: 'most_frequent', target: 'site', topicIncludes: null }
  },
  {
    id: 'v4',
    kind: 'variant',
    clue: 'the one I usually look at',
    expect: { operator: 'most_frequent', target: 'site', topicIncludes: null }
  },
  {
    id: 'g5',
    kind: 'gold',
    clue: '我最常看的那个讲 RAG 的网站',
    expect: { operator: 'most_frequent', target: 'site', topicIncludes: ['rag'] }
  },
  {
    id: 'v5',
    kind: 'variant',
    clue: 'my most-visited site about RAG',
    expect: { operator: 'most_frequent', target: 'site', topicIncludes: ['rag'] }
  },
  {
    id: 'g6',
    kind: 'gold',
    clue: '我最常看的那篇文章',
    expect: { operator: 'most_frequent', target: 'page', topicIncludes: null }
  },
  {
    id: 'v6',
    kind: 'variant',
    clue: 'the article I open most often',
    expect: { operator: 'most_frequent', target: 'page', topicIncludes: null }
  },
  {
    id: 'g7',
    kind: 'gold',
    clue: '我最常去 github 干什么',
    expect: { operator: null, target: null, topicIncludes: null }
  },
  {
    id: 'v7',
    kind: 'variant',
    clue: 'what do I usually do on github',
    expect: { operator: null, target: null, topicIncludes: null }
  },
  {
    id: 'g8',
    kind: 'gold',
    clue: '昨天看过的网站',
    expect: { operator: null, target: null, topicIncludes: null }
  },
  {
    id: 'v8',
    kind: 'variant',
    clue: 'sites I browsed yesterday',
    expect: { operator: null, target: null, topicIncludes: null }
  },
  {
    id: 'g9',
    kind: 'gold',
    clue: '帮我找那篇讲 RAG 的文章',
    expect: { operator: null, target: null, topicIncludes: ['rag'] }
  },
  {
    id: 'v9',
    kind: 'variant',
    clue: 'find that article about RAG I saved',
    expect: { operator: null, target: null, topicIncludes: ['rag'] }
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
    `[behavior-preference:eval] completer=dev-direct compat=${compat} model=${model} path=${completionsUrl}`
  )
  return createOpenAiCompatibleCompleter({
    apiKey,
    baseUrl,
    model,
    temperature: 0,
    maxTokens: 400,
    compat,
    disableThinking: true
  })
}

function hasTopicIncludes(contentTerms: string[], expected: string[] | null): boolean {
  if (expected == null) {
    // 无 topic：允许空；若有 contentTerms 也不因本断言失败（算子/无算子主判）
    return true
  }
  const set = new Set(contentTerms.map(term => term.toLowerCase()))
  return expected.every(term => set.has(term.toLowerCase()))
}

function evaluateCase(
  row: CaseRow,
  parsed: {
    preferenceOperator?: PreferenceOperator
    preferenceTarget?: PreferenceTarget
    contentTerms: string[]
  }
): { ok: boolean; detail: string } {
  const gotOp = parsed.preferenceOperator ?? null
  const gotTarget = parsed.preferenceTarget ?? null
  const opOk = gotOp === row.expect.operator
  const targetOk =
    row.expect.operator == null
      ? true
      : gotTarget === (row.expect.target ?? 'site') ||
        (row.expect.target === 'site' && gotTarget == null && gotOp != null)
  const topicOk =
    row.expect.topicIncludes == null
      ? row.expect.operator != null
        ? parsed.contentTerms.length === 0 || hasTopicIncludes(parsed.contentTerms, null)
        : true
      : hasTopicIncludes(parsed.contentTerms, row.expect.topicIncludes)

  // topic 有期望词时必须命中；无 topic 的偏好题不得把排序词当 contentTerms 卡死——只要求有 topicIncludes 时命中
  let topicPass = true
  if (row.expect.topicIncludes != null) {
    topicPass = hasTopicIncludes(parsed.contentTerms, row.expect.topicIncludes)
  } else if (row.expect.operator != null) {
    // 偏好排序题：contentTerms 应尽量空；允许残留时仍以算子为准，但若含 rag 等意外主题则失败
    topicPass = !parsed.contentTerms.some(term => ['rag'].includes(term.toLowerCase()))
  }

  const ok = opOk && targetOk && topicPass
  return {
    ok,
    detail: `op=${gotOp} (want ${row.expect.operator}); target=${gotTarget} (want ${row.expect.target}); terms=[${parsed.contentTerms.join(',')}] topicOk=${topicOk && topicPass}`
  }
}

export async function runBehaviorPreferenceEval(): Promise<void> {
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
      nowMs: Date.UTC(2026, 10, 24, 12, 0, 0)
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
  const variantOk = variantPass / variantTotal >= 0.8
  if (!goldOk || !variantOk) {
    console.error('behavior-preference-eval 未达标（gold 须 100%，变体 ≥80%）')
    if (failures.length > 0) {
      console.error(failures.join('\n'))
    }
    process.exitCode = 1
  }
}
