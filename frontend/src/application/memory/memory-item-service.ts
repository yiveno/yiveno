/**
 * MemoryItem 应用服务。
 * Background 通过此层访问持久化，UI 通过 sendMessage 间接调用。
 */

import { scheduleAsyncMemoryEmbedding } from '@/application/memory/schedule-async-memory-embedding'
import { scheduleAsyncMemoryLlmEnrichment } from '@/application/memory/schedule-async-memory-llm-enrichment'
import { RECALL_SCAN_LIMIT } from '@/application/recall/backends/recall-scan-limit'
import type { CreateBookmarkInput, CreateTextExcerptInput } from '@/core/memory/create-memory-item'
import type { MemoryItem } from '@/core/memory/memory-item'
import {
  buildSearchClueFromParsed,
  shouldRecallByConstraintNeighborhood
} from '@/core/recall/orchestrate-keyword-recall'
import type { ParsedRecallClue } from '@/core/recall/parse-recall-clue-types'
import { filterMemoryItemsByKeyword } from '@/core/recall/keyword-filter'
import { logger } from '@/infrastructure/logging/logger'
import { keywordIndexRepository } from '@/infrastructure/indexeddb/keyword-index-repository'
import {
  memoryItemRepository,
  type ListMemoryItemsOptions,
  type MemoryItemRepository
} from '@/infrastructure/indexeddb/memory-item-repository'

export class MemoryItemService {
  constructor(private readonly repository: MemoryItemRepository = memoryItemRepository) {}

  /** 捕获当前页为 Bookmark MemoryItem；落库后异步稀疏 LLM enrichment + Pro embedding。 */
  async captureBookmark(input: CreateBookmarkInput): Promise<MemoryItem> {
    const item = await this.repository.createBookmark(input)
    scheduleAsyncMemoryLlmEnrichment(item.id)
    scheduleAsyncMemoryEmbedding(item.id)
    return item
  }

  /**
   * 从 Chrome 书签 upsert Bookmark MemoryItem。
   * **不**调度 LLM enrichment / embedding：sync/reconcile 可能成千上万条，与 bulk 一致不烧配额。
   * 用户主动 Capture（{@link captureBookmark}）仍会调度。
   */
  async upsertBookmarkFromChrome(input: CreateBookmarkInput): Promise<MemoryItem> {
    return this.repository.upsertBookmarkFromChrome(input)
  }

  /** 捕获选中文本为 Text Excerpt MemoryItem；落库后异步稀疏 LLM enrichment + Pro embedding。 */
  async captureTextExcerpt(input: CreateTextExcerptInput): Promise<MemoryItem> {
    const item = await this.repository.createTextExcerpt(input)
    scheduleAsyncMemoryLlmEnrichment(item.id)
    scheduleAsyncMemoryEmbedding(item.id)
    return item
  }

  /** 列出当前用户的 MemoryItem。 */
  async list(options: ListMemoryItemsOptions = {}): Promise<MemoryItem[]> {
    return this.repository.listByOwner(options)
  }

  /**
   * 倒排候选并入摘录：书签 posting 常漏摘录 token，而摘录才是核心资产。
   * 摘录放前面，避免 inverted 已达 cap 时被 slice 丢掉。
   */
  private async mergeExcerptsIntoCandidates(items: MemoryItem[]): Promise<MemoryItem[]> {
    const excerpts = await this.repository.listByOwner({ type: 'text_excerpt', limit: 500 })
    if (excerpts.length === 0) {
      return items
    }
    const excerptIds = new Set(excerpts.map(item => item.id))
    const trailing = items.filter(item => !excerptIds.has(item.id))
    // 摘录优先，避免倒排已达 cap 时 slice 截断掉核心资产
    return [...excerpts, ...trailing]
  }

