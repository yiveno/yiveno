/**
 * Message 服务 - 轻量级提示消息
 *
 * 职责：
 * - 管理轻量级提示消息队列
 * - 提供简单的操作反馈（成功、失败、警告、信息）
 * - 自动管理消息的显示和隐藏
 *
 * 使用场景：
 * - 简单操作反馈（删除成功、保存失败等）
 * - 表单验证提示
 * - 加载状态提示
 *
 * @module application/message/message-service
 */

import { ref, computed } from 'vue'
import type {
  MessageLevel,
  MessageOptions,
  QueuedMessage,
  MessageServiceConfig
} from '@/types/application/message'
import { logger } from '@/infrastructure/logging/logger'

/**
 * Message 队列（响应式）
 */
const messages = ref<QueuedMessage[]>([])

/**
 * 默认配置
 */
const defaultConfig: MessageServiceConfig = {
  defaultDuration: 2000, // 2 秒
  maxCount: 3, // 最多同时显示 3 条
  showIcon: true,
  top: 24 // 距离顶部 24px
}

/**
 * 当前配置
 */
let config: MessageServiceConfig = { ...defaultConfig }

/**
 * 定时器映射（用于自动关闭）
 */
const timers = new Map<string, ReturnType<typeof setTimeout>>()

/**
 * 生成唯一 ID
 */
