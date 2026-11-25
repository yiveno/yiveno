/**
 * 行为层消融 CLI：写 fixture（可选）+ 主跑两次 + 可选 LLM 次要臂 + 落盘 runs/。
 *
 * 用法：
 *   cd extension && bun run behavior-ablation:run
 *   BEHAVIOR_ABLATION_WRITE_FIXTURES=1 bun run behavior-ablation:run
 */

import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  BEHAVIOR_ABLATION_NOW_MS,
  BEHAVIOR_ABLATION_SEED
} from '../src/core/recall/eval/behavior-ablation/constants'
import {
  datasetToFixtureFiles,
  FIXTURE_FILE_NAMES,
  fixtureFilesToDataset,
  type BehaviorAblationFixtureFiles
} from '../src/core/recall/eval/behavior-ablation/fixtures-io'
import { generateBehaviorAblationDataset } from '../src/core/recall/eval/behavior-ablation/generate-dataset'
import { formatBehaviorAblationMarkdown } from '../src/core/recall/eval/behavior-ablation/report'
import { runBehaviorAblationTwice } from '../src/core/recall/eval/behavior-ablation/run-behavior-ablation'
import { computeArmMetrics } from '../src/core/recall/eval/behavior-ablation/score'
import { runArmCase } from '../src/core/recall/eval/behavior-ablation/run-case'
import { buildProdArmsForTask } from '../src/core/recall/eval/behavior-ablation/arms'
import { parseRecallClue } from '../src/core/recall/parse-recall-clue'
import type { OpenAiCompatibleChatCompat } from '../src/core/recall/understand/openai-compatible-chat'
import { createOpenAiCompatibleCompleter } from '../src/core/recall/understand/parse-recall-clue-with-llm'
import { understandRecallClue } from '../src/core/recall/understand/understand-recall-clue'
import type { BehaviorAblationDataset } from '../src/core/recall/eval/behavior-ablation/types'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const extensionRoot = resolve(scriptDir, '..')
const repoRoot = resolve(extensionRoot, '..')
const fixturesDir = resolve(extensionRoot, 'src/core/recall/eval/behavior-ablation/fixtures')
const runsDir = resolve(extensionRoot, 'src/core/recall/eval/behavior-ablation/runs')

