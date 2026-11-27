/**
 * 合成 Clue 闭环 Stage 1 · 解析层 harness CLI。
 *
 * 只测 understandRecallClue（不测找回、不走浏览器）。
 * LLM：DeepSeek 直连（与 nlu:try 同源），不烧 hosted 配额。
 *
 * 用法：
 *   cd extension && bun run clue-chain:parse
 *   CLUE_CHAIN_LIMIT=10 bun run clue-chain:parse
 *   CLUE_CHAIN_RESUME=1 bun run clue-chain:parse
 */

import { execSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  compareClueChainBaseline,
  formatClueChainBaselineDelta
} from '../tests/eval/clue-chain/compare-baseline'
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
import {
  resolveOpenAiCompatibleChatCompletionsUrl,
  type OpenAiCompatibleChatCompat
} from '../src/core/recall/understand/openai-compatible-chat'
import {
  createOpenAiCompatibleCompleter,
  type LlmChatCompleter
} from '../src/core/recall/understand/parse-recall-clue-with-llm'
import { resolveRecallTopic } from '../src/core/recall/recall-topic'
import { understandRecallClue } from '../src/core/recall/understand/understand-recall-clue'

/** 续跑时补齐 topicTerms（旧 checkpoint 可能为空）。 */
function withResolvedTopicTerms(run: ClueChainParseRunCase): ClueChainParseRunCase {
  if (!run.parsed) {
    return run
  }
  const topicTerms = resolveRecallTopic(run.parsed)?.terms ?? run.parsed.contentTerms ?? []
  if (
    topicTerms.length === run.topicTermsActual.length &&
    topicTerms.every((term, index) => term === run.topicTermsActual[index])
  ) {
    return run
  }
  return { ...run, topicTermsActual: topicTerms }
}

const scriptDir = dirname(fileURLToPath(import.meta.url))
const extensionRoot = resolve(scriptDir, '..')
const repoRoot = resolve(extensionRoot, '..')
const runsDir = resolve(extensionRoot, 'tests/eval/clue-chain/runs')

function loadLocalEnvFiles(): void {
  const roots = [repoRoot, extensionRoot]
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
  apiKey: string
  source: string
} {
  const explicit = process.env.PARSE_GOLD_LLM_API_KEY?.trim()
  if (explicit) {
    return { apiKey: explicit, source: 'PARSE_GOLD_LLM_API_KEY' }
  }
  if (compat === 'dashscope') {
    const key = process.env.DASHSCOPE_API_KEY?.trim()
    if (!key) {
      throw new Error('缺 DASHSCOPE_API_KEY')
    }
    return { apiKey: key, source: 'DASHSCOPE_API_KEY' }
  }
  if (compat === 'openai') {
    const key = process.env.OPENAI_API_KEY?.trim()
    if (!key) {
      throw new Error('缺 OPENAI_API_KEY')
    }
    return { apiKey: key, source: 'OPENAI_API_KEY' }
  }
  const deepseek = process.env.DEEPSEEK_API_KEY?.trim()
  if (!deepseek) {
    throw new Error('缺 DEEPSEEK_API_KEY / PARSE_GOLD_LLM_API_KEY（harness 走直连，不烧 hosted）')
  }
  return { apiKey: deepseek, source: 'DEEPSEEK_API_KEY' }
}

function resolveGitHead(): string {
  try {
    return execSync('git rev-parse HEAD', { cwd: repoRoot, encoding: 'utf8' }).trim()
  } catch {
    return 'unknown'
  }
}

function checkpointPath(): string {
  return resolve(runsDir, 'checkpoint-parse.json')
}

function loadCheckpoint(): Map<string, ClueChainParseRunCase> {
  const path = checkpointPath()
  if (!existsSync(path)) {
    return new Map()
  }
  const raw = JSON.parse(readFileSync(path, 'utf8')) as {
    cases?: ClueChainParseRunCase[]
  }
  const map = new Map<string, ClueChainParseRunCase>()
  for (const item of raw.cases ?? []) {
    map.set(item.id, item)
  }
  return map
}

