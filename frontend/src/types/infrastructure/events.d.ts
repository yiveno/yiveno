/**
 * 事件系统类型定义
 *
 * 包含事件流处理的所有类型
 */

/**
 * 事件详情类型
 *
 * 事件携带的数据
 */
export type EventDetail = Record<string, unknown> | undefined

/**
 * 事件监听器类型
 *
 * 事件回调函数的类型定义
 *
 * @template T - 事件详情的类型
 */
export type EventListener<T = unknown> = (detail: T) => void

/**
 * 事件流配置接口
 *
 * 事件流系统的配置选项
 */
export interface EventStreamConfig {
  /** 默认等待时间（毫秒） */
  defaultWaitMs: number

  /** 最大监听器数量 */
  maxListeners: number

  /** 是否启用日志 */
  enableLogging: boolean
}

/**
 * 事件历史记录接口
 *
 * 记录的历史事件
 */
export interface EventHistoryEntry {
  /** 事件名称 */
  name: string

  /** 事件详情 */
  detail: EventDetail

  /** 时间戳 */
  timestamp: number
}
