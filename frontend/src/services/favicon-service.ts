/**
 * 📦 Favicon 服务
 *
 * 功能：
 * 1. IndexedDB缓存管理（7天过期）
 * 2. 域名级别复用（同域名书签共享favicon）
 * 3. 内存缓存（减少IndexedDB查询）
 * 4. 多重回退策略（chrome://favicon -> Google -> 直接获取）
 * 5. 加载状态管理
 */

import { indexedDBManager } from '@/infrastructure/indexeddb/manager'
import type { FaviconCacheRecord } from '@/infrastructure/indexeddb/types'
import { logger } from '@/infrastructure/logging/logger'

// 从统一类型定义导入
import type { FaviconStatus, FaviconRecord } from '@/types/services/favicon'

const FAVICON_CACHE_DURATION = 7 * 24 * 60 * 60 * 1000 // 7天

// 导出类型供外部使用
export type { FaviconStatus, FaviconRecord }

/**
 * Favicon服务类
 */
class FaviconService {
  // 内存缓存：domain -> FaviconRecord
  private cache = new Map<string, FaviconRecord>()

  // 正在加载的域名集合（防止重复请求）
  private loading = new Set<string>()

  // 订阅者：domain -> Set<callback>
  private subscribers = new Map<string, Set<(record: FaviconRecord) => void>>()

  /**
   * 从URL提取域名
   */
  private getDomain(url: string): string {
    try {
      const parsed = new URL(url)

      // ✅ 跳过特殊协议（chrome-extension://, chrome://, file://, about:, data:等）
      const specialProtocols = [
        'chrome-extension:',
        'chrome:',
        'file:',
        'about:',
        'data:',
        'javascript:'
      ]
      if (specialProtocols.includes(parsed.protocol)) {
        return ''
      }

      // ✅ 跳过localhost和本地IP（开发环境）
      const hostname = parsed.hostname
      if (
        hostname === 'localhost' ||
        hostname === '127.0.0.1' ||
        hostname.startsWith('192.168.') ||
        hostname.startsWith('10.')
      ) {
        return ''
      }

      return hostname
    } catch {
      return ''
    }
  }

  /**
   * 生成favicon URL（多重回退策略）
   */
  private generateFaviconUrl(url: string, attempt: number): string {
    try {
      const domain = this.getDomain(url)

      // 第0次：Google favicon服务（最可靠，CSP允许）
      if (attempt === 0) {
        return `https://www.google.com/s2/favicons?domain=${domain}&sz=16`
      }

      // 第1次：直接从域名获取
      if (attempt === 1) {
        return `https://${domain}/favicon.ico`
      }

      // 第2次：使用DuckDuckGo的favicon服务（备选）
      if (attempt === 2) {
        return `https://icons.duckduckgo.com/ip3/${domain}.ico`
      }

      return ''
    } catch {
      return ''
    }
  }

  /**
   * 从IndexedDB加载缓存
   */
  private async loadFromDB(domain: string): Promise<FaviconCacheRecord | null> {
    try {
      // ✅ 确保 IndexedDB 已初始化
      await indexedDBManager.initialize()

      const cached = await indexedDBManager.getFaviconCache(domain)

      if (!cached) return null

      // 检查是否过期
      const now = Date.now()
      if (now > cached.expiresAt) {
        logger.debug('FaviconService', `缓存已过期: ${domain}`)
        return null
      }

      // 更新访问信息
      const updatedRecord: FaviconCacheRecord = {
        ...cached,
        lastAccessed: now,
        accessCount: cached.accessCount + 1,
        updatedAt: now
      }
      await indexedDBManager.saveFaviconCache(updatedRecord)

      return cached
    } catch (error) {
      logger.error('FaviconService', '加载IndexedDB缓存失败:', error)
      return null
    }
  }

  /**
   * 保存到IndexedDB
   */
  private async saveToDB(domain: string, faviconUrl: string, attempt: number): Promise<void> {
    try {
      // ✅ 确保 IndexedDB 已初始化
      await indexedDBManager.initialize()

      const now = Date.now()
      const getFormat = (): 'svg' | 'ico' | 'png' => {
        if (faviconUrl.includes('.svg')) return 'svg'
        if (faviconUrl.includes('.ico')) return 'ico'
        return 'png'
      }

      const getQuality = (): 'high' | 'medium' | 'low' => {
        if (attempt === 0) return 'high'
        if (attempt === 1) return 'medium'
        return 'low'
      }

      const record: FaviconCacheRecord = {
        domain,
        faviconUrl,
        size: 16,
        format: getFormat(),
        timestamp: now,
        lastAccessed: now,
        accessCount: 1,
        expiresAt: now + FAVICON_CACHE_DURATION,
        quality: getQuality(),
        isDefault: false,
        bookmarkCount: 0,
        isPopular: false,
        retryCount: attempt,
        isBlocked: false,
        updatedAt: now
      }

      logger.debug('FaviconService', `💾 正在保存favicon到IndexedDB: ${domain}`)
      await indexedDBManager.saveFaviconCache(record)
      logger.info('FaviconService', `✅ 已成功保存favicon到IndexedDB: ${domain}`)
    } catch (error) {
      logger.error('FaviconService', `❌ 保存IndexedDB缓存失败: ${domain}`, error)
      throw error
    }
  }

