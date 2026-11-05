/**
 * 探针语料分布工具（纯函数）。
 *
 * 设计意图（贴近真实库形态，而非均匀噪声）：
 * - 时近偏斜：多数条目偏近保存，长尾仍有旧物
 * - 主题集中：Zipf 使少数 subject 更常出现
 * - 会话爆发：连续若干条 daysAgo 落在同一小窗（保存成簇）
 *
 * 仅 DEV filler；禁止进召回 runtime。
 */

import { rngForFillerItem, type SeededRng } from './prng'
import type { RecallProbePersonaId } from './types'

/**
 * 时近偏斜混合：60% → 1–30；25% → 31–120；15% → 121–400（各段内均匀）。
 */
export function sampleSkewedDaysAgo(rng: SeededRng): number {
  const roll = rng.next()
  if (roll < 0.6) {
    return 1 + rng.nextInt(30)
  }
  if (roll < 0.85) {
    return 31 + rng.nextInt(90)
  }
  return 121 + rng.nextInt(280)
}

/**
 * 按下标秩 Zipf 权重 `1 / (rank + 1)` 抽取（rank 从 0 起）。
 * 列表序即热度序：越靠前越热门。
 */
export function pickZipfWeighted<T>(rng: SeededRng, list: readonly T[]): T {
  if (list.length === 0) {
    throw new Error('pickZipfWeighted: 空列表')
  }
  let weightSum = 0
  for (let i = 0; i < list.length; i += 1) {
    weightSum += 1 / (i + 1)
  }
  let cursor = rng.next() * weightSum
  for (let i = 0; i < list.length; i += 1) {
    cursor -= 1 / (i + 1)
    if (cursor <= 0) {
      return list[i]!
    }
  }
  return list[list.length - 1]!
}

/**
 * 序列级 daysAgo 规划（会话爆发）。
 * 使用 `rngForFillerItem(seed, kindKey, 0, persona)` 一条顺序消费流：
 * - 非爆发中以 0.45 开启爆发：中心日偏斜抽样，规模 3–8；
 * - 爆发内 daysAgo = 中心 ± 3（clamp 1–400）；
 * - 非爆发条目直接偏斜抽样。
 *
 * @param kindKey 调用方传 `'days-bm'` / `'days-ex'`，书签与摘录序列独立
 */
export function planDaysAgoSequence(
  seed: number,
  kindKey: string,
  persona: RecallProbePersonaId,
  count: number
): number[] {
  const rng = rngForFillerItem(seed, kindKey, 0, persona)
  const out: number[] = []
  let burstRemaining = 0
  let burstCenter = 1

  for (let i = 0; i < count; i += 1) {
    if (burstRemaining <= 0 && rng.next() < 0.45) {
      burstCenter = sampleSkewedDaysAgo(rng)
      burstRemaining = 3 + rng.nextInt(6) // 3–8
    }

    if (burstRemaining > 0) {
      const delta = rng.nextInt(7) - 3
      const day = Math.min(400, Math.max(1, burstCenter + delta))
      out.push(day)
      burstRemaining -= 1
    } else {
      out.push(sampleSkewedDaysAgo(rng))
    }
  }

  return out
}