function generateId(): string {
  return `message_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

/**
 * 获取图标名称
 */
function getIcon(type: MessageLevel): string {
  const iconMap: Record<MessageLevel, string> = {
    success: 'check-circle',
    error: 'error',
    warning: 'warning',
    info: 'info',
    loading: 'progress-activity'
  }
  return iconMap[type]
}

/**
 * 显示消息
 */
function show(options: Partial<MessageOptions> & { content: string; type: MessageLevel }): string {
  const id = options.key || generateId()
  const duration = options.duration ?? config.defaultDuration
  const showIcon = options.showIcon ?? config.showIcon
  const icon = options.icon || getIcon(options.type)

  // 如果已存在相同 key 的消息，先移除
  if (options.key) {
    const existingIndex = messages.value.findIndex(m => m.key === options.key)
    if (existingIndex !== -1) {
      const existingMessage = messages.value[existingIndex]
      if (existingMessage) {
        close(existingMessage.id)
      }
    }
  }

  // 如果超过最大数量，移除最早的消息
  if (messages.value.length >= config.maxCount) {
    const oldest = messages.value[0]
    if (oldest) {
      close(oldest.id)
    }
  }

  // 创建新消息
  const nextMessage: QueuedMessage = {
    id,
    content: options.content,
    type: options.type,
    duration,
    showIcon,
    createdAt: Date.now()
  }

  if (options.key !== undefined) {
    nextMessage.key = options.key
  }

  if (icon) {
    nextMessage.icon = icon
  }

  if (options.onClose !== undefined) {
    nextMessage.onClose = options.onClose
  }

  messages.value.push(nextMessage)

  logger.debug('MessageService', '消息已显示', {
    id,
    type: options.type,
    content: options.content,
    duration
  })

  // 设置自动关闭定时器
  if (duration > 0) {
    const timer = setTimeout(() => {
      close(id)
    }, duration)
    timers.set(id, timer)
  }

  return id
}

/**
 * 关闭消息
 */
function close(id: string): void {
  const index = messages.value.findIndex(m => m.id === id)
  if (index === -1) return

  const message = messages.value[index]

  // 清除定时器
  const timer = timers.get(id)
  if (timer) {
    clearTimeout(timer)
    timers.delete(id)
  }

  // 移除消息
  messages.value.splice(index, 1)

  // 调用关闭回调
  if (message?.onClose) {
    message.onClose()
  }

  logger.debug('MessageService', '消息已关闭', { id })
}

/**
 * 关闭所有消息
 */
function closeAll(): void {
  // 清除所有定时器
  timers.forEach(timer => clearTimeout(timer))
  timers.clear()

  // 调用所有关闭回调
  messages.value.forEach(message => {
    if (message.onClose) {
      message.onClose()
    }
  })

  // 清空消息队列
  messages.value = []

  logger.debug('MessageService', '所有消息已关闭')
}

/**
 * 更新配置
 */
function setConfig(newConfig: Partial<MessageServiceConfig>): void {
  config = { ...config, ...newConfig }
  logger.debug('MessageService', '配置已更新', config)
}

/**
 * 获取当前配置
 */
function getConfig(): MessageServiceConfig {
  return { ...config }
}

/**
 * Message 服务
 */
export const messageService = {
  // 状态
  messages: computed(() => messages.value),
  config: computed(() => config),

  // 方法
  /**
   * 显示成功消息
   *
   * @param content - 消息内容
   * @param duration - 显示时长（毫秒）
   * @returns 消息 ID
   *
   * @example
   * ```typescript
   * message.success('删除成功')
   * message.success('保存成功', 3000)
   * ```
   */
  success(content: string, duration?: number): string {
    return duration === undefined
      ? show({ content, type: 'success' })
      : show({ content, type: 'success', duration })
  },

  /**
   * 显示错误消息
   *
   * @param content - 消息内容
   * @param duration - 显示时长（毫秒）
   * @returns 消息 ID
   *
   * @example
   * ```typescript
   * message.error('删除失败')
   * message.error('网络连接失败', 5000)
   * ```
   */
  error(content: string, duration?: number): string {
    return show({ content, type: 'error', duration: duration ?? 3000 })
  },

  /**
   * 显示警告消息
   *
   * @param content - 消息内容
   * @param duration - 显示时长（毫秒）
   * @returns 消息 ID
   *
   * @example
   * ```typescript
   * message.warning('存储空间不足')
   * ```
   */
  warning(content: string, duration?: number): string {
    return show({ content, type: 'warning', duration: duration ?? 2500 })
  },

  /**
   * 显示信息消息
   *
   * @param content - 消息内容
   * @param duration - 显示时长（毫秒）
   * @returns 消息 ID
   *
   * @example
   * ```typescript
   * message.info('正在同步数据...')
   * ```
   */
  info(content: string, duration?: number): string {
    return duration === undefined
      ? show({ content, type: 'info' })
      : show({ content, type: 'info', duration })
  },

  /**
   * 显示加载消息
   *
   * @param content - 消息内容
   * @returns 关闭函数
   *
   * @example
   * ```typescript
   * const hide = message.loading('处理中...')
   * // 处理完成后
   * hide()
   * ```
   */
  loading(content = '加载中...'): () => void {
    const id = show({ content, type: 'loading', duration: 0 })
    return () => close(id)
  },

  /**
   * 显示自定义消息
   *
   * @param options - 消息配置
   * @returns 消息 ID
   *
   * @example
   * ```typescript
   * message.show({
   *   content: '自定义消息',
   *   type: 'info',
   *   duration: 5000,
   *   key: 'custom-message',
   *   onClose: () => console.log('消息已关闭')
   * })
   * ```
   */
  show(options: Partial<MessageOptions> & { content: string; type: MessageLevel }): string {
    return show(options)
  },

  /**
   * 关闭指定消息
   *
   * @param id - 消息 ID
   *
   * @example
   * ```typescript
   * const id = message.info('消息')
   * message.close(id)
   * ```
   */
  close,

  /**
   * 关闭所有消息
   *
   * @example
   * ```typescript
   * message.closeAll()
   * ```
   */
  closeAll,

  /**
   * 更新配置
   *
   * @param newConfig - 新配置
   *
   * @example
   * ```typescript
   * message.setConfig({
   *   defaultDuration: 3000,
   *   maxCount: 5
   * })
   * ```
   */
  setConfig,

  /**
   * 获取当前配置
   *
   * @returns 当前配置
   */
  getConfig
}

/**
 * 便捷导出（保持向后兼容）
 */
export const message = messageService
