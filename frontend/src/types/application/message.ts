/**
 * Message 类型定义
 *
 * 轻量级提示消息，用于简单的操作反馈
 *
 * @module types/application/message
 */

/**
 * Message 级别
 */
export type MessageLevel = 'success' | 'error' | 'warning' | 'info' | 'loading'

/**
 * Message 配置选项
 */
export interface MessageOptions {
  /** 消息内容 */
  content: string
  /** 消息级别 */
  type: MessageLevel
  /** 显示时长（毫秒），0 表示不自动关闭 */
  duration?: number
  /** 唯一标识（用于更新或关闭特定消息） */
  key?: string
  /** 是否显示图标 */
  showIcon?: boolean
  /** 自定义图标名称 */
  icon?: string
  /** 关闭时的回调 */
  onClose?: () => void
}

/**
 * 队列中的 Message 项
 */
export interface QueuedMessage {
  /** 唯一 ID */
  id: string
  /** 消息内容 */
  content: string
  /** 消息级别 */
  type: MessageLevel
  /** 显示时长 */
  duration: number
  /** 用户指定的 key */
  key?: string
  /** 是否显示图标 */
  showIcon: boolean
  /** 图标名称 */
  icon?: string
  /** 创建时间 */
  createdAt: number
  /** 关闭回调 */
  onClose?: () => void
}

/**
 * Message 服务配置
 */
export interface MessageServiceConfig {
  /** 默认显示时长（毫秒） */
  defaultDuration: number
  /** 最大同时显示数量 */
  maxCount: number
  /** 是否显示图标 */
  showIcon: boolean
  /** 顶部偏移量（像素） */
  top: number
}
