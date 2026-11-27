/**
 * Stage 2 门槛网格 sweep（minScore × outcome gate × semantic K）。
 * 只汇报；不改产品默认。确定性轨，与 clue-chain:stage2 同替身。
 *
 * 用法：
 *   cd extension && bun run clue-chain:stage2:sweep
 */

import { execSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  CLUE_CHAIN_STAGE2_NOW_MS,
  CLUE_CHAIN_STAGE2_SEED
} from '../tests/eval/clue-chain/stage2/constants'
import { generateStage2Dataset } from '../tests/eval/clue-chain/stage2/generate-dataset'
import { runStage2Case } from '../tests/eval/clue-chain/stage2/run-case'
import { computeStage2Summary } from '../tests/eval/clue-chain/stage2/score'
import type { Stage2CaseResult } from '../tests/eval/clue-chain/stage2/types'
import {
  RECALL_MIN_MATCH_SCORE,
  RECALL_TOP_PICK_MIN_SCORE
} from '../src/core/recall/keyword-filter-weights'
import { HYBRID_SEMANTIC_NEIGHBOR_LIMIT } from '../src/core/recall/hybrid-fusion'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const extensionRoot = resolve(scriptDir, '..')
const repoRoot = resolve(extensionRoot, '..')
const runsDir = resolve(extensionRoot, 'tests/eval/clue-chain/stage2/runs')

/** 网格：覆盖默认点，并探测略松/略紧两侧。 */
const MIN_SCORES = [5, 10, 15] as const
const OUTCOME_GATES = [12, 18, 24] as const
const SEMANTIC_KS = [12, 24, 48] as const

type SweepCell = {
  minScore: number
  topPickMinScore: number
  semanticNeighborLimit: number
  isDefault: boolean
  vague: {
    n: number
    recallAt1: number
    recallAt3: number
    recallAt5: number
    mrr: number
    missRate: number
  }
  negative: { n: number; falseHitRate: number }
  positive: {
    recallAt1: number
    recallAt3: number
    recallAt5: number
    mrr: number
    missRate: number
  }
  deltaVsDefault: {
    vagueRecallAt5: number
    vagueMissRate: number
    negativeFalseHitRate: number
  }
}

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

function isPositiveMetric(
  block: ReturnType<typeof computeStage2Summary>['byTier']['vague']
): block is {
  n: number
  recallAt1: number
  recallAt3: number
  recallAt5: number
  mrr: number
  meanRank: number | null
  missRate: number
} {
  return 'recallAt1' in block
}

function pickRecommended(
  cells: readonly SweepCell[],
  defaultCell: SweepCell
): {
  cell: SweepCell
  rationale: string
} {
  // Pareto：优先降 negative falseHit；再抬 vague R@5；不允许正例 R@1 相对默认掉 >2pp。
  const feasible = cells.filter(
    cell => cell.positive.recallAt1 >= defaultCell.positive.recallAt1 - 0.02
  )
  const pool = feasible.length > 0 ? feasible : [...cells]

  const scored = pool.map(cell => {
    const negImprove = defaultCell.negative.falseHitRate - cell.negative.falseHitRate
    const vagueImprove = cell.vague.recallAt5 - defaultCell.vague.recallAt5
    const vagueMissImprove = defaultCell.vague.missRate - cell.vague.missRate
    // 负例改善权重更高（当前残差主矛盾）；vague 次之
    const score = negImprove * 2 + vagueImprove + vagueMissImprove * 0.5
    return { cell, score, negImprove, vagueImprove }
  })
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    // 平局：优先产品默认，避免「零增益仍改门槛」的假推荐
    if (a.cell.isDefault !== b.cell.isDefault) return a.cell.isDefault ? -1 : 1
    return 0
  })

  const best = scored[0]!
  const allFlat =
    scored.every(row => Math.abs(row.score) < 1e-12) &&
    scored.every(
      row =>
        row.cell.vague.recallAt5 === defaultCell.vague.recallAt5 &&
        row.cell.negative.falseHitRate === defaultCell.negative.falseHitRate
    )

  if (allFlat || best.cell.isDefault) {
    return {
      cell: defaultCell,
      rationale: allFlat
        ? '本网格 27 格 vague R@5 / negFH / 正例指标相对默认全零变化：拧 minScore(5–15)、outcome gate(12–24)、semantic K(12–48) 对 deterministic 残差无杠杆。建议保持默认（10/18/24）；vague/negative 残差需机制面（理解强度 / 佐证 / 负例抑制），勿只拧门槛。'
        : '默认组合已在本网格 Pareto 前沿：其它点要么抬 vague 却抬高负例误命中，要么降负例却伤正例 R@1；建议保持默认，残差另寻机制面（理解/佐证），勿只拧门槛。'
    }
  }

  return {
    cell: best.cell,
    rationale: `相对默认：negFH ${best.negImprove >= 0 ? '↓' : '↑'}${Math.abs(best.negImprove).toFixed(3)} · vague R@5 ${best.vagueImprove >= 0 ? '↑' : '↓'}${Math.abs(best.vagueImprove).toFixed(3)}；正例 R@1 相对默认落差 ≤2pp。Pareto 取「先压负例假命中、再抬 vague 覆盖」。`
  }
}

