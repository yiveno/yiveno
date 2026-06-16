/**
 * IndexedDB 性能监控工具
 *
 * 职责：
 * - 监控 IndexedDB 操作性能
 * - 统计读写耗时
 * - 跟踪事务成功率
 * - 检测性能瓶颈
 */

import { logger } from '@/infrastructure/logging/logger'

/**
 * 操作类型
 */
export type OperationType = 'read' | 'write' | 'delete' | 'clear' | 'count'

/**
 * 性能指标
 */
interface PerformanceMetric {
  /** 操作类型 */
  type: OperationType
  /** 对象存储名称 */
  storeName: string
  /** 操作耗时（毫秒） */
  duration: number
  /** 记录数量 */
  recordCount?: number
  /** 是否成功 */
  success: boolean
  /** 错误信息 */
  error?: string
  /** 时间戳 */
  timestamp: number
}

/**
 * 性能统计
 */
interface PerformanceStats {
  /** 总操作数 */
  totalOperations: number
  /** 成功操作数 */
  successfulOperations: number
  /** 失败操作数 */
  failedOperations: number
  /** 成功率 */
  successRate: number
  /** 平均耗时（毫秒） */
  averageDuration: number
  /** 最小耗时（毫秒） */
  minDuration: number
  /** 最大耗时（毫秒） */
  maxDuration: number
  /** 总耗时（毫秒） */
  totalDuration: number
  /** 按操作类型分组的统计 */
  byType: Record<
    OperationType,
    {
      count: number
      averageDuration: number
      successRate: number
    }
  >
  /** 按对象存储分组的统计 */
  byStore: Record<
    string,
    {
      count: number
      averageDuration: number
      successRate: number
    }
  >
}

/**
 * 性能监控器
 */
export class PerformanceMonitor {
  private metrics: PerformanceMetric[] = []
  private maxMetrics = 1000 // 最多保留 1000 条记录
  private enabled = true

  /**
   * 记录操作性能
   *
   * @param metric - 性能指标
   */
  record(metric: PerformanceMetric): void {
    if (!this.enabled) return

    this.metrics.push(metric)

    // 限制记录数量，避免内存泄漏
    if (this.metrics.length > this.maxMetrics) {
      this.metrics.shift()
    }

    // 记录慢查询（超过 100ms）
    if (metric.duration > 100) {
      logger.warn('IndexedDB', '慢查询检测', {
        type: metric.type,
        storeName: metric.storeName,
        duration: `${metric.duration.toFixed(0)}ms`,
        recordCount: metric.recordCount
      })
    }

    // 记录失败操作
    if (!metric.success) {
      logger.error('IndexedDB', '操作失败', {
        type: metric.type,
        storeName: metric.storeName,
        error: metric.error
      })
    }
  }

  /**
   * 获取性能统计
   *
   * @param timeRange - 时间范围（毫秒），默认最近 5 分钟
   * @returns 性能统计
   */
  getStats(timeRange: number = 5 * 60 * 1000): PerformanceStats {
    const now = Date.now()
    const recentMetrics = this.metrics.filter(m => now - m.timestamp <= timeRange)

    if (recentMetrics.length === 0) {
      return this.getEmptyStats()
    }

    const totalOperations = recentMetrics.length
    const successfulOperations = recentMetrics.filter(m => m.success).length
    const failedOperations = totalOperations - successfulOperations
    const successRate = successfulOperations / totalOperations

    const durations = recentMetrics.map(m => m.duration)
    const totalDuration = durations.reduce((sum, d) => sum + d, 0)
    const averageDuration = totalDuration / totalOperations
    const minDuration = Math.min(...durations)
    const maxDuration = Math.max(...durations)

    // 按操作类型分组
    const byType: PerformanceStats['byType'] = {} as PerformanceStats['byType']
    const types: OperationType[] = ['read', 'write', 'delete', 'clear', 'count']

    for (const type of types) {
      const typeMetrics = recentMetrics.filter(m => m.type === type)
      if (typeMetrics.length > 0) {
        const typeSuccessful = typeMetrics.filter(m => m.success).length
        byType[type] = {
          count: typeMetrics.length,
          averageDuration: typeMetrics.reduce((sum, m) => sum + m.duration, 0) / typeMetrics.length,
          successRate: typeSuccessful / typeMetrics.length
        }
      }
    }

    // 按对象存储分组
    const byStore: PerformanceStats['byStore'] = {}
    const storeNames = [...new Set(recentMetrics.map(m => m.storeName))]

    for (const storeName of storeNames) {
      const storeMetrics = recentMetrics.filter(m => m.storeName === storeName)
      const storeSuccessful = storeMetrics.filter(m => m.success).length
      byStore[storeName] = {
        count: storeMetrics.length,
        averageDuration: storeMetrics.reduce((sum, m) => sum + m.duration, 0) / storeMetrics.length,
        successRate: storeSuccessful / storeMetrics.length
      }
    }

    return {
      totalOperations,
      successfulOperations,
      failedOperations,
      successRate,
      averageDuration,
      minDuration,
      maxDuration,
      totalDuration,
      byType,
      byStore
    }
  }

