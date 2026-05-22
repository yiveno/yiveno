/**
 * 🚀 查询性能监控系统
 *
 * 职责：
 * - 实时监控查询性能指标
 * - 分析性能趋势和瓶颈
 * - 提供优化建议
 * - 识别慢查询和性能问题
 *
 * 功能：
 * - 记录每次查询的性能数据
 * - 计算统计指标（平均值、中位数、P95、P99）
 * - 分析缓存命中率和成功率
 * - 生成性能优化建议
 * - 检测性能告警
 *
 * 基于 Chrome Performance API 和最佳实践
 */

import { logger } from '@/infrastructure/logging/logger'
// Service Worker 环境中不能导入 notification-service（包含 Vue）
// 使用动态导入避免在 Service Worker 中加载 Vue
const getNotify = async () => {
  // Service Worker 环境检查
  if (typeof document === 'undefined') {
    return null
  }
  const { notify } = await import('@/application/notification/notification-service')
  return notify
}

// 从统一类型定义导入
import type {
  PerformanceMetric,
  PerformanceStats,
  PerformanceTrend,
  SlowQuery,
  TopQuery,
  OptimizationSuggestion,
  AlertThreshold
} from '@/types/services/performance'

// ==================== 性能监控主类 ====================

/**
 * 查询性能监控器
 *
 * 负责记录、分析和报告查询性能数据
 */
export class QueryPerformanceMonitor {
  /** 性能指标记录数组 */
  private metrics: PerformanceMetric[] = []
  /** 最多保存的记录数量 */
  private readonly maxMetrics = 10000
  /** 当前会话ID */
  private sessionId: string
  /** 告警阈值配置 */
  private alertThresholds: AlertThreshold

  /** 性能分析配置 */
  private readonly analysisConfig = {
    slowQueryThreshold: 500, // 慢查询阈值(ms)
    trendAnalysisPeriod: 24, // 趋势分析周期(小时)
    alertCheckInterval: 5 * 60, // 告警检查间隔(秒)
    performanceWindowSize: 100, // 性能统计窗口大小
    topQueryLimit: 20 // 热门查询限制
  }

  /**
   * 构造函数
   *
   * 初始化监控系统，生成会话ID，设置告警阈值
   */
  constructor() {
    this.sessionId = this.generateSessionId()
    this.alertThresholds = {
      averageResponseTime: 200, // 平均响应时间阈值
      cacheHitRate: 0.3, // 缓存命中率阈值
      errorRate: 0.05, // 错误率阈值 (5%)
      slowQueryThreshold: 1000 // 慢查询阈值
    }

    this.initializeMonitor()
  }

  /**
   * 初始化性能监控系统
   */
  private initializeMonitor(): void {
    logger.info('PerformanceMonitor', '初始化查询性能监控系统...')
    // 定时任务已被移除，以减少后台活动
    logger.info('PerformanceMonitor', '性能监控系统初始化完成')
  }

