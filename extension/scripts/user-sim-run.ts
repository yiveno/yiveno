/**
 * user-sim 召回 harness CLI：5 persona × 80 查询走 Stage2 确定性轨。
 *
 * 确定性轨：规则解析 + fake embedding（anchor=clue，语义路径等效关闭）；零真实 LLM。
 * 指标测解析/过滤/排序与行为信号，不含语义加成；真实 embedding 轨另行接入。
 *
 * 用法：
 *   cd extension && bun run user-sim:run
 *   USER_SIM_PERSONA=creator bun run user-sim:run
 *   USER_SIM_SEED=7 bun run user-sim:run
 *   USER_SIM_DAYS=90,180,360 bun run user-sim:run   # 90 为基线，其余天数进 scaleCurve
 */

import { execSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { runStage2Case } from '../tests/eval/clue-chain/stage2/run-case'
import { computeStage2Summary } from '../tests/eval/clue-chain/stage2/score'
import type { Stage2CaseResult } from '../tests/eval/clue-chain/stage2/types'
import { USER_SIM_PERSONAS } from '../tests/eval/user-sim/personas'
import { generateUserSimDataset } from '../tests/eval/user-sim/generate'
import { validateUserSimDataset } from '../tests/eval/user-sim/validate'
import { toStage2Tasks } from '../tests/eval/user-sim/to-stage2'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const extensionRoot = resolve(scriptDir, '..')
const repoRoot = resolve(extensionRoot, '..')
const runsDir = resolve(extensionRoot, 'tests/eval/user-sim/runs')
const END_ISO = '2026-11-28'
const NOW_MS = Date.parse(`${END_ISO}T12:00:00Z`)

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

export async function runUserSimCli(): Promise<void> {
  const seed = Number(process.env.USER_SIM_SEED ?? 42)
  const onlyPersona = process.env.USER_SIM_PERSONA?.trim()
  const personas = onlyPersona
    ? USER_SIM_PERSONAS.filter(p => p.id === onlyPersona)
    : USER_SIM_PERSONAS
  if (personas.length === 0) {
    throw new Error(`unknown USER_SIM_PERSONA: ${onlyPersona}`)
  }
  const head = resolveGitHead()
  const startedAt = new Date()
  const perPersona: Record<string, unknown> = {}
  const scaleDays = (process.env.USER_SIM_DAYS ?? '90')
    .split(',')
    .map(s => Number(s.trim()))
    .filter(n => Number.isFinite(n) && n > 0)
  const scaleCurve: Record<string, Record<string, unknown>> = {}

  for (const persona of personas) {
    const data = generateUserSimDataset({ seed, endIso: END_ISO, personaId: persona.id })
    const problems = validateUserSimDataset(data)
    if (problems.length > 0) {
      throw new Error(`user-sim validate failed for ${persona.id}: ${problems.join('; ')}`)
    }
    const tasks = toStage2Tasks(data)
    const cases: Stage2CaseResult[] = []
    for (const task of tasks) {
      cases.push(await runStage2Case({ task, corpus: data.memoryItems, nowMs: NOW_MS }))
    }
    const summary = computeStage2Summary(cases)
    perPersona[persona.id] = { counts: data.meta.counts, summary, cases }
    console.log(
      `user-sim · ${persona.id} · saves=${data.meta.counts.saves} · R@1=${summary.positive.recallAt1.toFixed(3)} R@5=${summary.positive.recallAt5.toFixed(3)} MRR=${summary.positive.mrr.toFixed(3)} negFH=${summary.negativeFalseHitRate.toFixed(3)} stages=${JSON.stringify(summary.stageCounts)}`
    )
  }

  for (const days of scaleDays.filter(d => d !== 90)) {
    for (const persona of personas) {
      const data = generateUserSimDataset({ seed, endIso: END_ISO, personaId: persona.id, days })
      const problems = validateUserSimDataset(data)
      if (problems.length > 0) {
        throw new Error(
          `user-sim validate failed for ${persona.id}@${days}d: ${problems.join('; ')}`
        )
      }
      const tasks = toStage2Tasks(data)
      const cases: Stage2CaseResult[] = []
      for (const task of tasks) {
        cases.push(await runStage2Case({ task, corpus: data.memoryItems, nowMs: NOW_MS }))
      }
      const summary = computeStage2Summary(cases)
      ;(scaleCurve[persona.id] ??= {})[String(days)] = { counts: data.meta.counts, summary }
      console.log(
        `user-sim-scale · ${persona.id} · days=${days} · saves=${data.meta.counts.saves} · R@1=${summary.positive.recallAt1.toFixed(3)} R@5=${summary.positive.recallAt5.toFixed(3)} MRR=${summary.positive.mrr.toFixed(3)} negFH=${summary.negativeFalseHitRate.toFixed(3)}`
      )
    }
  }

  const report = {
    schemaVersion: 1,
    kind: 'user-sim-recall',
    head,
    startedAt: startedAt.toISOString(),
    finishedAt: new Date().toISOString(),
    seed,
    endIso: END_ISO,
    track: { parse: 'rules', embedding: 'fake-anchor-clue', llm: false },
    personas: perPersona,
    ...(Object.keys(scaleCurve).length > 0 ? { scaleCurve } : {})
  }
  mkdirSync(runsDir, { recursive: true })
  const stamp = stampFromDate(startedAt)
  const runPath = resolve(runsDir, `run-${stamp}_${head.slice(0, 8)}.json`)
  writeFileSync(runPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
  writeFileSync(resolve(runsDir, 'latest.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8')
  console.log(`wrote run → ${runPath}`)
}