  /**
   * 获取空统计（无数据时）
   */
  private getEmptyStats(): PerformanceStats {
    return {
      totalOperations: 0,
      successfulOperations: 0,
      failedOperations: 0,
      successRate: 0,
      averageDuration: 0,
      minDuration: 0,
      maxDuration: 0,
      totalDuration: 0,
      byType: {} as PerformanceStats['byType'],
      byStore: {}
    }
  }

  /**
   * 清空性能记录
   */
  clear(): void {
    this.metrics = []
    logger.info('IndexedDB', '性能监控记录已清空')
  }

  /**
   * 启用/禁用监控
   *
   * @param enabled - 是否启用
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled
    logger.info('IndexedDB', `性能监控已${enabled ? '启用' : '禁用'}`)
  }

  /**
   * 获取最近的慢查询
   *
   * @param threshold - 慢查询阈值（毫秒），默认 100ms
   * @param limit - 返回数量限制，默认 10 条
   * @returns 慢查询列表
   */
  getSlowQueries(threshold: number = 100, limit: number = 10): PerformanceMetric[] {
    return this.metrics
      .filter(m => m.duration > threshold)
      .sort((a, b) => b.duration - a.duration)
      .slice(0, limit)
  }

  /**
   * 获取失败操作
   *
   * @param limit - 返回数量限制，默认 10 条
   * @returns 失败操作列表
   */
  getFailedOperations(limit: number = 10): PerformanceMetric[] {
    return this.metrics
      .filter(m => !m.success)
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit)
  }

  /**
   * 导出性能数据（用于分析）
   *
   * @returns 性能指标数组
   */
  export(): PerformanceMetric[] {
    return [...this.metrics]
  }
}

/**
 * 全局性能监控器实例
 */
export const performanceMonitor = new PerformanceMonitor()

/**
 * 手动监控函数
 *
 * 用于监控任意异步操作的性能
 *
 * @param type - 操作类型
 * @param storeName - 对象存储名称
 * @param operation - 要监控的操作
 * @param recordCount - 记录数量（可选）
 * @returns 操作结果
 *
 * @example
 * ```typescript
 * const result = await monitorOperation('read', 'bookmarks', async () => {
 *   return await store.getAll()
 * }, 100)
 * ```
 */
export async function monitorOperation<T>(
  type: OperationType,
  storeName: string,
  operation: () => Promise<T>,
  recordCount?: number
): Promise<T> {
  const startTime = performance.now()
  let success = true
  let error: string | undefined

  try {
    const result = await operation()
    return result
  } catch (e) {
    success = false
    error = e instanceof Error ? e.message : String(e)
    throw e
  } finally {
    const duration = performance.now() - startTime
    performanceMonitor.record({
      type,
      storeName,
      duration,
      ...(recordCount !== undefined ? { recordCount } : {}),
      success,
      ...(error !== undefined ? { error } : {}),
      timestamp: Date.now()
    })
  }
}