  /**
   * 记录查询性能数据
   *
   * 核心功能：记录每次查询的详细性能指标
   *
   * @param searchData - 查询性能数据
   * @param searchData.query - 查询查询字符串
   * @param searchData.duration - 查询耗时（毫秒）
   * @param searchData.resultCount - 结果数量
   * @param searchData.cacheHit - 是否命中缓存
   * @param searchData.searchMode - 查询模式
   * @param searchData.sources - 数据源列表
   * @param searchData.success - 是否成功
   * @param searchData.errorMessage - 错误消息（如果失败）
   */
  recordSearch(searchData: {
    query: string
    duration: number
    resultCount: number
    cacheHit: boolean
    searchMode: string
    sources: string[]
    success: boolean
    errorMessage?: string
  }): void {
    const metric: PerformanceMetric = {
      id: this.generateMetricId(),
      query: searchData.query,
      duration: searchData.duration,
      resultCount: searchData.resultCount,
      cacheHit: searchData.cacheHit,
      searchMode: searchData.searchMode,
      timestamp: Date.now(),
      sessionId: this.sessionId,
      sources: [...searchData.sources],
      success: searchData.success,
      ...(searchData.errorMessage !== undefined ? { errorMessage: searchData.errorMessage } : {})
    }

    this.metrics.push(metric)

    // 限制内存使用
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics)
    }

    // 实时性能分析
    this.analyzeMetricRealtime(metric)

    logger.info(
      'PerformanceMonitor',
      `📈 记录查询: "${searchData.query}" - ${searchData.duration.toFixed(2)}ms`
    )
  }

  /**
   * 获取详细性能统计
   */
  getPerformanceStats(windowSize?: number): PerformanceStats {
    const recentMetrics = this.getRecentMetrics(
      windowSize || this.analysisConfig.performanceWindowSize
    )

    if (recentMetrics.length === 0) {
      return this.getEmptyStats()
    }

    const durations = recentMetrics.map(m => m.duration).sort((a, b) => a - b)
    const cacheHits = recentMetrics.filter(m => m.cacheHit).length
    const successfulSearches = recentMetrics.filter(m => m.success).length

    return {
      // 基础统计
      totalSearches: this.metrics.length,
      averageResponseTime: this.calculateAverage(durations),
      medianResponseTime: this.calculateMedian(durations),
      p95ResponseTime: this.calculatePercentile(durations, 0.95),
      p99ResponseTime: this.calculatePercentile(durations, 0.99),

      // 缓存统计
      cacheHitRate: cacheHits / recentMetrics.length,
      cacheSize: this.estimateCacheSize(),

      // 成功率统计
      successRate: successfulSearches / recentMetrics.length,
      errorRate: (recentMetrics.length - successfulSearches) / recentMetrics.length,

      // 查询模式统计
      searchModeDistribution: this.calculateSearchModeDistribution(recentMetrics),

      // 时间趋势
      performanceTrend: this.calculatePerformanceTrend(),

      // 慢查询
      slowQueries: this.getSlowQueries(),

      // 热门查询
      topQueries: this.getTopQueries()
    }
  }

  /**
   * 生成性能优化建议
   */
  getOptimizationSuggestions(): OptimizationSuggestion[] {
    const stats = this.getPerformanceStats()
    const suggestions: OptimizationSuggestion[] = []

    // 响应时间建议
    if (stats.averageResponseTime > this.alertThresholds.averageResponseTime) {
      suggestions.push({
        type: 'performance',
        severity: stats.averageResponseTime > 500 ? 'high' : 'medium',
        message: `平均查询响应时间过长 (${stats.averageResponseTime.toFixed(0)}ms)`,
        action: '考虑优化查询算法或增加缓存',
        impact: 'high',
        effort: 'medium',
        priority: this.calculatePriority(
          'performance',
          stats.averageResponseTime / this.alertThresholds.averageResponseTime
        )
      })
    }

    // 缓存命中率建议
    if (stats.cacheHitRate < this.alertThresholds.cacheHitRate) {
      suggestions.push({
        type: 'caching',
        severity: stats.cacheHitRate < 0.2 ? 'high' : 'medium',
        message: `缓存命中率较低 (${(stats.cacheHitRate * 100).toFixed(1)}%)`,
        action: '优化缓存策略，增加缓存时间或改进缓存键生成',
        impact: 'high',
        effort: 'low',
        priority: this.calculatePriority('caching', (1 - stats.cacheHitRate) * 5)
      })
    }

    // 错误率建议
    if (stats.errorRate > this.alertThresholds.errorRate) {
      suggestions.push({
        type: 'performance',
        severity: stats.errorRate > 0.1 ? 'critical' : 'high',
        message: `查询错误率过高 (${(stats.errorRate * 100).toFixed(1)}%)`,
        action: '检查查询逻辑，增强错误处理和降级机制',
        impact: 'high',
        effort: 'high',
        priority: this.calculatePriority('critical', stats.errorRate * 20)
      })
    }

    // 慢查询建议
    if (stats.slowQueries.length > 5) {
      suggestions.push({
        type: 'indexing',
        severity: 'medium',
        message: `存在多个慢查询 (${stats.slowQueries.length}个)`,
        action: '分析慢查询模式，考虑预建索引或查询优化',
        impact: 'medium',
        effort: 'medium',
        priority: this.calculatePriority('indexing', stats.slowQueries.length / 5)
      })
    }

    // 查询模式分布建议
    const totalSearches = Object.values(stats.searchModeDistribution).reduce((a, b) => a + b, 0)
    const smartSearchRatio = (stats.searchModeDistribution.smart || 0) / totalSearches

    if (smartSearchRatio < 0.5 && totalSearches > 50) {
      suggestions.push({
        type: 'configuration',
        severity: 'low',
        message: '智能查询使用率较低，用户可能更偏好快速查询',
        action: '考虑优化智能查询性能，或调整默认查询模式',
        impact: 'medium',
        effort: 'low',
        priority: this.calculatePriority('configuration', 1 - smartSearchRatio)
      })
    }

    // 按优先级排序
    return suggestions.sort((a, b) => b.priority - a.priority)
  }

  /**
   * 实时指标分析
   */
  private analyzeMetricRealtime(metric: PerformanceMetric): void {
    // 检查慢查询
    if (metric.duration > this.analysisConfig.slowQueryThreshold) {
      logger.warn('PerformanceMonitor', `🐌 慢查询检测: "${metric.query}" - ${metric.duration}ms`)

      // 可以触发实时告警
      this.triggerSlowQueryAlert(metric)
    }

    // 检查错误
    if (!metric.success) {
      logger.error(
        'Component',
        'PerformanceMonitor',
        `❌ 查询失败: "${metric.query}" - ${metric.errorMessage}`
      )
    }

    // 检查异常高的响应时间
    const recent = this.getRecentMetrics(10)
    const recentAverage = this.calculateAverage(recent.map(m => m.duration))

    if (metric.duration > recentAverage * 3 && recentAverage > 0) {
      logger.warn(
        'PerformanceMonitor',
        `⚡ 响应时间异常: ${metric.duration}ms (平均: ${recentAverage.toFixed(0)}ms)`
      )
    }
  }

  /**
   * 慢查询告警
   */
  private triggerSlowQueryAlert(metric: PerformanceMetric): void {
    // 系统通知（warning 级），短时间内相同查询抑制
    const title = '慢查询告警'
    const msg = `"${metric.query}" ${metric.duration}ms / 结果 ${metric.resultCount}`

    // Service Worker 环境中使用动态导入，避免加载 Vue
    void getNotify().then(notify => {
      if (notify) {
        notify(msg, { level: 'warning', title, key: `slow:${metric.query}` })
      }
    })

    logger.info('SlowQuery', '🚨 慢查询告警')
    logger.info('SlowQuery', `查询: "${metric.query}"`)
    logger.info('SlowQuery', `耗时: ${metric.duration}ms`)
    logger.info('SlowQuery', `结果数: ${metric.resultCount}`)
    logger.info('SlowQuery', `查询模式: ${metric.searchMode}`)
    logger.info('SlowQuery', `查询源: ${metric.sources.join(', ')}`)
    logger.info('SlowQuery', `缓存命中: ${metric.cacheHit ? '是' : '否'}`)
  }

  // ==================== 统计计算方法 ====================

  private getRecentMetrics(count: number): PerformanceMetric[] {
    return this.metrics.slice(-count)
  }

  private calculateAverage(values: number[]): number {
    if (values.length === 0) return 0
    return values.reduce((sum, val) => sum + val, 0) / values.length
  }

  private calculateMedian(sortedValues: number[]): number {
    if (sortedValues.length === 0) return 0

    const mid = Math.floor(sortedValues.length / 2)
    if (sortedValues.length % 2 === 0) {
      const left = sortedValues[mid - 1] ?? 0
      const right = sortedValues[mid] ?? 0
      return (left + right) / 2
    }
    return sortedValues[mid] ?? 0
  }

  private calculatePercentile(sortedValues: number[], percentile: number): number {
    if (sortedValues.length === 0) return 0

    const index = Math.ceil(sortedValues.length * percentile) - 1
    return sortedValues[Math.max(0, Math.min(index, sortedValues.length - 1))] ?? 0
  }

  private calculateSearchModeDistribution(metrics: PerformanceMetric[]): {
    [mode: string]: number
  } {
    const distribution: { [mode: string]: number } = {}

    metrics.forEach(metric => {
      distribution[metric.searchMode] = (distribution[metric.searchMode] || 0) + 1
    })

    return distribution
  }

  private calculatePerformanceTrend(): PerformanceTrend[] {
    const trends: PerformanceTrend[] = []
    const hourlyData = new Map<number, PerformanceMetric[]>()

    // 按小时分组
    this.metrics.forEach(metric => {
      const hour = Math.floor(metric.timestamp / (1000 * 60 * 60))
      if (!hourlyData.has(hour)) {
        hourlyData.set(hour, [])
      }
      hourlyData.get(hour)!.push(metric)
    })

    // 计算每小时的统计数据
    for (const [hour, hourMetrics] of hourlyData.entries()) {
      if (hourMetrics.length > 0) {
        const cacheHits = hourMetrics.filter(m => m.cacheHit).length
        trends.push({
          timestamp: hour * 1000 * 60 * 60,
          averageTime: this.calculateAverage(hourMetrics.map(m => m.duration)),
          queryCount: hourMetrics.length,
          cacheHitRate: cacheHits / hourMetrics.length
        })
      }
    }

    // 只返回最近24小时的数据
    return trends
      .sort((a, b) => a.timestamp - b.timestamp)
      .slice(-this.analysisConfig.trendAnalysisPeriod)
  }

  private getSlowQueries(): SlowQuery[] {
    const slowQueries = this.metrics
      .filter(m => m.duration > this.analysisConfig.slowQueryThreshold)
      .map(metric => ({
        query: metric.query,
        duration: metric.duration,
        timestamp: metric.timestamp,
        resultCount: metric.resultCount,
        reasons: this.analyzeslowQueryReasons(metric)
      }))
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 10) // 最多返回10个最慢的查询

    return slowQueries
  }

  private getTopQueries(): TopQuery[] {
    const queryStats = new Map<
      string,
      {
        count: number
        totalDuration: number
        lastUsed: number
        successes: number
      }
    >()

    // 统计查询数据
    this.metrics.forEach(metric => {
      if (!queryStats.has(metric.query)) {
        queryStats.set(metric.query, {
          count: 0,
          totalDuration: 0,
          lastUsed: 0,
          successes: 0
        })
      }

      const stats = queryStats.get(metric.query)!
      stats.count++
      stats.totalDuration += metric.duration
      stats.lastUsed = Math.max(stats.lastUsed, metric.timestamp)
      if (metric.success) {
        stats.successes++
      }
    })

    // 转换为TopQuery格式并排序
    return Array.from(queryStats.entries())
      .map(([query, stats]) => ({
        query,
        count: stats.count,
        averageDuration: stats.totalDuration / stats.count,
        lastUsed: stats.lastUsed,
        successRate: stats.successes / stats.count
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, this.analysisConfig.topQueryLimit)
  }

  private analyzeslowQueryReasons(metric: PerformanceMetric): string[] {
    const reasons: string[] = []

    if (!metric.cacheHit) {
      reasons.push('缓存未命中')
    }

    if (metric.resultCount > 100) {
      reasons.push('结果集过大')
    }

    if (metric.sources.length > 1) {
      reasons.push('多源查询')
    }

    if (metric.searchMode === 'deep') {
      reasons.push('深度查询模式')
    }

    if (metric.query.length > 50) {
      reasons.push('查询过长')
    }

    return reasons.length > 0 ? reasons : ['未知原因']
  }

  private calculatePriority(type: string, severity: number): number {
    const baseScore =
      {
        critical: 100,
        performance: 80,
        caching: 60,
        indexing: 50,
        configuration: 30
      }[type] || 50

    return Math.min(baseScore * severity, 100)
  }

  private estimateCacheSize(): number {
    // 简单估算，实际实现可以更精确
    const cacheHitMetrics = this.metrics.filter(m => m.cacheHit)
    const uniqueQueries = new Set(cacheHitMetrics.map(m => m.query))
    return uniqueQueries.size
  }

  private getEmptyStats(): PerformanceStats {
    return {
      totalSearches: 0,
      averageResponseTime: 0,
      medianResponseTime: 0,
      p95ResponseTime: 0,
      p99ResponseTime: 0,
      cacheHitRate: 0,
      cacheSize: 0,
      successRate: 0,
      errorRate: 0,
      searchModeDistribution: {},
      performanceTrend: [],
      slowQueries: [],
      topQueries: []
    }
  }

  // ==================== 工具方法 ====================

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private generateMetricId(): string {
    return `metric_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  // ==================== 公共API ====================

  /**
   * 导出性能数据
   */
  exportPerformanceData(): {
    summary: PerformanceStats
    rawMetrics: PerformanceMetric[]
    suggestions: OptimizationSuggestion[]
  } {
    return {
      summary: this.getPerformanceStats(),
      rawMetrics: [...this.metrics],
      suggestions: this.getOptimizationSuggestions()
    }
  }

  /**
   * 重置性能数据
   */
  resetPerformanceData(): void {
    this.metrics = []
    this.sessionId = this.generateSessionId()
    logger.info('PerformanceMonitor', '🔄 性能数据已重置')
  }

  /**
   * 设置告警阈值
   */
  setAlertThresholds(thresholds: Partial<AlertThreshold>): void {
    this.alertThresholds = { ...this.alertThresholds, ...thresholds }
    logger.info('PerformanceMonitor', '⚙️ 告警阈值已更新', this.alertThresholds)
  }

  /**
   * 获取实时性能概况
   */
  getCurrentPerformanceSnapshot(): {
    recentQueries: number
    averageTime: number
    cacheHitRate: number
    errorRate: number
    status: 'excellent' | 'good' | 'fair' | 'poor'
  } {
    const recent = this.getRecentMetrics(20)

    if (recent.length === 0) {
      return {
        recentQueries: 0,
        averageTime: 0,
        cacheHitRate: 0,
        errorRate: 0,
        status: 'excellent'
      }
    }

    const avgTime = this.calculateAverage(recent.map(m => m.duration))
    const cacheHits = recent.filter(m => m.cacheHit).length
    const errors = recent.filter(m => !m.success).length

    const cacheHitRate = cacheHits / recent.length
    const errorRate = errors / recent.length

    let status: 'excellent' | 'good' | 'fair' | 'poor' = 'excellent'

    if (avgTime > 500 || errorRate > 0.1) {
      status = 'poor'
    } else if (avgTime > 200 || errorRate > 0.05 || cacheHitRate < 0.2) {
      status = 'fair'
    } else if (avgTime > 100 || cacheHitRate < 0.4) {
      status = 'good'
    }

    return {
      recentQueries: recent.length,
      averageTime: Math.round(avgTime),
      cacheHitRate,
      errorRate,
      status
    }
  }
}

// ==================== 导出 ====================

// 单例模式
let performanceMonitorInstance: QueryPerformanceMonitor | null = null

export function getPerformanceMonitor(): QueryPerformanceMonitor {
  if (!performanceMonitorInstance) {
    performanceMonitorInstance = new QueryPerformanceMonitor()
  }
  return performanceMonitorInstance
}

// 默认导出
export default QueryPerformanceMonitor