function loadLocalEnvFiles(): void {
  const roots = [repoRoot, extensionRoot]
  const names = ['.env.shared.local', '.env.development.local', '.env.local']
  for (const root of roots) {
    for (const name of names) {
      const path = resolve(root, name)
      if (!existsSync(path)) continue
      const text = readFileSync(path, 'utf8')
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

function resolveCompat(raw: string | undefined): OpenAiCompatibleChatCompat {
  const compat = raw?.trim() || 'deepseek'
  if (compat === 'deepseek' || compat === 'openai' || compat === 'dashscope') {
    return compat
  }
  throw new Error('PARSE_GOLD_LLM_COMPAT invalid; use deepseek|openai|dashscope')
}

function resolveApiKey(
  compat: OpenAiCompatibleChatCompat
): { apiKey: string; source: string } | null {
  const explicit = process.env.PARSE_GOLD_LLM_API_KEY?.trim()
  if (explicit) {
    return { apiKey: explicit, source: 'PARSE_GOLD_LLM_API_KEY' }
  }
  if (compat === 'dashscope') {
    const key = process.env.DASHSCOPE_API_KEY?.trim()
    return key ? { apiKey: key, source: 'DASHSCOPE_API_KEY' } : null
  }
  if (compat === 'deepseek') {
    const key = process.env.DEEPSEEK_API_KEY?.trim()
    return key ? { apiKey: key, source: 'DEEPSEEK_API_KEY' } : null
  }
  const key = process.env.OPENAI_API_KEY?.trim()
  return key ? { apiKey: key, source: 'OPENAI_API_KEY' } : null
}

function writeFixtures(dataset: BehaviorAblationDataset): void {
  mkdirSync(fixturesDir, { recursive: true })
  const files = datasetToFixtureFiles(dataset)
  const mapping: Array<[keyof BehaviorAblationFixtureFiles, string]> = [
    ['meta', FIXTURE_FILE_NAMES.meta],
    ['corpus', FIXTURE_FILE_NAMES.corpus],
    ['behavior', FIXTURE_FILE_NAMES.behavior],
    ['clueViews', FIXTURE_FILE_NAMES.clueViews],
    ['mainTasks', FIXTURE_FILE_NAMES.mainTasks],
    ['conflictProdTasks', FIXTURE_FILE_NAMES.conflictProdTasks],
    ['conflictMechTasks', FIXTURE_FILE_NAMES.conflictMechTasks]
  ]
  for (const [key, name] of mapping) {
    writeFileSync(resolve(fixturesDir, name), `${JSON.stringify(files[key], null, 2)}\n`, 'utf8')
  }
  console.log(`[behavior-ablation] fixtures written → ${fixturesDir}`)
}

function loadFixtures(): BehaviorAblationDataset {
  const files: BehaviorAblationFixtureFiles = {
    meta: JSON.parse(readFileSync(resolve(fixturesDir, FIXTURE_FILE_NAMES.meta), 'utf8')),
    corpus: JSON.parse(readFileSync(resolve(fixturesDir, FIXTURE_FILE_NAMES.corpus), 'utf8')),
    behavior: JSON.parse(readFileSync(resolve(fixturesDir, FIXTURE_FILE_NAMES.behavior), 'utf8')),
    clueViews: JSON.parse(readFileSync(resolve(fixturesDir, FIXTURE_FILE_NAMES.clueViews), 'utf8')),
    mainTasks: JSON.parse(readFileSync(resolve(fixturesDir, FIXTURE_FILE_NAMES.mainTasks), 'utf8')),
    conflictProdTasks: JSON.parse(
      readFileSync(resolve(fixturesDir, FIXTURE_FILE_NAMES.conflictProdTasks), 'utf8')
    ),
    conflictMechTasks: JSON.parse(
      readFileSync(resolve(fixturesDir, FIXTURE_FILE_NAMES.conflictMechTasks), 'utf8')
    )
  }
  return fixtureFilesToDataset(files)
}

async function runLlmSecondaryArm(dataset: BehaviorAblationDataset): Promise<{
  note: string
  means: { recallAt1: number; mrr: number }
  ranges: { recallAt1: number; mrr: number }
}> {
  const compat = resolveCompat(process.env.PARSE_GOLD_LLM_COMPAT)
  const key = resolveApiKey(compat)
  if (!key) {
    throw new Error('no_llm_key')
  }
  const baseUrl = process.env.PARSE_GOLD_LLM_BASE_URL?.trim() || 'https://api.deepseek.com'
  const model =
    process.env.PARSE_GOLD_LLM_MODEL?.trim() ||
    process.env.AI_HOSTED_MODEL?.trim() ||
    'deepseek-chat'
  const complete = createOpenAiCompatibleCompleter({
    apiKey: key.apiKey,
    baseUrl,
    model,
    temperature: 0,
    maxTokens: 400,
    compat,
    disableThinking: true
  })

  const prodTasks = [...dataset.mainTasks, ...dataset.conflictProdTasks]
  const roundMetrics: Array<{ recallAt1: number; mrr: number }> = []

  for (let round = 0; round < 3; round += 1) {
    const cases = []
    for (const task of prodTasks) {
      const understood = await understandRecallClue(task.clue.trim(), {
        complete,
        forceMode: 'llm',
        nowMs: BEHAVIOR_ABLATION_NOW_MS
      })
      const parsed = understood.parsed
      // LLM 臂只跑 ON-prod（播种行为 + 该次 LLM 解析条件）
      const arms = buildProdArmsForTask(dataset.corpus, parsed, BEHAVIOR_ABLATION_NOW_MS)
      const onProd = arms.find(a => a.arm === 'ON-prod')!
      cases.push(
        await runArmCase({
          task,
          arm: 'ON-prod',
          corpus: onProd.corpus,
          conditions: onProd.conditions,
          nowMs: BEHAVIOR_ABLATION_NOW_MS
        })
      )
    }
    const metrics = computeArmMetrics('ON-prod', cases)
    roundMetrics.push({ recallAt1: metrics.recallAt1, mrr: metrics.mrr })
    console.log(
      `[behavior-ablation] LLM round ${round + 1}/3 R@1=${metrics.recallAt1.toFixed(4)} MRR=${metrics.mrr.toFixed(4)}`
    )
  }

  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length
  const range = (xs: number[]) => Math.max(...xs) - Math.min(...xs)
  const r1s = roundMetrics.map(m => m.recallAt1)
  const mrrs = roundMetrics.map(m => m.mrr)
  return {
    note: `DeepSeek 直连 (${key.source}/${model}) 3 次；不与主跑混合`,
    means: { recallAt1: mean(r1s), mrr: mean(mrrs) },
    ranges: { recallAt1: range(r1s), mrr: range(mrrs) }
  }
}

export async function runBehaviorAblationCli(): Promise<void> {
  loadLocalEnvFiles()
  mkdirSync(runsDir, { recursive: true })

  const writeFix = process.env.BEHAVIOR_ABLATION_WRITE_FIXTURES === '1'
  const generated = generateBehaviorAblationDataset(BEHAVIOR_ABLATION_SEED)
  if (writeFix || !existsSync(resolve(fixturesDir, FIXTURE_FILE_NAMES.meta))) {
    writeFixtures(generated)
  }

  const dataset = existsSync(resolve(fixturesDir, FIXTURE_FILE_NAMES.meta))
    ? loadFixtures()
    : generated

  console.log(
    `[behavior-ablation] dataset corpus=${dataset.meta.corpusItems} main=${dataset.meta.mainTasks} cprod=${dataset.meta.conflictProd} cmech=${dataset.meta.conflictMech}`
  )

  console.log('[behavior-ablation] main run ×2 …')
  let report = await runBehaviorAblationTwice(dataset, {
    llmArm: 'skipped',
    llmArmNote: '无 DeepSeek/PARSE_GOLD_LLM_API_KEY，跳过 LLM 次要臂（不算失败）'
  })

  let llmExtra: Record<string, unknown> | null = null
  try {
    const llm = await runLlmSecondaryArm(dataset)
    const llmArmNote = `${llm.note}; mean R@1=${llm.means.recallAt1.toFixed(4)} (range ${llm.ranges.recallAt1.toFixed(4)}); mean MRR=${llm.means.mrr.toFixed(4)} (range ${llm.ranges.mrr.toFixed(4)})`
    report = {
      ...report,
      meta: { ...report.meta, llmArm: 'ran', llmArmNote }
    }
    llmExtra = { means: llm.means, ranges: llm.ranges }
  } catch (error) {
    if (!(error instanceof Error && error.message === 'no_llm_key')) {
      const llmArmNote = `LLM 次要臂异常（主跑仍有效）: ${error instanceof Error ? error.message : String(error)}`
      report = {
        ...report,
        meta: { ...report.meta, llmArm: 'skipped', llmArmNote }
      }
      console.warn(`[behavior-ablation] ${llmArmNote}`)
    }
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const shortHash = createHash('sha256')
    .update(report.meta.reproducibility.runAHash)
    .digest('hex')
    .slice(0, 8)
  const base = `run-${stamp}_${shortHash}`
  const jsonPath = resolve(runsDir, `${base}.json`)
  const mdPath = resolve(runsDir, `${base}.md`)

  const payload = llmExtra ? { ...report, llmSecondary: llmExtra } : report
  writeFileSync(jsonPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
  writeFileSync(mdPath, formatBehaviorAblationMarkdown(report), 'utf8')

  console.log(`[behavior-ablation] JSON → ${jsonPath}`)
  console.log(`[behavior-ablation] MD   → ${mdPath}`)
  console.log(
    `[behavior-ablation] reproducibility identical=${report.meta.reproducibility.identical}`
  )
  console.log(`[behavior-ablation] gatesAllPassed=${report.gatesAllPassed}`)
  for (const g of report.gates) {
    console.log(`  - ${g.id}: ${g.passed ? 'PASS' : 'FAIL'} observed=${g.observed.toFixed(4)}`)
  }
  console.log(`[behavior-ablation] LLM arm: ${report.meta.llmArm} — ${report.meta.llmArmNote}`)

  // 触达规则解析一次，避免 tree-shake 误判（CLI 侧已用）
  void parseRecallClue
}
