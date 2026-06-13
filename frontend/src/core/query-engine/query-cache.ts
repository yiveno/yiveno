/**
 * 查询结果缓存
 *
 * 职责：
 * - 缓存查询结果，减少重复计算
 * - 使用 LRU（最近最少使用）策略管理缓存容量
 * - 提供 TTL（生存时间）自动过期机制
 * - 统计缓存命中率
 *
 * 功能：
 * - 自动淘汰最久未使用的缓存
 * - 支持选择性失效和完全清空
 * - 提供缓存统计信息
 * - 支持缓存导入导出
 */

import type { ILogger } from '@/core/common/logger'
import { noopLogger } from '@/core/common/logger'
import type { EnhancedSearchResult } from './query-types'

/**
 * 缓存条目接口
 */
interface CacheEntry {
  /** 缓存键 */
  key: string
  /** 缓存的查询结果 */
  value: EnhancedSearchResult[]
  /** 创建时间戳 */
  timestamp: number
  /** 命中次数 */
  hits: number
  /** 最后访问时间 */
  lastAccess: number
}

/**
 * 查询缓存类
 */
export class QueryCache {
  /** 缓存存储（使用 Map 以保证插入顺序） */
  private cache: Map<string, CacheEntry>
  /** 最大缓存条目数 */
  private maxSize: number
  /** 缓存生存时间（毫秒） */
  private ttl: number
  /** 缓存命中次数 */
  private hits: number = 0
  /** 缓存未命中次数 */
  private misses: number = 0
  /** Logger 实例 */
  private logger: ILogger

  /**
   * 构造函数
   *
   * @param options - 缓存配置选项
   * @param options.maxSize - 最大缓存条目数，默认 1000
   * @param options.ttl - 缓存生存时间（毫秒），默认 5 分钟
   * @param options.logger - Logger 实例，默认使用 noopLogger
   */
  constructor(
    options: {
      maxSize?: number
      ttl?: number
      logger?: ILogger
    } = {}
  ) {
    this.maxSize = options.maxSize || 1000
    this.ttl = options.ttl || 5 * 60 * 1000 // 默认5分钟
    this.cache = new Map()
    this.logger = options.logger || noopLogger
  }

  /** 运行时注入 Logger（Application 层启动时调用） */
  useLogger(logger: ILogger): void {
    this.logger = logger
  }

  /**
   * 生成缓存键
   *
   * 根据查询字符串和选项生成唯一的缓存键
   *
   * @param query - 查询字符串
   * @param options - 查询选项
   * @returns 缓存键
   */
  private generateKey(query: string, options?: Record<string, unknown>): string {
    const normalized = query.toLowerCase().trim()
    const optionsStr = options ? JSON.stringify(options) : ''
    return `${normalized}:${optionsStr}`
  }

  /**
   * 获取缓存的查询结果
   *
   * 检查缓存是否存在且未过期，更新访问统计
   * ✅ 优化：使用 Map 的删除+重新插入来维护 LRU 顺序（O(1) 操作）
   *
   * @param query - 查询字符串
   * @param options - 查询选项
   * @returns 缓存的查询结果，未命中或已过期时返回 null
   */
  get(query: string, options?: Record<string, unknown>): EnhancedSearchResult[] | null {
    const key = this.generateKey(query, options)
    const entry = this.cache.get(key)

    if (!entry) {
      this.misses++
      return null
    }

    // 检查是否过期
    const now = Date.now()
    if (now - entry.timestamp > this.ttl) {
      this.cache.delete(key)
      this.misses++
      this.logger.info('QueryCache', `缓存过期: ${query}`)
      return null
    }

    // ✅ LRU 优化：删除后重新插入，移到 Map 末尾（最近使用）
    // Map 保证插入顺序，第一个元素是最久未使用的
    this.cache.delete(key)
    entry.hits++
    entry.lastAccess = now
    this.cache.set(key, entry)

    this.hits++

    this.logger.info('QueryCache', `缓存命中: ${query}`)
    return entry.value
  }

  /**
   * 设置缓存结果
   *
   * 如果缓存已满，使用 LRU 策略淘汰最久未使用的条目
   * ✅ 优化：利用 Map 的插入顺序，第一个元素即为最久未使用
   *
   * @param query - 查询字符串
   * @param results - 查询结果数组
   * @param options - 查询选项
   */
  set(query: string, results: EnhancedSearchResult[], options?: Record<string, unknown>): void {
    const key = this.generateKey(query, options)
    const now = Date.now()

    // ✅ 优化：如果 key 已存在，先删除（避免重复）
    if (this.cache.has(key)) {
      this.cache.delete(key)
    }

    // 检查容量，执行 LRU 淘汰
    if (this.cache.size >= this.maxSize) {
      this.evictLRU()
    }

    const entry: CacheEntry = {
      key,
      value: results,
      timestamp: now,
      hits: 0,
      lastAccess: now
    }

    this.cache.set(key, entry)
    this.logger.info('QueryCache', `缓存写入: ${query} (${results.length} 条结果)`)
  }

  /**
   * LRU 淘汰策略
   *
   * 移除最久未访问的缓存条目
   * ✅ 优化：利用 Map 的插入顺序，第一个元素即为最久未使用（O(1) 操作）
   */
  private evictLRU(): void {
    // Map 保证插入顺序，第一个元素是最久未使用的
    const firstKey = this.cache.keys().next().value

    if (firstKey) {
      const evictedEntry = this.cache.get(firstKey)
      this.cache.delete(firstKey)
      this.logger.info('QueryCache', `LRU 淘汰: ${evictedEntry?.key || firstKey}`)
    }
  }

