/**
 * DEV：Cold Memory Latency 测量（阶段六 D · 2026-09-21）。
 * 验证：seed N 条库后，listForKeywordRecall fallback（倒排无命中 → 全表扫）的 latency。
 *
 * 输出：
 * - seedSize：种库后总条目数
 * - recallLatencyMs：单次 listForKeywordRecall 全表扫的耗时
 * - itemsReturned：返回的候选数
 * - recallSource：inverted / scan
 *
 * 仅 import.meta.env.DEV。
 */

import { memoryItemService } from '@/application/memory/memory-item-service'
import { parseRecallClue } from '@/core/recall/parse-recall-clue'
import type { ParsedRecallClue } from '@/core/recall/parse-recall-clue-types'
import { memoryItemRepository } from '@/infrastructure/indexeddb/memory-item-repository'
import { keywordIndexRepository } from '@/infrastructure/indexeddb/keyword-index-repository'
import { flowFail, flowOk, flowStart } from '@/infrastructure/logging/flow-log'
import { logger } from '@/infrastructure/logging/logger'

export interface ColdMemoryLatencyProbe {
  /** seed 后总条目数（基线扫描）。 */
  seedSize: number
  /** 单次 listForKeywordRecall 的 fallback 路径耗时（毫秒）。 */
  recallLatencyMs: number
  /** 返回的候选条目数。 */
  itemsReturned: number
  /** 召回来源：inverted / scan。 */
  recallSource: 'inverted' | 'scan'
  /** 探针 clue（用于追溯）。 */
  clue: string
}

/**
 * 测量单次 recall fallback latency。
 *
 * 假定：种库已完毕（调用方负责 seed）。
 *
 * 实现：
 * - 用一个不存在的 word（"__yiveno_probe_latency_marker__"）作为 clue
 * - 倒排查不到 → 走 fallback 全表扫
 * - 用 performance.now() 计时
 */
export async function measureRecallFallbackLatency(clue: string): Promise<ColdMemoryLatencyProbe> {
  if (!import.meta.env.DEV) {
    throw new Error('measureRecallFallbackLatency 仅允许 DEV 构建')
  }

  const startedAt = flowStart('DevProbe', 'Cold Memory Latency 测量')
  try {
    // 基线扫描：取当前库大小（受 probe 自身的 PROBE_SCAN_LIMIT 限制）
    const baseline = await memoryItemRepository.listByOwner({ limit: 200000 })
    const seedSize = baseline.length

    const parsed: ParsedRecallClue = parseRecallClue(clue)
    const t0 = performance.now()
    const result = await memoryItemService.listForKeywordRecall({
      rawClue: clue,
      parsed
    })
    const recallLatencyMs = performance.now() - t0

    const probe: ColdMemoryLatencyProbe = {
      seedSize,
      recallLatencyMs,
      itemsReturned: result.items.length,
      recallSource: result.source,
      clue
    }

    flowOk('DevProbe', 'Cold Memory Latency 测量', startedAt, {
      seedSize,
      latencyMs: recallLatencyMs.toFixed(2),
      items: result.items.length,
      source: result.source
    })

    logger.info('DevProbe', 'Cold Memory Latency', {
      seedSize,
      latencyMs: recallLatencyMs.toFixed(2),
      items: result.items.length,
      source: result.source
    })

    return probe
  } catch (error) {
    flowFail('DevProbe', 'Cold Memory Latency 测量', startedAt, error)
    throw error
  }
}

/**
 * 默认探针 clue：保证倒排无命中，走 fallback 路径。
 * 用一个绝对不会出现在用户内容里的 token。
 */
export const PROBE_COLD_MEMORY_CLUE = '__yiveno_probe_latency_marker__'

/**
 * 便捷封装：用默认 probe clue 测 latency。
 */
export async function measureDefaultRecallFallbackLatency(): Promise<ColdMemoryLatencyProbe> {
  return measureRecallFallbackLatency(PROBE_COLD_MEMORY_CLUE)
}

// 引用 keywordIndexRepository 仅用于编译时类型确认；实际无副作用
void keywordIndexRepository
