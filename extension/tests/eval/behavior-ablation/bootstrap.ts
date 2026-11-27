/**
 * 任务级配对 bootstrap：delta 的 95% CI（固定种子）。
 */

import { BEHAVIOR_ABLATION_SIZES } from './constants'
import { createMulberry32, nextInt } from './prng'
import type { DeltaCi } from './types'

/**
 * 对配对样本 `b - a` 的均值做 bootstrap。
 * pairs[i] = { a, b }；delta = mean(b - a)。
 */
export function pairedBootstrapDeltaCi(
  pairs: readonly { a: number; b: number }[],
  seed: number,
  rounds: number = BEHAVIOR_ABLATION_SIZES.bootstrapRounds
): DeltaCi {
  const n = pairs.length
  if (n === 0) {
    return { delta: 0, ci95Lower: 0, ci95Upper: 0 }
  }

  let sum = 0
  for (const pair of pairs) {
    sum += pair.b - pair.a
  }
  const delta = sum / n

  const rng = createMulberry32(seed)
  const samples: number[] = []
  for (let r = 0; r < rounds; r += 1) {
    let boot = 0
    for (let i = 0; i < n; i += 1) {
      const pick = pairs[nextInt(rng, n)]!
      boot += pick.b - pick.a
    }
    samples.push(boot / n)
  }
  samples.sort((left, right) => left - right)
  const loIdx = Math.floor(0.025 * (samples.length - 1))
  const hiIdx = Math.ceil(0.975 * (samples.length - 1))
  return {
    delta,
    ci95Lower: samples[loIdx]!,
    ci95Upper: samples[hiIdx]!
  }
}