export async function runClueChainStage2SweepCli(): Promise<void> {
  const seed = CLUE_CHAIN_STAGE2_SEED
  const nowMs = CLUE_CHAIN_STAGE2_NOW_MS
  const head = resolveGitHead()
  const startedAt = new Date()
  const dataset = generateStage2Dataset(seed)

  console.log(
    `stage2 sweep · seed=${seed} · corpus=${dataset.corpus.length} · tasks=${dataset.tasks.length} · grid=${MIN_SCORES.length}×${OUTCOME_GATES.length}×${SEMANTIC_KS.length} · head=${head.slice(0, 8)}`
  )

  const cells: SweepCell[] = []
  let done = 0
  const total = MIN_SCORES.length * OUTCOME_GATES.length * SEMANTIC_KS.length * dataset.tasks.length

  for (const minScore of MIN_SCORES) {
    for (const topPickMinScore of OUTCOME_GATES) {
      for (const semanticNeighborLimit of SEMANTIC_KS) {
        const cases: Stage2CaseResult[] = []
        for (const task of dataset.tasks) {
          cases.push(
            await runStage2Case({
              task,
              corpus: dataset.corpus,
              nowMs,
              evalOverrides: { minScore, topPickMinScore, semanticNeighborLimit }
            })
          )
          done += 1
          if (done % 200 === 0 || done === total) {
            console.log(`  … ${done}/${total}`)
          }
        }
        const summary = computeStage2Summary(cases)
        const vagueBlock = summary.byTier.vague
        const negBlock = summary.byTier.negative
        if (!isPositiveMetric(vagueBlock) || !('falseHitRate' in negBlock)) {
          throw new Error('sweep: vague/negative 指标块形状异常')
        }
        cells.push({
          minScore,
          topPickMinScore,
          semanticNeighborLimit,
          isDefault:
            minScore === RECALL_MIN_MATCH_SCORE &&
            topPickMinScore === RECALL_TOP_PICK_MIN_SCORE &&
            semanticNeighborLimit === HYBRID_SEMANTIC_NEIGHBOR_LIMIT,
          vague: {
            n: vagueBlock.n,
            recallAt1: vagueBlock.recallAt1,
            recallAt3: vagueBlock.recallAt3,
            recallAt5: vagueBlock.recallAt5,
            mrr: vagueBlock.mrr,
            missRate: vagueBlock.missRate
          },
          negative: {
            n: negBlock.n,
            falseHitRate: negBlock.falseHitRate
          },
          positive: {
            recallAt1: summary.positive.recallAt1,
            recallAt3: summary.positive.recallAt3,
            recallAt5: summary.positive.recallAt5,
            mrr: summary.positive.mrr,
            missRate: summary.positive.missRate
          },
          deltaVsDefault: {
            vagueRecallAt5: 0,
            vagueMissRate: 0,
            negativeFalseHitRate: 0
          }
        })
      }
    }
  }

  const defaultCell = cells.find(cell => cell.isDefault)
  if (!defaultCell) {
    throw new Error('sweep: 网格未覆盖产品默认组合（10/18/24）')
  }

  for (const cell of cells) {
    cell.deltaVsDefault = {
      vagueRecallAt5: cell.vague.recallAt5 - defaultCell.vague.recallAt5,
      vagueMissRate: cell.vague.missRate - defaultCell.vague.missRate,
      negativeFalseHitRate: cell.negative.falseHitRate - defaultCell.negative.falseHitRate
    }
  }

  const recommended = pickRecommended(cells, defaultCell)
  const finishedAt = new Date()
  const stamp = stampFromDate(startedAt)
  const shortHead = head.slice(0, 8)

  const report = {
    schemaVersion: 1,
    kind: 'clue-chain-stage2-sweep' as const,
    head,
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    seed,
    nowMs,
    track: { parse: 'rules', embedding: 'fake', llm: false },
    grid: {
      minScores: [...MIN_SCORES],
      outcomeGates: [...OUTCOME_GATES],
      semanticKs: [...SEMANTIC_KS]
    },
    productDefaults: {
      minScore: RECALL_MIN_MATCH_SCORE,
      topPickMinScore: RECALL_TOP_PICK_MIN_SCORE,
      semanticNeighborLimit: HYBRID_SEMANTIC_NEIGHBOR_LIMIT
    },
    defaultCell,
    cells,
    recommended: {
      minScore: recommended.cell.minScore,
      topPickMinScore: recommended.cell.topPickMinScore,
      semanticNeighborLimit: recommended.cell.semanticNeighborLimit,
      isDefault: recommended.cell.isDefault,
      vague: recommended.cell.vague,
      negative: recommended.cell.negative,
      positive: recommended.cell.positive,
      deltaVsDefault: recommended.cell.deltaVsDefault,
      rationale: recommended.rationale
    },
    note: 'deterministic 轨 sweep；不冒充真实找回效果；不落地改产品默认。'
  }

  mkdirSync(runsDir, { recursive: true })
  const outPath = resolve(runsDir, `sweep-${stamp}_${shortHead}.json`)
  writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
  writeFileSync(
    resolve(runsDir, 'sweep-latest.json'),
    `${JSON.stringify(report, null, 2)}\n`,
    'utf8'
  )

  console.log('\n=== sweep summary (Δ vs default) ===')
  console.log('minScore\tgate\tK\tvagueR@5\tΔvagueR5\tvagueMiss\tΔmiss\tnegFH\tΔnegFH\tdefault?')
  for (const cell of cells) {
    console.log(
      [
        cell.minScore,
        cell.topPickMinScore,
        cell.semanticNeighborLimit,
        cell.vague.recallAt5.toFixed(3),
        (cell.deltaVsDefault.vagueRecallAt5 >= 0 ? '+' : '') +
          cell.deltaVsDefault.vagueRecallAt5.toFixed(3),
        cell.vague.missRate.toFixed(3),
        (cell.deltaVsDefault.vagueMissRate >= 0 ? '+' : '') +
          cell.deltaVsDefault.vagueMissRate.toFixed(3),
        cell.negative.falseHitRate.toFixed(3),
        (cell.deltaVsDefault.negativeFalseHitRate >= 0 ? '+' : '') +
          cell.deltaVsDefault.negativeFalseHitRate.toFixed(3),
        cell.isDefault ? 'YES' : ''
      ].join('\t')
    )
  }
  console.log('\nrecommended:', {
    minScore: recommended.cell.minScore,
    topPickMinScore: recommended.cell.topPickMinScore,
    semanticNeighborLimit: recommended.cell.semanticNeighborLimit,
    isDefault: recommended.cell.isDefault
  })
  console.log('rationale:', recommended.rationale)
  console.log(`wrote sweep → ${outPath}`)
}
