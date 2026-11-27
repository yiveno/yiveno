/**
 * 行为播种：只吃语料视图 + 种子；与 clue 解耦。
 */

import type { MemoryItem } from '@/core/memory/memory-item'
import { BEHAVIOR_ABLATION_NOW_MS, BEHAVIOR_ABLATION_SIZES } from './constants'
import { createMulberry32, nextInt, nextIntInclusive } from './prng'
import type { BehaviorSeedRow, ClueGenItemView } from './types'

function hoursBeforeNow(hours: number): string {
  return new Date(BEHAVIOR_ABLATION_NOW_MS - hours * 60 * 60 * 1000).toISOString()
}

/**
 * 按潜在常用度抽样行为字段。
 * 签名只接收 views（无行为）+ seed — 不接收 clue。
 */
export function seedBehaviorRows(
  views: readonly ClueGenItemView[],
  seed: number
): BehaviorSeedRow[] {
  if (views.length !== BEHAVIOR_ABLATION_SIZES.corpusItems) {
    throw new Error(`seedBehaviorRows: views ${views.length}`)
  }
  const rng = createMulberry32(seed ^ 0x22)
  const rows: BehaviorSeedRow[] = []

  // 按簇内出现顺序：靠前条目结构性更「常用」（不读 clue；与 clue 生成各自独立偏好靠前项）
  const indexInCluster = new Map<string, number>()
  const clusterSeen = new Map<string, number>()
  for (const view of views) {
    const seen = clusterSeen.get(view.clusterId) ?? 0
    indexInCluster.set(view.id, seen)
    clusterSeen.set(view.clusterId, seen + 1)
  }

  for (const view of views) {
    const localIndex = indexInCluster.get(view.id) ?? 9
    // 潜在常用度：重尾；簇内前 3 条抬底，与 clue 侧「优先抽靠前目标」独立对齐结构位
    const u = rng()
    let popularityDraw =
      u < 0.12 ? 0.85 + rng() * 0.15 : u < 0.45 ? 0.35 + rng() * 0.35 : rng() * 0.3
    if (localIndex <= 2) {
      popularityDraw = Math.max(popularityDraw, 0.72 + (2 - localIndex) * 0.08 + rng() * 0.05)
    } else if (localIndex >= 7) {
      popularityDraw = Math.min(popularityDraw, 0.25 + rng() * 0.15)
    }

    const openCount =
      popularityDraw > 0.7
        ? nextIntInclusive(rng, 8, 40)
        : popularityDraw > 0.4
          ? nextIntInclusive(rng, 2, 10)
          : nextInt(rng, 3)

    const settledCount =
      popularityDraw > 0.75
        ? nextIntInclusive(rng, 3, 12)
        : popularityDraw > 0.5
          ? nextIntInclusive(rng, 1, 4)
          : nextInt(rng, 2)

    // 少量条目带 dismiss，制造罚分对照
    const dismissCount = rng() < 0.08 ? nextIntInclusive(rng, 1, 4) : 0

    const lastOpenedAt =
      openCount > 0
        ? hoursBeforeNow(nextIntInclusive(rng, 1, popularityDraw > 0.6 ? 120 : 720))
        : null

    rows.push({
      itemId: view.id,
      openCount,
      settledCount,
      dismissCount,
      lastOpenedAt,
      popularityDraw: Math.round(popularityDraw * 1000) / 1000
    })
  }
  return rows
}

/** 把行为行写回 MemoryItem.clues（不可变拷贝）。 */
export function applyBehaviorToCorpus(
  items: readonly MemoryItem[],
  behavior: readonly BehaviorSeedRow[]
): MemoryItem[] {
  const byId = new Map(behavior.map(row => [row.itemId, row]))
  return items.map(item => {
    const row = byId.get(item.id)
    if (!row) {
      return item
    }
    return {
      ...item,
      clues: {
        ...item.clues,
        openCount: row.openCount,
        settledCount: row.settledCount,
        dismissCount: row.dismissCount,
        lastOpenedAt: row.lastOpenedAt
      }
    }
  })
}

/** 清零行为字段（OFF / ON-cond 臂）。 */
export function clearBehaviorOnCorpus(items: readonly MemoryItem[]): MemoryItem[] {
  return items.map(item => ({
    ...item,
    clues: {
      ...item.clues,
      openCount: 0,
      settledCount: 0,
      dismissCount: 0,
      lastOpenedAt: null,
      lastSettledAt: null,
      lastDismissedAt: null
    }
  }))
}
