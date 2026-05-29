/**
 * 筛选与批处理相关的类型定义
 *
 * 当前处于迁移阶段，因此直接在 infrastructure 层重新声明，保持与 legacy 版本同构，
 * 便于逐步替换实现细节。所有字段均配有中文注释，方便后续维护。
 */

import type { BookmarkRecord } from './records'

export interface BatchOptions<T = unknown> {
  /**
   * 单批写入时的最大条目数量，避免事务过大导致阻塞
   */
  batchSize?: number
  /**
   * 并发执行写入的上限，用于控制主线程压力
   */
  maxConcurrency?: number
  /**
   * 批处理进度回调：progress 表示已处理数量，total 是总条目数
   */
  progressCallback?: (progress: number, total: number) => void
  /**
   * 单条写入失败时的回调，item 为触发错误的原始记录
   */
  errorCallback?: (error: Error, item: T) => void
  /**
   * 批次之间的延迟时间（毫秒），用于避免阻塞事件循环
   */
  delayBetweenBatches?: number
}

export interface SearchOptions {
  /** 查询关键词 */
  query: string
  /** 返回数量上限 */
  limit?: number
  /** 包含文件夹 */
  includeFolders?: boolean
  /** 是否包含书签节点 */
  includeBookmarks?: boolean
  /** 是否包含域名匹配 */
  includeDomain?: boolean
  /** 是否包含 URL 匹配 */
  includeUrl?: boolean
  /** 是否包含关键词匹配 */
  includeKeywords?: boolean
  /** 是否包含标签匹配 */
  includeTags?: boolean
  /** 是否包含内容匹配 */
  includeContent?: boolean
  /** 最低得分阈值 */
  minScore?: number
  /** 排序字段 */
  sortBy?: 'relevance' | 'title' | 'dateAdded' | 'visitCount'
  /** 是否启用精确匹配 */
  exactMatch?: boolean
  /** 是否启用模糊匹配 */
  fuzzyMatch?: boolean
}

export interface SearchResult {
  id: string
  score: number
  pathString?: string
  bookmark: BookmarkRecord
  highlights?: Array<{ field: string; matchedText: string }>
}
