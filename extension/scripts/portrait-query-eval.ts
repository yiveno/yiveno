/**
 * 画像可查性解析评测：gold 8 + 变体，走 nlu:try 同款 understandRecallClue。
 *
 * 用法：
 *   cd extension && bun run portrait-query:eval
 *
 * 门槛：gold 8/8；变体 ≥80%。
 */

import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

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

type CaseRow = {
  id: string
  kind: 'gold' | 'variant'
  clue: string
  expectPortraitQuery: boolean
}

const CASES: CaseRow[] = [
  {
    id: 'g-zh-1',
    kind: 'gold',
    clue: '你了解我多少',
    expectPortraitQuery: true
  },
  {
    id: 'g-zh-2',
    kind: 'gold',
    clue: '你对我了解多少',
    expectPortraitQuery: true
  },
  {
    id: 'g-en-1',
    kind: 'gold',
    clue: 'what do you know about me',
    expectPortraitQuery: true
  },
  {
    id: 'g-en-2',
    kind: 'gold',
    clue: 'how well do you know me',
    expectPortraitQuery: true
  },
  {
    id: 'g-en-3',
    kind: 'gold',
    clue: 'tell me what you know about me',
    expectPortraitQuery: true
  },
  {
    id: 'g-zh-3',
    kind: 'gold',
    clue: '你觉得你懂我吗',
    expectPortraitQuery: true
  },
  {
    id: 'g-en-4',
    kind: 'gold',
    clue: 'what have you learned about me',
    expectPortraitQuery: true
  },
  {
    id: 'g-zh-4',
    kind: 'gold',
    clue: '说说你对我的了解',
    expectPortraitQuery: true
  },
  {
    id: 'v-en-1',
    kind: 'variant',
    clue: 'what do you understand about me',
    expectPortraitQuery: true
  },
  {
    id: 'v-zh-1',
    kind: 'variant',
    clue: '你对我有什么印象',
    expectPortraitQuery: true
  },
  {
    id: 'v-en-2',
    kind: 'variant',
    clue: 'do you know me well',
    expectPortraitQuery: true
  },
  {
    id: 'v-zh-2',
    kind: 'variant',
    clue: '你掌握了我哪些信息',
    expectPortraitQuery: true
  },
  {
    id: 'v-neg-1',
    kind: 'variant',
    clue: 'my favorite website',
    expectPortraitQuery: false
  },
  {
    id: 'v-neg-2',
    kind: 'variant',
    clue: 'find that RAG article',
    expectPortraitQuery: false
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
    `[portrait-query:eval] completer=dev-direct compat=${compat} model=${model} path=${completionsUrl}`
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

export async function runPortraitQueryEval(): Promise<void> {
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
    const got = result.parsed.portraitQuery === true
    const ok = got === row.expectPortraitQuery
    if (ok) {
      if (row.kind === 'gold') {
        goldPass += 1
      } else {
        variantPass += 1
      }
      console.log(`PASS ${row.id} [${row.kind}] ${row.clue} → portraitQuery=${got}`)
    } else {
      failures.push(`${row.id}: portraitQuery=${got} want ${row.expectPortraitQuery}`)
      console.log(
        `FAIL ${row.id} [${row.kind}] ${row.clue} → portraitQuery=${got} want ${row.expectPortraitQuery}`
      )
    }
  }

  console.log('')
  console.log(`gold ${goldPass}/${goldTotal}`)
  console.log(`variant ${variantPass}/${variantTotal}`)
  const goldOk = goldPass === goldTotal
  const variantOk = variantTotal === 0 ? true : variantPass / variantTotal >= 0.8
  if (!goldOk || !variantOk) {
    console.error('portrait-query-eval 未达标（gold 须 100%，变体 ≥80%）')
    if (failures.length > 0) {
      console.error(failures.join('\n'))
    }
    process.exitCode = 1
  }
}