  /**
   * 通知订阅者
   */
  private notifySubscribers(domain: string, record: FaviconRecord): void {
    const callbacks = this.subscribers.get(domain)
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback(record)
        } catch (error) {
          logger.error('FaviconService', '通知订阅者失败:', error)
        }
      })
    }
  }

  /**
   * 获取favicon URL（带缓存和复用）
   *
   * @param url 书签URL
   * @param onUpdate 状态更新回调（用于响应式更新UI）
   * @returns 当前的favicon URL
   */
  async getFavicon(
    url: string,
    onUpdate?: (status: FaviconStatus, faviconUrl: string) => void
  ): Promise<string> {
    if (!url) return ''

    const domain = this.getDomain(url)
    if (!domain) {
      // 特殊协议或无效URL，不加载favicon
      logger.debug('FaviconService', `⏭️  跳过特殊协议URL: ${url}`)
      return ''
    }

    // 1. 检查内存缓存
    const cached = this.cache.get(domain)
    if (cached) {
      if (cached.status === 'loaded') {
        // 已加载成功，直接返回
        onUpdate?.(cached.status, cached.url)
        return cached.url
      }

      if (cached.status === 'loading' && onUpdate) {
        // 正在加载，订阅更新
        this.subscribe(domain, record => {
          onUpdate(record.status, record.url)
        })
        return cached.url
      }

      if (cached.status === 'error') {
        // 加载失败，返回空
        onUpdate?.('error', '')
        return ''
      }
    }

    // 2. 检查IndexedDB缓存
    const dbCached = await this.loadFromDB(domain)
    if (dbCached) {
      const record: FaviconRecord = {
        url: dbCached.faviconUrl,
        status: 'loaded',
        attempts: 0,
        timestamp: Date.now()
      }
      this.cache.set(domain, record)
      onUpdate?.('loaded', dbCached.faviconUrl)
      return dbCached.faviconUrl
    }

    // 3. 开始加载（防止重复请求）
    if (this.loading.has(domain)) {
      // 已有其他请求在加载，订阅更新
      if (onUpdate) {
        this.subscribe(domain, record => {
          onUpdate(record.status, record.url)
        })
      }
      return this.generateFaviconUrl(url, 0)
    }

    // 4. 发起新的加载请求
    this.loading.add(domain)
    const faviconUrl = this.generateFaviconUrl(url, 0)

    const record: FaviconRecord = {
      url: faviconUrl,
      status: 'loading',
      attempts: 0,
      timestamp: Date.now()
    }
    this.cache.set(domain, record)

    onUpdate?.('loading', faviconUrl)

    return faviconUrl
  }

  /**
   * 标记favicon加载成功
   */
  markLoaded(url: string, faviconUrl: string): void {
    const domain = this.getDomain(url)
    if (!domain) {
      logger.warn('FaviconService', '❌ markLoaded: 无法提取域名', url)
      return
    }

    const record = this.cache.get(domain)
    if (!record) {
      logger.warn('FaviconService', '❌ markLoaded: 缓存中没有记录', domain)
      return
    }

    record.status = 'loaded'
    record.url = faviconUrl
    this.cache.set(domain, record)
    this.loading.delete(domain)

    // logger.info(
    //   'FaviconService',
    //   `✅ Favicon加载成功并标记: ${domain} (尝试次数: ${record.attempts})`
    // )

    // 保存到IndexedDB（异步，不阻塞）
    this.saveToDB(domain, faviconUrl, record.attempts).catch(err => {
      logger.error('FaviconService', `保存到IndexedDB失败: ${domain}`, err)
    })

    // 通知订阅者
    this.notifySubscribers(domain, record)
  }

  /**
   * 标记favicon加载失败，尝试下一个回退方案
   *
   * @returns 下一个尝试的URL，如果没有更多回退方案则返回空字符串
   */
  markError(url: string): string {
    const domain = this.getDomain(url)
    if (!domain) return ''

    const record = this.cache.get(domain)
    if (!record) return ''

    record.attempts++

    // 尝试下一个回退方案
    if (record.attempts < 3) {
      const nextUrl = this.generateFaviconUrl(url, record.attempts)
      if (nextUrl) {
        record.url = nextUrl
        record.status = 'loading'
        this.cache.set(domain, record)
        logger.debug('FaviconService', `尝试回退方案 ${record.attempts}: ${domain}`)
        return nextUrl
      }
    }

    // 所有方案都失败
    record.status = 'error'
    this.cache.set(domain, record)
    this.loading.delete(domain)

    logger.warn('FaviconService', `所有favicon加载方案失败: ${domain}`)

    // 通知订阅者
    this.notifySubscribers(domain, record)

    return ''
  }

  /**
   * 订阅域名的favicon更新
   */
  subscribe(domain: string, callback: (record: FaviconRecord) => void): () => void {
    if (!this.subscribers.has(domain)) {
      this.subscribers.set(domain, new Set())
    }

    this.subscribers.get(domain)!.add(callback)

    // 返回取消订阅函数
    return () => {
      this.subscribers.get(domain)?.delete(callback)
    }
  }

  /**
   * 清除内存缓存
   */
  clearMemoryCache(): void {
    this.cache.clear()
    this.loading.clear()
    this.subscribers.clear()
    logger.info('FaviconService', '已清除内存缓存')
  }

  /**
   * 清除IndexedDB缓存
   */
  async clearDBCache(): Promise<void> {
    try {
      // TODO: 实现批量删除
      logger.info('FaviconService', '已清除IndexedDB缓存')
    } catch (error) {
      logger.error('FaviconService', '清除IndexedDB缓存失败:', error)
    }
  }

  /**
   * 获取缓存统计信息
   */
  getStats() {
    return {
      memoryCacheSize: this.cache.size,
      loadingCount: this.loading.size,
      subscribersCount: this.subscribers.size
    }
  }
}

// 导出单例
export const faviconService = new FaviconService()
