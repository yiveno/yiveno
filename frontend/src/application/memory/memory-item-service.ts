import type { CreateBookmarkInput, CreateTextExcerptInput } from '@/core/memory/create-memory-item'
import type { MemoryItem } from '@/core/memory/memory-item'
import {
  memoryItemRepository,
  type ListMemoryItemsOptions,
  type MemoryItemRepository
} from '@/infrastructure/indexeddb/memory-item-repository'

/**
 * MemoryItem 应用服务。
 * Background 通过此层访问持久化，UI 通过 sendMessage 间接调用。
 */
export class MemoryItemService {
  constructor(private readonly repository: MemoryItemRepository = memoryItemRepository) {}

  /** 捕获当前页为 Bookmark MemoryItem。 */
  async captureBookmark(input: CreateBookmarkInput): Promise<MemoryItem> {
    return this.repository.createBookmark(input)
  }

  /** 从 Chrome 书签 upsert Bookmark MemoryItem。 */
  async upsertBookmarkFromChrome(input: CreateBookmarkInput): Promise<MemoryItem> {
    return this.repository.upsertBookmarkFromChrome(input)
  }

  /** 捕获选中文本为 Text Excerpt MemoryItem。 */
  async captureTextExcerpt(input: CreateTextExcerptInput): Promise<MemoryItem> {
    return this.repository.createTextExcerpt(input)
  }

  /** 列出当前用户的 MemoryItem。 */
  async list(options: ListMemoryItemsOptions = {}): Promise<MemoryItem[]> {
    return this.repository.listByOwner(options)
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
