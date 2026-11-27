/**
 * Phase 4.1：语义入闸阈值标定（合成评估扫阈值）。
 * 收益 = 意译救援率；代价 = 错误 top1 翻转率；取误报上限内的最大救援点。
 */

import {
  SEMANTIC_ADVERSARIAL_CASES,
  SEMANTIC_PARAPHRASE_CASES,
  type SemanticAdversarialCase,
  type SemanticParaphraseCase
} from './semantic-note-eval-cases'
import { cosineSimilarity } from '@/core/recall/hybrid-fusion'

export type ThresholdSweepPoint = {
  threshold: number
  paraphraseRescueRate: number
  adversarialFalseTop1Rate: number
  paraphraseRescued: number
  paraphraseTotal: number
  adversarialFlips: number
  adversarialTotal: number
}

export type ThresholdCalibrationReport = {
  sweep: ThresholdSweepPoint[]
  /** 在误报上限内最大化救援率的阈值；并列取更大阈值（更严）。 */
  selectedThreshold: number
  maxFalseTop1Rate: number
  selectionReason: string
}

function paraphraseRescuedAt(threshold: number, cases: readonly SemanticParaphraseCase[]): number {
  let rescued = 0
  for (const c of cases) {
    const sim = cosineSimilarity(c.queryVector, c.noteEmbedding)
    if (sim >= threshold) {
      rescued += 1
    }
  }
  return rescued
}

/**
 * 对抗：错误命题相似度 ≥ 阈值且高于正确命题 → 视为错误 top1 翻转。
 * （语义独占入闸后错误源会进池并因更高分占 Top1。）
 */
function adversarialFlipsAt(threshold: number, cases: readonly SemanticAdversarialCase[]): number {
  let flips = 0
  for (const c of cases) {
    const wrongSim = cosineSimilarity(c.queryVector, c.wrongEmbedding)
    const correctSim = cosineSimilarity(c.queryVector, c.correctEmbedding)
    const wrongEnters = wrongSim >= threshold
    const correctEnters = correctSim >= threshold
    if (wrongEnters && (!correctEnters || wrongSim > correctSim)) {
      flips += 1
    }
  }
  return flips
}

/**
 * 扫阈值 [from, to] step；默认 0.28→0.80 step 0.02。
 * 选定：falseTop1 ≤ maxFalseTop1Rate 的点中，救援率最大；并列取阈值更大者。
 */
export function calibrateSemanticNoteThreshold(input?: {
  from?: number
  to?: number
  step?: number
  maxFalseTop1Rate?: number
  paraphraseCases?: readonly SemanticParaphraseCase[]
  adversarialCases?: readonly SemanticAdversarialCase[]
}): ThresholdCalibrationReport {
  const from = input?.from ?? 0.28
  const to = input?.to ?? 0.8
  const step = input?.step ?? 0.02
  const maxFalseTop1Rate = input?.maxFalseTop1Rate ?? 0.02
  const paraphraseCases = input?.paraphraseCases ?? SEMANTIC_PARAPHRASE_CASES
  const adversarialCases = input?.adversarialCases ?? SEMANTIC_ADVERSARIAL_CASES

  const sweep: ThresholdSweepPoint[] = []
  for (let t = from; t <= to + 1e-9; t += step) {
    const threshold = Math.round(t * 100) / 100
    const paraphraseRescued = paraphraseRescuedAt(threshold, paraphraseCases)
    const adversarialFlips = adversarialFlipsAt(threshold, adversarialCases)
    sweep.push({
      threshold,
      paraphraseRescueRate: paraphraseRescued / paraphraseCases.length,
      adversarialFalseTop1Rate: adversarialFlips / adversarialCases.length,
      paraphraseRescued,
      paraphraseTotal: paraphraseCases.length,
      adversarialFlips,
      adversarialTotal: adversarialCases.length
    })
  }

  const eligible = sweep.filter(p => p.adversarialFalseTop1Rate <= maxFalseTop1Rate)
  let selected = eligible[0]
  for (const point of eligible) {
    if (!selected) {
      selected = point
      continue
    }
    if (
      point.paraphraseRescueRate > selected.paraphraseRescueRate ||
      (point.paraphraseRescueRate === selected.paraphraseRescueRate &&
        point.threshold > selected.threshold)
    ) {
      selected = point
    }
  }

  if (!selected) {
    // 无合格点：取误报最低且救援最大的点，仍报告（诚实出口由调用方判）
    selected = sweep.reduce((best, point) => {
      if (point.adversarialFalseTop1Rate < best.adversarialFalseTop1Rate) {
        return point
      }
      if (
        point.adversarialFalseTop1Rate === best.adversarialFalseTop1Rate &&
        point.paraphraseRescueRate > best.paraphraseRescueRate
      ) {
        return point
      }
      if (
        point.adversarialFalseTop1Rate === best.adversarialFalseTop1Rate &&
        point.paraphraseRescueRate === best.paraphraseRescueRate &&
        point.threshold > best.threshold
      ) {
        return point
      }
      return best
    }, sweep[0]!)
    return {
      sweep,
      selectedThreshold: selected.threshold,
      maxFalseTop1Rate,
      selectionReason: `无点满足误报≤${maxFalseTop1Rate}；回退选误报最低点 threshold=${selected.threshold}`
    }
  }

  return {
    sweep,
    selectedThreshold: selected.threshold,
    maxFalseTop1Rate,
    selectionReason: `误报≤${maxFalseTop1Rate} 内最大救援率 ${selected.paraphraseRescueRate}（并列取更严阈值）；选定 ${selected.threshold}`
  }
}
