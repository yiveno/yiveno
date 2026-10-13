/**
 * 离线对比：规则 parseRecallClue vs LLM → ParsedRecallClue（不接产品主路径）。
 *
 * 用法：
 *   cd extension && bun run parse-gold:llm
 *
 * 环境变量：
 *   PARSE_GOLD_LLM_API_KEY   必填（也可用 DEEPSEEK_API_KEY / OPENAI_API_KEY）
 *   PARSE_GOLD_LLM_BASE_URL  默认 https://api.deepseek.com
 *   PARSE_GOLD_LLM_MODEL     默认 deepseek-chat（可用 deepseek-v4-flash）
 *   PARSE_GOLD_LLM_GATE      可选 must|stretch|all（默认 all）
 */

import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  compareParseGoldWithLlm,
  formatParseGoldCompareSummary
} from '../src/core/recall/eval/compare-parse-gold'
import { PARSE_GOLD_CASES, type ParseGoldCase } from '../src/core/recall/eval/parse-gold-cases'
import { createOpenAiCompatibleCompleter } from '../src/core/recall/understand/parse-recall-clue-with-llm'

const scriptDir = dirname(fileURLToPath(import.meta.url))

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

function resolveApiKey(): string | undefined {
  return (
    process.env.PARSE_GOLD_LLM_API_KEY?.trim() ||
    process.env.DEEPSEEK_API_KEY?.trim() ||
    process.env.OPENAI_API_KEY?.trim() ||
    undefined
  )
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

export async function runParseGoldLlmCli(): Promise<void> {
  loadLocalEnvFiles()

  const apiKey = resolveApiKey()
  if (!apiKey) {
    console.error(
      '缺少 API Key：请设置 PARSE_GOLD_LLM_API_KEY（或 DEEPSEEK_API_KEY / OPENAI_API_KEY）'
    )
    process.exitCode = 1
    return
  }

  const baseUrl = process.env.PARSE_GOLD_LLM_BASE_URL?.trim() || 'https://api.deepseek.com'
  const model =
    process.env.PARSE_GOLD_LLM_MODEL?.trim() ||
    process.env.AI_HOSTED_MODEL?.trim() ||
    'deepseek-chat'
  const cases = filterCases(process.env.PARSE_GOLD_LLM_GATE?.trim())

  console.info(`[parse-gold:llm] model=${model} base=${baseUrl} cases=${cases.length}`)

  const complete = createOpenAiCompatibleCompleter({
    apiKey,
    baseUrl,
    model,
    temperature: 0,
    maxTokens: 400,
    disableThinking: true
  })

  const report = await compareParseGoldWithLlm({ cases, complete })
  console.info(formatParseGoldCompareSummary(report))

  const authBlocked = report.llm.cases.some(item =>
    /authentication|unauthorized|invalid.*api.?key|401/i.test(item.detail)
  )
  if (authBlocked) {
    console.error(
      '[parse-gold:llm] API 鉴权失败：请更新 DEEPSEEK_API_KEY / PARSE_GOLD_LLM_API_KEY 后重试'
    )
    process.exitCode = 1
    return
  }

  // 有 must 回归时以非 0 退出，便于本地门禁；无 key 的 CI 不会跑本脚本
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
