import type { CreateBookmarkInput, CreateTextExcerptInput } from '@/core/memory/create-memory-item'
import type { MemoryItem } from '@/core/memory/memory-item'
import type { SupportedMemoryItemType } from '@/core/memory/memory-item-type'
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

  /** 按 ID 读取 MemoryItem。 */
  async getById(id: string): Promise<MemoryItem | null> {
    return this.repository.getById(id)
  }

  /** 列出当前用户的 MemoryItem。 */
  async list(options: ListMemoryItemsOptions = {}): Promise<MemoryItem[]> {
    return this.repository.listByOwner(options)
  }

  /** 软删除 MemoryItem。 */
  async softDelete(id: string): Promise<MemoryItem | null> {
    return this.repository.softDelete(id)
  }

  /** 按 Chrome 书签 ID 软删除 Bookmark MemoryItem。 */
  async softDeleteByChromeBookmarkId(chromeBookmarkId: string): Promise<MemoryItem | null> {
    return this.repository.softDeleteByChromeBookmarkId(chromeBookmarkId)
  }

  /** 统计未删除 MemoryItem 数量。 */
  async countActive(type?: SupportedMemoryItemType): Promise<number> {
    return this.repository.countActiveByOwner(type)
  }

  /** 批量写入 MemoryItem。 */
  async putMany(items: MemoryItem[]): Promise<void> {
    return this.repository.putMany(items)
  }
}

export const memoryItemService = new MemoryItemService()
