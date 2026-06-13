/**
 * 性能监控相关类型定义
 *
 * 包含查询性能监控系统的所有类型
 */

import type { ID, Timestamp } from '../core/common'

/**
 * 性能指标记录接口
 *
 * 单次查询的完整性能数据
 */
export interface PerformanceMetric {
  /** 记录唯一ID */
  id: ID

  /** 查询查询字符串 */
  query: string

  /** 查询耗时（毫秒） */
  duration: number

  /** 结果数量 */
  resultCount: number

  /** 是否命中缓存 */
  cacheHit: boolean

  /** 查询模式 */
  searchMode: string

  /** 时间戳 */
  timestamp: Timestamp

  /** 会话ID */
  sessionId: string

  /** 数据源列表 */
  sources: string[]

  /** 是否成功 */
  success: boolean

  /** 错误消息（如果失败） */
  errorMessage?: string
}

/**
 * 性能统计数据接口
 *
 * 聚合的性能统计信息
 */
export interface PerformanceStats {
  /** 总查询次数 */
  totalSearches: number

  /** 平均响应时间（毫秒） */
  averageResponseTime: number

  /** 中位数响应时间（毫秒） */
  medianResponseTime: number

  /** P95 响应时间（毫秒） */
  p95ResponseTime: number

  /** P99 响应时间（毫秒） */
  p99ResponseTime: number

  /** 缓存命中率（0-1） */
  cacheHitRate: number

  /** 缓存大小 */
  cacheSize: number

  /** 成功率（0-1） */
  successRate: number

  /** 错误率（0-1） */
  errorRate: number

  /** 查询模式分布统计 */
  searchModeDistribution: Record<string, number>

  /** 性能趋势数据 */
  performanceTrend: PerformanceTrend[]

  /** 慢查询列表 */
  slowQueries: SlowQuery[]

  /** 热门查询列表 */
  topQueries: TopQuery[]
}

/**
 * 性能趋势数据点接口
 *
 * 时间序列上的性能数据
 */
export interface PerformanceTrend {
  /** 时间戳 */
  timestamp: Timestamp

  /** 平均响应时间 */
  averageTime: number

  /** 查询数量 */
  queryCount: number

  /** 缓存命中率 */
  cacheHitRate: number
}

/**
 * 慢查询记录接口
 *
 * 响应时间超过阈值的查询
 */
export interface SlowQuery {
  /** 查询字符串 */
  query: string

  /** 耗时（毫秒） */
  duration: number

  /** 时间戳 */
  timestamp: Timestamp

  /** 结果数量 */
  resultCount: number

  /** 慢查询原因列表 */
  reasons: string[]
}

/**
 * 热门查询记录接口
 *
 * 使用频率高的查询
 */
export interface TopQuery {
  /** 查询字符串 */
  query: string

  /** 使用次数 */
  count: number

  /** 平均耗时（毫秒） */
  averageDuration: number

  /** 最后使用时间 */
  lastUsed: Timestamp

  /** 成功率（0-1） */
  successRate: number
}

/**
 * 优化建议接口
 *
 * 基于性能分析生成的优化建议
 */
export interface OptimizationSuggestion {
  /** 建议类型 */
  type: 'performance' | 'caching' | 'indexing' | 'configuration'

  /** 严重程度 */
  severity: 'low' | 'medium' | 'high' | 'critical'

  /** 建议消息 */
  message: string

  /** 建议的操作 */
  action: string

  /** 影响程度 */
  impact: 'low' | 'medium' | 'high'

  /** 实施难度 */
  effort: 'low' | 'medium' | 'high'

  /** 优先级（数值越大越优先） */
  priority: number
}

/**
 * 告警阈值配置接口
 *
 * 性能监控的告警阈值
 */
export interface AlertThreshold {
  /** 平均响应时间阈值（毫秒） */
  averageResponseTime: number

  /** 缓存命中率阈值（0-1） */
  cacheHitRate: number

  /** 错误率阈值（0-1） */
  errorRate: number

  /** 慢查询阈值（毫秒） */
  slowQueryThreshold: number
}
