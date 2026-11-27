/**
 * 合成 Clue 闭环 Stage 2 · 召回层 harness CLI。
 *
 * 确定性轨：规则解析 + fake embedding + 固定 nowMs；零真实 LLM。
 *
 * 用法：
 *   cd extension && bun run clue-chain:stage2
 *   CLUE_CHAIN_STAGE2_LIMIT=20 bun run clue-chain:stage2
 *   CLUE_CHAIN_STAGE2_BASELINE=1 bun run clue-chain:stage2
 */

import { execSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  CLUE_CHAIN_STAGE2_NOW_MS,
  CLUE_CHAIN_STAGE2_SEED
} from '../tests/eval/clue-chain/stage2/constants'
import {
  compareStage2Baseline,
  formatStage2BaselineDelta
} from '../tests/eval/clue-chain/stage2/compare-baseline'
import { generateStage2Dataset } from '../tests/eval/clue-chain/stage2/generate-dataset'
import {
  buildStage2Report,
  formatStage2ReportConsole
} from '../tests/eval/clue-chain/stage2/report'
import { runStage2Case } from '../tests/eval/clue-chain/stage2/run-case'
import type { Stage2CaseResult, Stage2Report } from '../tests/eval/clue-chain/stage2/types'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const extensionRoot = resolve(scriptDir, '..')
const repoRoot = resolve(extensionRoot, '..')
const runsDir = resolve(extensionRoot, 'tests/eval/clue-chain/stage2/runs')

function resolveGitHead(): string {
  try {
    return execSync('git rev-parse HEAD', { cwd: repoRoot, encoding: 'utf8' }).trim()
  } catch {
    return 'unknown'
  }
}

function stampFromDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}_${pad(date.getUTCHours())}-${pad(date.getUTCMinutes())}-${pad(date.getUTCSeconds())}`
}

function findLatestBaseline(): string | null {
  if (!existsSync(runsDir)) return null
  const files = readdirSync(runsDir)
    .filter(name => name.startsWith('baseline-') && name.endsWith('.json'))
    .sort()
  if (files.length === 0) return null
  return resolve(runsDir, files[files.length - 1]!)
}

export async function runClueChainStage2Cli(): Promise<void> {
  const seed = Number(process.env.CLUE_CHAIN_STAGE2_SEED ?? CLUE_CHAIN_STAGE2_SEED)
  const nowMs = Number(process.env.CLUE_CHAIN_STAGE2_NOW_MS ?? CLUE_CHAIN_STAGE2_NOW_MS)
  const limitRaw = process.env.CLUE_CHAIN_STAGE2_LIMIT?.trim()
  const limit = limitRaw ? Math.max(1, Number(limitRaw)) : null
  const writeBaseline =
    process.env.CLUE_CHAIN_STAGE2_BASELINE === '1' ||
    process.env.CLUE_CHAIN_STAGE2_BASELINE === 'true'

  const head = resolveGitHead()
  const startedAt = new Date()
  const dataset = generateStage2Dataset(seed)
  const tasks = limit ? dataset.tasks.slice(0, limit) : dataset.tasks

  console.log(
    `stage2 recall · seed=${seed} · corpus=${dataset.corpus.length} · tasks=${tasks.length}/${dataset.tasks.length} · head=${head.slice(0, 8)}`
  )

  const cases: Stage2CaseResult[] = []
  for (let i = 0; i < tasks.length; i += 1) {
    const task = tasks[i]!
    const result = await runStage2Case({
      task,
      corpus: dataset.corpus,
      nowMs
    })
    cases.push(result)
    if ((i + 1) % 40 === 0 || i + 1 === tasks.length) {
      console.log(`  … ${i + 1}/${tasks.length} done (last=${result.taskId} stage=${result.stage})`)
    }
  }

  const finishedAt = new Date()
  const report = buildStage2Report({
    head,
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    seed,
    nowMs,
    cases
  })

  mkdirSync(runsDir, { recursive: true })
  const stamp = stampFromDate(startedAt)
  const shortHead = head.slice(0, 8)
  const runPath = resolve(runsDir, `run-${stamp}_${shortHead}.json`)
  writeFileSync(runPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
  writeFileSync(resolve(runsDir, 'latest.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8')

  let baselinePath: string | null = null
  if (writeBaseline || !findLatestBaseline()) {
    baselinePath = resolve(runsDir, `baseline-${stamp}_${shortHead}.json`)
    writeFileSync(baselinePath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
    console.log(`wrote baseline → ${baselinePath}`)
  }

  console.log(formatStage2ReportConsole(report))
  console.log(`wrote run → ${runPath}`)

  const compareAgainst = findLatestBaseline()
  if (compareAgainst && baselinePath !== compareAgainst) {
    try {
      const baselineRaw = JSON.parse(readFileSync(compareAgainst, 'utf8')) as unknown
      const delta = compareStage2Baseline(report, baselineRaw, compareAgainst)
      console.log(formatStage2BaselineDelta(delta))
    } catch (error) {
      console.warn(
        `baseline compare skipped: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }

  // 供程序化读取（可选）
  void (report as Stage2Report)
}
