/**
 * MemoryItem 应用服务。
 * Background 通过此层访问持久化，UI 通过 sendMessage 间接调用。
 */

import { scheduleAsyncMemoryEmbedding } from '@/application/memory/schedule-async-memory-embedding'
import { scheduleAsyncMemoryLlmEnrichment } from '@/application/memory/schedule-async-memory-llm-enrichment'
import { RECALL_SCAN_LIMIT } from '@/application/recall/backends/recall-scan-limit'
import type { CreateBookmarkInput, CreateTextExcerptInput } from '@/core/memory/create-memory-item'
import type { MemoryItem } from '@/core/memory/memory-item'
import { buildSearchClueFromParsed } from '@/core/recall/orchestrate-keyword-recall'
import type { ParsedRecallClue } from '@/core/recall/parse-recall-clue-types'
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
   * 仅新建时调度异步 LLM / embedding（更新标题/URL 不重复烧配额；bulk 走 repository 不经此层）。
   */
  async upsertBookmarkFromChrome(input: CreateBookmarkInput): Promise<MemoryItem> {
    const chromeBookmarkId = input.payload.chromeBookmarkId?.trim()
    const existed = chromeBookmarkId
      ? await this.repository.getByChromeBookmarkId(chromeBookmarkId)
      : null
    const item = await this.repository.upsertBookmarkFromChrome(input)
    if (!existed) {
      scheduleAsyncMemoryLlmEnrichment(item.id)
      scheduleAsyncMemoryEmbedding(item.id)
    }
    return item
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
   * Recall 候选加载：优先关键词倒排预过滤；失败 / 无查询 token 则 fallback 全表扫描。
   */
  async listForKeywordRecall(input: {
    rawClue: string
    parsed: ParsedRecallClue
    limit?: number
  }): Promise<{ items: MemoryItem[]; source: 'inverted' | 'scan' }> {
    const limit = input.limit ?? RECALL_SCAN_LIMIT
    const searchClue = buildSearchClueFromParsed(input.parsed) || input.rawClue

    try {
      const lookup = await keywordIndexRepository.lookupCandidateIds(searchClue)
      if (lookup != null) {
        const items = await this.repository.getManyByIds(lookup.ids)
        return { items: items.slice(0, limit), source: 'inverted' }
      }
    } catch {
      // 倒排异常时降级全表扫，不阻断找回
    }

    const items = await this.repository.listByOwner({ limit })
    return { items, source: 'scan' }
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