  /**
   * Recall 候选加载：优先关键词倒排预过滤；失败 / 无查询 token 则 fallback 全表扫描。
   * 约束邻域（无内容词 + 时间/刚存 + 类型）必须全表扫：倒排会按类型词面（如 bookmark）查 posting，
   * 真实书签标题几乎不含该词 → 空候选误报 no_match。
   */
  async listForKeywordRecall(input: {
    rawClue: string
    parsed: ParsedRecallClue
    limit?: number
  }): Promise<{ items: MemoryItem[]; source: 'inverted' | 'scan' }> {
    const limit = input.limit ?? RECALL_SCAN_LIMIT

    if (shouldRecallByConstraintNeighborhood(input.parsed)) {
      const items = await this.mergeExcerptsIntoCandidates(
        await this.repository.listByOwner({ limit })
      )
      return { items: items.slice(0, limit), source: 'scan' }
    }

    const searchClue = buildSearchClueFromParsed(input.parsed) || input.rawClue

    try {
      const lookup = await keywordIndexRepository.lookupCandidateIds(searchClue)
      // 空 id 不能当「库内无命中」：登录 remap 后 posting 可能与 Memory 不一致，
      // 否则整库仍在 IndexedDB 却每条线索都 no_match。
      if (lookup != null && lookup.ids.length > 0) {
        const items = await this.repository.getManyByIds(lookup.ids)
        if (items.length > 0) {
          const merged = await this.mergeExcerptsIntoCandidates(items)
          const keywordProbe = filterMemoryItemsByKeyword(merged, searchClue, { limit: 1 })
          if (keywordProbe.length === 0) {
            logger.info('Memory', 'Recall 候选：倒排预过滤无关键词命中，降级全表扫', {
              invertedCount: items.length,
              mergedCount: merged.length,
              rebuilt: lookup.rebuilt
            })
          } else {
            logger.info('Memory', 'Recall 候选：倒排预过滤', {
              candidateCount: merged.length,
              excerptCount: merged.length - items.length,
              rebuilt: lookup.rebuilt
            })
            return { items: merged.slice(0, limit), source: 'inverted' }
          }
        }
        logger.info('Memory', 'Recall 候选：倒排 id 无法读回条目，降级全表扫', {
          lookupCount: lookup.ids.length
        })
      } else if (lookup != null) {
        logger.info('Memory', 'Recall 候选：倒排无命中，降级全表扫', {
          rebuilt: lookup.rebuilt
        })
      }
    } catch (error) {
      logger.warn('Memory', 'Recall 候选：倒排查询失败，降级全表扫', {
        error: error instanceof Error ? error.message : String(error)
      })
    }

    const items = await this.mergeExcerptsIntoCandidates(
      await this.repository.listByOwner({ limit })
    )
    logger.info('Memory', 'Recall 候选：全表扫描', { candidateCount: items.length })
    return { items: items.slice(0, limit), source: 'scan' }
  }

  /** 按 id 读取当前用户的 MemoryItem。 */
  async getById(id: string): Promise<MemoryItem | null> {
    return this.repository.getById(id)
  }

  /** 软删除 MemoryItem。 */
  async softDelete(id: string): Promise<MemoryItem | null> {
    return this.repository.softDelete(id)
  }

  /** 更新 clues.note（书签/摘录事后补注）。 */
  async updateNote(id: string, note: string): Promise<MemoryItem | null> {
    return this.repository.updateNote(id, note)
  }

  /** 书签树对齐表（chromeId / URL → Memory id；含备注）。 */
  async listBookmarkSyncAlignment() {
    return this.repository.listBookmarkSyncAlignment()
  }

  /** 记录打开：递增 openCount，更新 lastOpenedAt（不改 updatedAt）。 */
  async recordOpen(id: string): Promise<MemoryItem | null> {
    return this.repository.recordOpen(id)
  }

  /** 记录 settled 正例：递增 settledCount（§7.2；不改 updatedAt）。 */
  async recordSettle(id: string): Promise<MemoryItem | null> {
    return this.repository.recordSettle(id)
  }

  /** 否定反馈：递增 dismissCount（不改 updatedAt）。 */
  async recordDismiss(ids: string[]): Promise<number> {
    return this.repository.recordDismiss(ids)
  }

  /** 按 Chrome 书签 ID 软删除 Bookmark MemoryItem。 */
  async softDeleteByChromeBookmarkId(chromeBookmarkId: string): Promise<MemoryItem | null> {
    return this.repository.softDeleteByChromeBookmarkId(chromeBookmarkId)
  }
}

export const memoryItemService = new MemoryItemService()