function saveCheckpoint(cases: ClueChainParseRunCase[]): void {
  mkdirSync(runsDir, { recursive: true })
  writeFileSync(
    checkpointPath(),
    JSON.stringify({ updatedAt: new Date().toISOString(), cases }, null, 2),
    'utf8'
  )
}

function listBaselineFiles(): string[] {
  if (!existsSync(runsDir)) {
    return []
  }
  return readdirSync(runsDir)
    .filter(name => name.startsWith('baseline-') && name.endsWith('.json'))
    .map(name => resolve(runsDir, name))
    .sort()
}

/** 默认校准样本：覆盖 A/B/C/D。 */
const DEFAULT_CALIBRATE_IDS = ['01', '05', '18', '20', 'A01', 'A08', 'B02', 'C01', 'C04', 'D05']

function stripParsedEmbedding(report: ClueChainParseReport): ClueChainParseReport {
  return {
    ...report,
    cases: report.cases.map(row => {
      if (!row.run.parsed?.topic?.embedding) {
        return row
      }
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

export async function runClueChainParseCli(): Promise<void> {
  loadLocalEnvFiles()
  mkdirSync(runsDir, { recursive: true })

  const startedAt = new Date().toISOString()
  const head = resolveGitHead()
  const { cases: allCases, fixtureFiles } = loadClueChainCasesFromFixtures(
    DEFAULT_CLUE_CHAIN_FIXTURE_FILES
  )

  const limitRaw = process.env.CLUE_CHAIN_LIMIT?.trim()
  const limit = limitRaw ? Number(limitRaw) : allCases.length
  if (!Number.isFinite(limit) || limit <= 0) {
    throw new Error(`CLUE_CHAIN_LIMIT 无效: ${limitRaw}`)
  }
  const cases = allCases.slice(0, limit)

  const nowMsRaw = process.env.CLUE_CHAIN_NOW_MS?.trim()
  const nowMs = nowMsRaw ? Number(nowMsRaw) : Date.now()
  if (!Number.isFinite(nowMs)) {
    throw new Error(`CLUE_CHAIN_NOW_MS 无效: ${nowMsRaw}`)
  }

  const timeoutMs = Number(process.env.CLUE_CHAIN_TIMEOUT_MS?.trim() || 60_000)
  const maxAttempts = Number(process.env.CLUE_CHAIN_MAX_ATTEMPTS?.trim() || 2)

  const compat = resolveCompat(process.env.PARSE_GOLD_LLM_COMPAT)
  const { apiKey, source: apiKeySource } = resolveApiKey(compat)
  const baseUrl = process.env.PARSE_GOLD_LLM_BASE_URL?.trim() || 'https://api.deepseek.com'
  const model =
    process.env.PARSE_GOLD_LLM_MODEL?.trim() ||
    process.env.AI_HOSTED_MODEL?.trim() ||
    'deepseek-chat'
  const completionsUrl = resolveOpenAiCompatibleChatCompletionsUrl(baseUrl)

  const complete: LlmChatCompleter = createOpenAiCompatibleCompleter({
    apiKey,
    baseUrl,
    model,
    temperature: 0,
    maxTokens: 400,
    compat,
    disableThinking: true
  })

  console.info(
    `[clue-chain] parse+judge direct compat=${compat} model=${model} key=${apiKeySource} path=${completionsUrl}`
  )
  console.info(
    `[clue-chain] cases=${cases.length}/${allCases.length} head=${head.slice(0, 8)} nowMs=${nowMs}`
  )

  const resume = process.env.CLUE_CHAIN_RESUME === '1'
  const checkpoint = resume ? loadCheckpoint() : new Map<string, ClueChainParseRunCase>()
  if (resume) {
    console.info(`[clue-chain] resume checkpoint hits=${checkpoint.size}`)
  }

  const completed: ClueChainParseRunCase[] = []
  const parseRuns = await runClueChainParseBatch({
    cases,
    nowMs,
    maxAttempts,
    timeoutMs,
    checkpoint,
    understand: (clue, options) =>
      understandRecallClue(clue, {
        nowMs: options.nowMs,
        complete
      }),
    onCaseDone: (result, index, total) => {
      completed.push(result)
      // 合并 checkpoint + 本批已完成，便于中断后续跑
      const merged = new Map(checkpoint)
      for (const item of completed) {
        merged.set(item.id, item)
      }
      saveCheckpoint([...merged.values()])
      const status = result.error ? `ERR ${result.error}` : `ok src=${result.source}`
      console.info(`[clue-chain] parse ${index + 1}/${total} id=${result.id} ${status}`)
    }
  })

  const enrichedRuns = parseRuns.map(withResolvedTopicTerms)
  saveCheckpoint(enrichedRuns)

  const topicJudges = new Map<string, ClueChainTopicJudgeResult>()
  for (let index = 0; index < enrichedRuns.length; index += 1) {
    const run = enrichedRuns[index]!
    if (run.category === 'C') {
      topicJudges.set(run.id, { match: true, reason: 'C 类跳过 topic judge' })
      continue
    }
    if (!run.parsed) {
      topicJudges.set(run.id, { match: false, reason: '无 parsed，跳过 judge' })
      continue
    }
    const judge = await judgeTopicSemantic({
      clue: run.clue,
      expectedTopic: run.expected.topic,
      actualTopicTerms: run.topicTermsActual,
      complete
    })
    topicJudges.set(run.id, judge)
    console.info(
      `[clue-chain] judge ${index + 1}/${enrichedRuns.length} id=${run.id} match=${judge.match} terms=${JSON.stringify(run.topicTermsActual)}`
    )
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
        parseCompat: compat,
        parseModel: model,
        judgeModel: model,
        direct: true
      },
      rows
    })
  )

  const stamp = finishedAt.replace(/[:.]/g, '-').replace('T', '_').slice(0, 19)
  const outPath = resolve(runsDir, `run-${stamp}_${head.slice(0, 8)}.json`)
  const baselinePath = resolve(runsDir, `baseline-${stamp}_${head.slice(0, 8)}.json`)
  writeFileSync(outPath, JSON.stringify(report, null, 2), 'utf8')
  writeFileSync(baselinePath, JSON.stringify(report, null, 2), 'utf8')
  writeFileSync(resolve(runsDir, 'latest.json'), JSON.stringify(report, null, 2), 'utf8')

  console.info(formatClueChainReportConsole(report))
  console.info(`[clue-chain] wrote ${outPath}`)
  console.info(`[clue-chain] baseline ${baselinePath}`)

  const prevBaselines = listBaselineFiles().filter(path => path !== baselinePath)
  const prevBaseline = prevBaselines.length > 0 ? prevBaselines[prevBaselines.length - 1]! : null
  if (prevBaseline) {
    const prev = JSON.parse(readFileSync(prevBaseline, 'utf8')) as unknown
    const delta = compareClueChainBaseline(report, prev, prevBaseline)
    console.info(formatClueChainBaselineDelta(delta))
  } else {
    console.info('[clue-chain:delta] 无既有基线（本跑为第一份）')
  }

  const calibrateIds = (
    process.env.CLUE_CHAIN_CALIBRATE_IDS?.trim() || DEFAULT_CALIBRATE_IDS.join(',')
  )
    .split(',')
    .map(id => id.trim())
    .filter(Boolean)
  const calibrateRows = rows.filter(row => calibrateIds.includes(row.run.id))
  const calibratePath = resolve(runsDir, `calibrate-topic-10_${head.slice(0, 8)}.json`)
  writeFileSync(
    calibratePath,
    JSON.stringify(
      {
        promptVersion: 1,
        head,
        ids: calibrateIds,
        rows: calibrateRows.map(row => ({
          id: row.run.id,
          category: row.run.category,
          clue: row.run.clue,
          expectedTopic: row.run.expected.topic,
          actualTopicTerms: row.run.topicTermsActual,
          judge: row.topicJudge,
          humanAgree: null as boolean | null,
          humanNote: ''
        }))
      },
      null,
      2
    ),
    'utf8'
  )
  console.info(`[clue-chain] calibrate sample → ${calibratePath} (n=${calibrateRows.length})`)
}
