/**
 * Capture 成功后异步稀疏 LLM enrichment：提议 → merge → 写回 clues。
 * 不阻塞 Capture；串行队列；失败降级（保留规则层已有字段）。
 */

import { enrichInputFromMemoryItem } from '@/core/memory/enrich-memory-clues'
import { applyMergedEnrichmentToClues } from '@/core/memory/merge-memory-clue-enrichment'
import { shouldRequestLlmMemoryEnrichment } from '@/core/memory/should-request-llm-memory-enrichment'
import type { MemoryItem } from '@/core/memory/memory-item'
import { buildMergedMemoryEnrichment } from '@/application/memory/build-merged-memory-enrichment'
import {
  memoryItemRepository,
  type MemoryItemRepository
} from '@/infrastructure/indexeddb/memory-item-repository'
import { logger } from '@/infrastructure/logging/logger'

/** 任务间距，降低 SW / Worker 尖峰。 */
const ENRICHMENT_JOB_GAP_MS = 400

let queue: Promise<void> = Promise.resolve()

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => {
    setTimeout(resolve, ms)
  })
}

function sameStringListIgnoreCase(left: string[], right: string[]): boolean {
  if (left.length !== right.length) {
    return false
  }
  const normalize = (list: string[]): string[] =>
    list.map(entry => entry.trim().toLowerCase()).sort()
  const a = normalize(left)
  const b = normalize(right)
  return a.every((value, index) => value === b[index])
}

/**
 * 对单条 MemoryItem 跑 LLM enrichment 并写回（供测试 / 队列调用）。
 * @returns written 是否真正 put；skipped 原因见日志。
 */
export async function runAsyncMemoryLlmEnrichment(
  itemId: string,
  repository: MemoryItemRepository = memoryItemRepository
): Promise<'written' | 'skipped' | 'unchanged' | 'failed'> {
  const item = await repository.getById(itemId)
  if (!item) {
    logger.info('MemoryEnrichment', '异步 LLM 跳过：条目不存在', { itemId })
    return 'skipped'
  }

  if (!shouldRequestLlmMemoryEnrichment(item)) {
    logger.info('MemoryEnrichment', '异步 LLM 跳过：门禁未通过', {
      itemId,
      hasSummary: Boolean(item.clues.summary?.trim())
    })
    return 'skipped'
  }

  logger.info('MemoryEnrichment', '异步 LLM enrichment 开始', {
    itemId,
    type: item.type
  })

  try {
    const source = enrichInputFromMemoryItem(item)
    const result = await buildMergedMemoryEnrichment({
      source,
      existing: {
        tags: item.clues.tags,
        keywords: item.clues.keywords,
        entities: item.clues.entities,
        ...(item.clues.summary !== undefined ? { summary: item.clues.summary } : {})
      },
      requestLlmProposal: true
    })

    if (result.path !== 'rule_plus_llm') {
      logger.info('MemoryEnrichment', '异步 LLM 未产生可用提议，不写回', {
        itemId,
        path: result.path
      })
      return 'skipped'
    }

    const nextClues = applyMergedEnrichmentToClues(item.clues, result.merged)
    const changed =
      !sameStringListIgnoreCase(nextClues.tags ?? [], item.clues.tags) ||
      !sameStringListIgnoreCase(nextClues.keywords ?? [], item.clues.keywords) ||
      !sameStringListIgnoreCase(nextClues.entities ?? [], item.clues.entities) ||
      (result.merged.summary !== undefined && result.merged.summary !== item.clues.summary)

    if (!changed) {
      logger.info('MemoryEnrichment', '异步 LLM 合并无新增字段', { itemId })
      return 'unchanged'
    }

    const nextItem: MemoryItem = {
      ...item,
      clues: nextClues
      // 不改 updatedAt：enrichment ≠ 用户内容变更
    }
    await repository.putEnrichmentClues(nextItem)

    logger.info('MemoryEnrichment', '异步 LLM enrichment 已写回', {
      itemId,
      tagCount: nextClues.tags?.length ?? 0,
      keywordCount: nextClues.keywords?.length ?? 0,
      entityCount: nextClues.entities?.length ?? 0,
      hasSummary: Boolean(nextClues.summary)
    })
    return 'written'
  } catch (error) {
    logger.warn('MemoryEnrichment', '异步 LLM enrichment 失败（保留规则层）', {
      itemId,
      error: error instanceof Error ? error.message : String(error)
    })
    return 'failed'
  }
}

/**
 * Fire-and-forget：Capture 返回后入队，不阻塞调用方。
 */
export function scheduleAsyncMemoryLlmEnrichment(itemId: string): void {
  const id = itemId.trim()
  if (!id) {
    return
  }

  queue = queue
    .then(async () => {
      await runAsyncMemoryLlmEnrichment(id)
      await sleep(ENRICHMENT_JOB_GAP_MS)
    })
    .catch(error => {
      logger.warn('MemoryEnrichment', '异步队列任务异常', {
        itemId: id,
        error: error instanceof Error ? error.message : String(error)
      })
    })
}

/** 测试用：重置串行队列。 */
export function resetAsyncMemoryLlmEnrichmentQueueForTests(): void {
  queue = Promise.resolve()
}
