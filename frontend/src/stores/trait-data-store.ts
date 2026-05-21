/**
 * 特征数据 Store
 * 
 * 职责：
 * - 统一管理特征统计数据（单一数据源）
 * - 自动监听 IndexedDB 变化
 * - 提供响应式数据访问
 * 
 * 设计原则：
 * - 单一数据源：避免数据重复和不一致
 * - 自动更新：监听消息，无需手动刷新
 * - 响应式：使用 Pinia 的响应式 API
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { bookmarkTraitQueryService } from '@/application/bookmark/bookmark-trait-query-service'
import type { TraitTag } from '@/core/bookmark/trait-rules'
import { logger } from '@/infrastructure/logging/logger'
import { withRetry, shouldRetryError } from '@/utils/retry-helpers'
import { requestDeduplication } from '@/utils/request-deduplication'

/**
 * 特征统计数据
 */
export interface TraitStatistics {
  duplicate: number
  invalid: number
  internal: number
  outdated?: number
  untagged?: number
  untitled?: number
}

/**
 * 特征数据 Store
 */
export const useTraitDataStore = defineStore('traitData', () => {
  // === 状态 ===
  
  /**
   * 特征统计数据
   */
  const statistics = ref<TraitStatistics>({
    duplicate: 0,
    invalid: 0,
    internal: 0
  })
  
  /**
   * 最后更新时间
   */
  const lastUpdated = ref(0)
  
  /**
   * 是否正在加载
   */
  const isLoading = ref(false)
  
  /**
   * 是否已初始化
   */
  const isInitialized = ref(false)
  
  /**
   * 最后一次错误
   */
  const lastError = ref<Error | null>(null)
  
  /**
   * 重试次数
   */
  const retryCount = ref(0)
  
  // === 计算属性 ===
  
  /**
   * 负面特征总数（需要用户关注的）
   */
  const totalNegativeTraits = computed(() => 
    statistics.value.duplicate + statistics.value.invalid
  )
  
  /**
   * 是否有需要关注的特征
   */
  const hasNegativeTraits = computed(() => totalNegativeTraits.value > 0)
  
  /**
   * 数据是否过期（超过 5 分钟）
   */
  const isStale = computed(() => {
    if (lastUpdated.value === 0) return true
    const now = Date.now()
    const fiveMinutes = 5 * 60 * 1000
    return now - lastUpdated.value > fiveMinutes
  })
  
  // === 方法 ===
  
  /**
   * 刷新特征统计（从 IndexedDB 读取）
   * 
   * @param force - 是否强制刷新（忽略缓存）
   * 
   * 优化特性：
   * - ✅ 请求去重：防止并发重复请求
   * - ✅ 自动重试：网络/数据库错误自动重试 3 次
   * - ✅ 错误记录：记录最后一次错误和重试次数
   */
  async function refresh(force = false): Promise<void> {
    // 如果正在加载且不是强制刷新，跳过
    if (isLoading.value && !force) {
      logger.debug('TraitDataStore', '正在加载中，跳过刷新')
      return
    }
    
    // 如果数据未过期且不是强制刷新，跳过
    if (!isStale.value && !force) {
      logger.debug('TraitDataStore', '数据未过期，跳过刷新')
      return
    }
    
    // ✅ 使用请求去重，防止并发重复请求
    return requestDeduplication.execute(
      'trait-data-store-refresh',
      async () => {
        isLoading.value = true
        lastError.value = null
        
        try {
          logger.debug('TraitDataStore', '开始刷新特征统计...')
          
          // ✅ 使用重试机制，提升容错能力
          const stats = await withRetry(
            () => bookmarkTraitQueryService.getTraitStatistics(),
            {
              maxRetries: 3,
              delay: 500,
              backoffFactor: 2,
              shouldRetry: shouldRetryError,
              operationName: '获取特征统计'
            }
          )
          
          statistics.value = stats
          lastUpdated.value = Date.now()
          retryCount.value = 0
          
          logger.info('TraitDataStore', '✅ 特征统计已更新', stats)
        } catch (error) {
          lastError.value = error instanceof Error ? error : new Error(String(error))
          retryCount.value++
          
          logger.error('TraitDataStore', '刷新特征统计失败', error)
          throw error
        } finally {
          isLoading.value = false
        }
      },
      1000 // 1 秒内的重复请求会被去重
    )
  }
  
  /**
   * 获取特定特征的数量
   * 
   * @param trait - 特征类型
   * @returns 数量
   */
  function getCount(trait: TraitTag): number {
    return statistics.value[trait] ?? 0
  }
  
  /**
   * 初始化（设置自动刷新监听器）
   */
  function initialize(): void {
    if (isInitialized.value) {
      logger.warn('TraitDataStore', '已经初始化，跳过')
      return
    }
    
    logger.info('TraitDataStore', '初始化特征数据 Store')
    
    // 设置自动刷新监听器
    setupAutoRefreshListener()
    
    // 初始加载
    refresh().catch(err => {
      logger.error('TraitDataStore', '初始加载失败', err)
    })
    
    isInitialized.value = true
    logger.info('TraitDataStore', '✅ 初始化完成')
  }
  
  /**
   * 设置自动刷新监听器
   * 
   * 监听特征更新消息，自动刷新统计数据
   */
  function setupAutoRefreshListener(): void {
    chrome.runtime.onMessage.addListener((message) => {
      if (message.type === 'acuity-bookmarks-trait-updated') {
        logger.info('TraitDataStore', '🏷️ 收到特征更新消息，自动刷新')
        
        // 强制刷新（忽略缓存）
        refresh(true).catch(err => {
          logger.error('TraitDataStore', '自动刷新失败', err)
        })
      }
    })
    
    logger.info('TraitDataStore', '✅ 自动刷新监听器已设置')
  }
  
  /**
   * 重置状态（用于测试）
   */
  function reset(): void {
    statistics.value = {
      duplicate: 0,
      invalid: 0,
      internal: 0
    }
    lastUpdated.value = 0
    isLoading.value = false
    isInitialized.value = false
    lastError.value = null
    retryCount.value = 0
  }
  
  return {
    // 状态
    statistics,
    lastUpdated,
    isLoading,
    isInitialized,
    lastError,
    retryCount,
    
    // 计算属性
    totalNegativeTraits,
    hasNegativeTraits,
    isStale,
    
    // 方法
    refresh,
    getCount,
    initialize,
    reset
  }
})