  /**
   * 使匹配的缓存失效
   *
   * @param pattern - 可选的正则表达式模式，匹配缓存键。不提供时清空所有缓存
   */
  invalidate(pattern?: string): void {
    if (!pattern) {
      this.cache.clear()
      this.logger.info('QueryCache', '清空所有缓存')
      return
    }

    const regex = new RegExp(pattern, 'i')
    let count = 0

    for (const [key, entry] of this.cache.entries()) {
      if (regex.test(entry.key)) {
        this.cache.delete(key)
        count++
      }
    }

    this.logger.info('QueryCache', `失效 ${count} 条缓存 (模式: ${pattern})`)
  }

  /**
   * 清空所有缓存
   *
   * 重置缓存内容和统计信息
   */
  clear(): void {
    this.cache.clear()
    this.hits = 0
    this.misses = 0
    this.logger.info('QueryCache', '缓存已清空')
  }

  /**
   * 获取缓存统计信息
   *
   * @returns 包含缓存大小、命中率、热门条目等统计数据
   */
  getStats(): {
    size: number
    maxSize: number
    hitRate: number
    hits: number
    misses: number
    entries: Array<{
      key: string
      hits: number
      age: number
    }>
  } {
    const now = Date.now()
    const entries = Array.from(this.cache.values()).map(entry => ({
      key: entry.key,
      hits: entry.hits,
      age: now - entry.timestamp
    }))

    const total = this.hits + this.misses
    const hitRate = total > 0 ? this.hits / total : 0

    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hitRate,
      hits: this.hits,
      misses: this.misses,
      entries: entries.sort((a, b) => b.hits - a.hits).slice(0, 10)
    }
  }

  /**
   * 预热缓存
   *
   * 批量加载常用查询到缓存中，提升首次查询性能
   * ✅ 优化：支持异步加载，不阻塞主线程
   *
   * @param queries - 查询和结果数组
   */
  async warmup(queries: Array<{ query: string; results: EnhancedSearchResult[] }>): Promise<void> {
    this.logger.info('QueryCache', `预热缓存: ${queries.length} 条查询`)

    for (const { query, results } of queries) {
      this.set(query, results)

      // ✅ 每 10 条查询让出主线程，避免阻塞
      if (queries.indexOf({ query, results }) % 10 === 0) {
        await new Promise(resolve => setTimeout(resolve, 0))
      }
    }

    this.logger.info('QueryCache', `缓存预热完成，当前缓存大小: ${this.cache.size}`)
  }

  /**
   * 智能失效策略
   *
   * 根据书签变更类型，选择性失效相关缓存
   * ✅ 优化：避免全量清空，只失效受影响的查询
   *
   * @param changeType - 变更类型
   * @param affectedIds - 受影响的书签ID（可选）
   */
  invalidateByChange(
    changeType: 'bookmark_created' | 'bookmark_updated' | 'bookmark_deleted' | 'full_sync',
    affectedIds?: string[]
  ): void {
    switch (changeType) {
      case 'full_sync':
        // 全量同步：清空所有缓存
        this.clear()
        this.logger.info('QueryCache', '全量同步，清空所有缓存')
        break

      case 'bookmark_created':
      case 'bookmark_updated':
        // 新增/更新：只失效可能受影响的缓存
        // 策略：保留缓存，让 TTL 自然过期（避免过度失效）
        this.logger.info(
          'QueryCache',
          `书签${changeType === 'bookmark_created' ? '新增' : '更新'}，保留缓存（TTL 自然过期）`
        )
        break

      case 'bookmark_deleted':
        // 删除：失效包含已删除书签的缓存
        if (affectedIds && affectedIds.length > 0) {
          let invalidatedCount = 0

          for (const [key, entry] of this.cache.entries()) {
            // 检查缓存结果中是否包含已删除的书签
            const hasDeletedBookmark = entry.value.some(result =>
              affectedIds.includes(result.bookmark.id)
            )

            if (hasDeletedBookmark) {
              this.cache.delete(key)
              invalidatedCount++
            }
          }

          this.logger.info('QueryCache', `书签删除，失效 ${invalidatedCount} 条缓存`)
        }
        break
    }
  }

  /**
   * 导出缓存数据
   *
   * 用于持久化或迁移缓存
   *
   * @returns 缓存条目数组
   */
  export(): Array<{
    key: string
    value: EnhancedSearchResult[]
    timestamp: number
  }> {
    return Array.from(this.cache.values()).map(entry => ({
      key: entry.key,
      value: entry.value,
      timestamp: entry.timestamp
    }))
  }

  /**
   * 导入缓存数据
   *
   * 从持久化存储或其他来源导入缓存，只导入未过期的数据
   *
   * @param data - 要导入的缓存条目数组
   */
  import(
    data: Array<{
      key: string
      value: EnhancedSearchResult[]
      timestamp: number
    }>
  ): void {
    const now = Date.now()
    let imported = 0

    for (const item of data) {
      // 只导入未过期的数据
      if (now - item.timestamp <= this.ttl) {
        this.cache.set(item.key, {
          ...item,
          hits: 0,
          lastAccess: now
        })
        imported++
      }
    }

    this.logger.info('QueryCache', `导入 ${imported} 条缓存`)
  }
}
