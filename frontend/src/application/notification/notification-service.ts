/**
 * 通知服务 - 应用服务层
 *
 * 职责：
 * - 管理全局通知队列
 * - 提供系统通知和页面Toast的统一接口
 * - 处理通知去重和抑制
 * - 支持Chrome扩展通知API
 */

import type { Result } from '../../core/common/result'
import { ok, err } from '../../core/common/result'
import { logger } from '../../infrastructure/logging/logger'
import { navigationService } from '@/infrastructure/services/navigation-service'
import { NOTIFICATION_CONFIG, ANIMATION_CONFIG } from '@/config/constants'
import type * as Vue from 'vue'

// ⚠️ 延迟导入 Vue 和组件，避免在 Service Worker 环境中加载
// Vue 组件依赖 HTMLElement，在 Service Worker 中不可用
let vueModule: typeof Vue | null = null
let NotificationComponent: unknown | null = null

// 从统一类型定义导入
import type {
  ToastLevel,
  ToastShowOptions,
  NotificationLevel,
  NotificationOptions,
  QueuedNotification,
  NotificationServiceConfig
} from '@/types/application/notification'

/**
 * Notification 组件暴露的方法接口
 */
interface NotificationComponentExposed {
  success: (config: {
    message: string
    description?: string
    duration?: number
    key?: string
  }) => void
  error: (config: {
    message: string
    description?: string
    duration?: number
    key?: string
  }) => void
  info: (config: { message: string; description?: string; duration?: number; key?: string }) => void
  warning: (config: {
    message: string
    description?: string
    duration?: number
    key?: string
  }) => void
  destroy: (key?: string) => void
}

/**
 * 页面通知管理器
 *
 * 单例管理页面内的 Notification 组件（Ant Design 风格），负责组件的挂载和生命周期
 */
class PageNotificationManager {
  /** Vue 应用实例 */
  private app: ReturnType<typeof Vue.createApp> | null = null
  /** Notification 容器 DOM 元素 */
  private container: HTMLDivElement | null = null
  /** Notification 组件暴露的方法 */
  private exposed: NotificationComponentExposed | null = null

  /**
   * 确保 Vue 和 Notification 组件已加载
   */
  private async ensureVueLoaded(): Promise<boolean> {
    if (vueModule && NotificationComponent) {
      return true
    }

    // Service Worker 环境检查：没有 document
    if (typeof document === 'undefined' || !isRunningInExtension()) {
      logger.warn('PageNotificationManager', 'document 不可用（Service Worker 环境）')
      return false
    }

    try {
      // 动态导入 Vue 和 Notification 组件
      // ⚠️ 只导入 Notification 组件，避免导入整个 @/components（包含 Material Web Components）

      // eslint-disable-next-line require-atomic-updates -- 在 await 之前已检查，且只有一个调用点
      vueModule = await import('vue')
      const notificationModule =
        await import('@/components/composite/Notification/Notification.vue')

      // eslint-disable-next-line require-atomic-updates -- 在 await 之前已检查，且只有一个调用点
      NotificationComponent = notificationModule.default
      return true
    } catch (error) {
      logger.error('PageNotificationManager', 'Vue 或 Notification 组件加载失败', error)
      return false
    }
  }

  /**
   * 确保 Notification 组件已挂载到页面
   *
   * 首次调用时创建容器并挂载 Vue 组件
   */
  private async ensureMounted(): Promise<void> {
    if (this.exposed) return

    // 确保 Vue 已加载
    if (!(await this.ensureVueLoaded())) {
      return
    }

    // Service Worker 环境检查：没有 document
    if (typeof document === 'undefined' || !isRunningInExtension()) {
      logger.warn('PageNotificationManager', 'document 不可用（Service Worker 环境）')
      return
    }

    if (!this.container) {
      this.container = document.createElement('div')
      document.body.appendChild(this.container)
    }

    if (!vueModule || !NotificationComponent) {
      logger.error('PageNotificationManager', 'Vue 或 Notification 组件未加载')
      return
    }

    const vue = vueModule
    if (!vue) {
      return
    }

    this.app = vue.createApp({
      render: () =>
        vue.h(NotificationComponent as ReturnType<typeof vue.defineComponent>, {
          ref: 'notification'
        })
    })

    const vm = this.app.mount(this.container)

    // 通过 $refs 获取暴露的方法
    const refs = (vm as { $refs: Record<string, unknown> }).$refs
    this.exposed = (refs?.notification as NotificationComponentExposed) || null
  }

  /**
   * 显示通知消息
   *
   * @param message - 消息文本
   * @param opts - 通知显示选项
   * @returns 通知 ID
   */
  async show(message: string, opts?: ToastShowOptions): Promise<string> {
    if (!this.canShowNotification()) {
      return ''
    }

    await this.ensureMounted()

    if (!this.exposed) {
      logger.warn('PageNotificationManager', 'Notification 未正确初始化')
      return ''
    }

    const level = opts?.level || 'info'
    const duration = this.convertTimeoutToSeconds(opts?.timeoutMs)
    const method = this.getNotifyMethod(level)

    this.callNotifyMethod(method, message, duration, opts)

    return '' // Notification 内部管理 ID
  }

  /**
   * 检查是否可以显示通知
   */
  private canShowNotification(): boolean {
    if (typeof document === 'undefined' || !isRunningInExtension()) {
      logger.debug('PageNotificationManager', 'Service Worker 环境，跳过通知显示')
      return false
    }
    return true
  }

  /**
   * 转换超时时间为秒
   */
  private convertTimeoutToSeconds(timeoutMs?: number): number {
    return timeoutMs ? timeoutMs / 1000 : 3
  }

  /**
   * 获取通知方法
   */
  private getNotifyMethod(
    level: NonNullable<ToastShowOptions['level']> | 'info'
  ): keyof NotificationComponentExposed {
    const methodMap: Record<
      NonNullable<ToastShowOptions['level']> | 'info',
      keyof NotificationComponentExposed
    > = {
      success: 'success',
      error: 'error',
      info: 'info',
      warning: 'warning'
    }
    return methodMap[level] || 'info'
  }

  /**
   * 调用通知方法
   */
  private callNotifyMethod(
    method: keyof NotificationComponentExposed,
    message: string,
    duration: number,
    opts?: ToastShowOptions
  ): void {
    const notifyMethod = this.exposed?.[method]

    if (typeof notifyMethod === 'function') {
      const notificationConfig = this.buildNotificationConfig(message, duration, opts)
      ;(
        notifyMethod as (config: {
          message: string
          description?: string | undefined
          duration?: number | undefined
          key?: string | undefined
        }) => void
      )(notificationConfig)
    }
  }

  /**
   * 构建通知配置
   */
  private buildNotificationConfig(
    message: string,
    duration: number,
    opts?: ToastShowOptions
  ): {
    message: string
    description?: string
    duration: number
    key?: string
  } {
    const config: {
      message: string
      description?: string
      duration: number
      key?: string
    } = {
      message: opts?.title || message,
      duration
    }

    if (opts?.title) {
      config.description = message
    }

    if (opts?.key) {
      config.key = opts.key
    }

    return config
  }

  /**
   * 清理资源
   */
  dispose(): void {
    try {
      if (typeof document !== 'undefined' && this.app && this.container) {
        this.app.unmount()
        document.body.removeChild(this.container)
      }
    } catch (error) {
      logger.error('Component', 'PageNotificationManager', '清理资源失败', error)
    }

    this.app = null
    this.container = null
    this.exposed = null
  }
}

function isRunningInExtension(): boolean {
  if (typeof chrome === 'undefined') return false
  try {
    return typeof chrome.runtime?.id === 'string'
  } catch {
    return false
  }
}

const _isExtensionRuntime = isRunningInExtension()

// 类型定义已迁移到 @/types/application/notification
// 保留此注释用于标记历史迁移

/**
 * 通知服务类
 *
 * 统一管理应用内的所有通知，包括页面 Toast 和系统通知
 */
export class NotificationService {
  /** 服务配置 */
  private config: NotificationServiceConfig
  /** 通知队列（用于系统通知） */
  private queue: QueuedNotification[] = []
  /** 当前活跃的通知数量 */
  private active = 0
  /** 最近显示的通知映射（用于去重） */
  private recentMap = new Map<string, number>() // key -> timestamp，用于抑制相同消息
  /** 通知权限级别缓存 */
  private permissionCache: string | null = null
  /** 页面通知管理器（Ant Design 风格） */
  private pageNotificationManager: PageNotificationManager | null = null
  /** 上次通知显示时间（用于计算队列延迟） */
  private lastNotificationTime = 0
  /** 清理定时器 */
  private cleanupTimer: ReturnType<typeof setInterval> | null = null

  /**
   * 构造函数
   *
   * @param config - 可选的服务配置
   */
  constructor(config: Partial<NotificationServiceConfig> = {}) {
    this.config = {
      defaultTitle: '',
      defaultTimeout: NOTIFICATION_CONFIG.DEFAULT_TOAST_TIMEOUT,
      concurrency: 1,
      suppressWindowMs: NOTIFICATION_CONFIG.SUPPRESS_WINDOW,
      enableSystemNotifications: true,
      enablePageToasts: true,
      enableBadge: true, // ✨ 默认启用扩展图标徽章
      enableDoNotDisturb: false, // ✨ 默认关闭勿扰模式
      ...config
    }

    if (this.config.enablePageToasts) {
      this.pageNotificationManager = new PageNotificationManager()
    }

    // ✅ 定期清理过期的去重记录（每 10 秒清理一次）
    this.cleanupTimer = setInterval(() => {
      this.cleanupRecentMap()
    }, 10000)
  }

  /**
   * 清理过期的去重记录
   * @private
   */
  private cleanupRecentMap(): void {
    const now = Date.now()
    const maxAge = Math.max(this.config.suppressWindowMs, 10000) // 至少保留 10 秒

    for (const [key, timestamp] of this.recentMap.entries()) {
      if (now - timestamp > maxAge) {
        this.recentMap.delete(key)
      }
    }
  }

  // ========================================
  // ✨ Badge 徽章管理方法
  // ========================================

  /**
   * 更新扩展图标徽章
   *
   * @param text - 徽章文本内容（最多4个字符，超过会显示为"..."）
   * @param color - 徽章背景颜色（可选，默认为蓝色）
   * @returns 操作结果
   *
   * @example
   * ```typescript
   * // 显示数字徽章
   * await notificationService.updateBadge('5', '#ff4d4f')
   *
   * // 显示图标徽章
   * await notificationService.updateBadge('!', '#faad14')
   * ```
   */
  async updateBadge(text: string, color?: string): Promise<Result<void, Error>> {
    if (!this.config.enableBadge) {
      logger.debug('NotificationService', 'Badge 功能已禁用')
      return ok(undefined)
    }

    if (!_isExtensionRuntime || !chrome.action) {
      logger.warn('NotificationService', 'chrome.action API 不可用')
      return err(new Error('chrome.action API not available'))
    }

    try {
      // 限制文本长度（Chrome 最多显示 4 个字符）
      const displayText = text.length > 4 ? text.slice(0, 3) + '…' : text

      await chrome.action.setBadgeText({ text: displayText })

      if (color) {
        await chrome.action.setBadgeBackgroundColor({ color })
      }

      logger.debug('NotificationService', 'Badge 更新成功', {
        text: displayText,
        color
      })

      return ok(undefined)
    } catch (error) {
      logger.warn('NotificationService', 'Badge 更新失败', error)
      return err(error as Error)
    }
  }

  /**
   * 清除扩展图标徽章
   *
   * @returns 操作结果
   *
   * @example
   * ```typescript
   * await notificationService.clearBadge()
   * ```
   */
  async clearBadge(): Promise<Result<void, Error>> {
    return this.updateBadge('')
  }

  /**
   * 显示计数徽章
   *
   * @param count - 计数值（超过 99 显示为"99+"）
   * @param level - 徽章级别（影响颜色）
   * @returns 操作结果
   *
   * @example
   * ```typescript
   * // 显示错误计数
   * await notificationService.showBadgeCount(5, 'error')
   *
   * // 显示警告计数
   * await notificationService.showBadgeCount(10, 'warning')
   * ```
   */
  async showBadgeCount(
    count: number,
    level: NotificationLevel = 'info'
  ): Promise<Result<void, Error>> {
    const text = count > 99 ? '99+' : String(count)
    const color = this.getBadgeColor(level)
    return this.updateBadge(text, color)
  }

  /**
   * 获取徽章颜色（根据通知级别）
   *
   * @param level - 通知级别
   * @returns 对应的颜色值
   * @private
   */
  private getBadgeColor(level: NotificationLevel): string {
    return NOTIFICATION_CONFIG.BADGE_COLORS[level] || NOTIFICATION_CONFIG.BADGE_COLORS.info
  }

  /**
   * ✨ 显示通知（三层通知系统）
   *
   * 主入口方法，根据配置和场景自动选择最合适的通知方式：
   * - Level 1: Badge 徽章（持久状态，低打扰）
   * - Level 2: Toast 页面通知（即时反馈，中打扰）
   * - Level 3: System 系统通知（重要提醒，高打扰）
   *
   * 智能决策逻辑：
   * - Badge：如果 updateBadge = true，更新扩展图标徽章
   * - Toast：页面可见时显示，提供即时反馈
   * - System：页面隐藏时显示，确保用户不错过重要通知
   *
   * @param message - 通知消息
   * @param opts - 可选的通知选项
   * @returns 操作结果
   *
   * @example
   * ```typescript
   * // 健康扫描发现问题：Badge + Toast
   * await notify('发现 5 个健康问题', {
   *   level: 'warning',
   *   updateBadge: true,
   *   badgeText: '5'
   * })
   *
   * // 后台同步中：仅 Badge
   * await notify('正在同步...', {
   *   updateBadge: true,
   *   badgeText: '↻',
   *   badgeColor: '#1677ff'
   * })
   * ```
   */
  async notify(message: string, opts?: NotificationOptions): Promise<Result<void, Error>> {
    try {
      if (this.shouldSuppressNotification(opts)) {
        return ok(undefined)
      }

      await this.updateDefaultDurationIfNeeded(opts)
      const options = this.buildOptions(opts)

      if (!this.checkSuppression(options, message)) {
        return ok(undefined)
      }

      const item: QueuedNotification = {
        id: this.makeId(),
        message,
        options,
        createdAt: Date.now()
      }

      await this.handleBadgeUpdate(opts, options)
      await this.handlePageToast(item)
      this.handleSystemNotification(item)

      return ok(undefined)
    } catch (error) {
      return err(error as Error)
    }
  }

  /**
   * 检查是否应该抑制通知（勿扰模式）
   */
  private shouldSuppressNotification(opts?: NotificationOptions): boolean {
    if (!this.config.enableDoNotDisturb) return false

    logger.debug('NotificationService', '🔕 勿扰模式已开启，跳过通知显示', {
      message: opts?.message,
      level: opts?.level || opts?.type || 'info'
    })
    return true
  }

  /**
   * 如果需要，更新默认时长
   */
  private async updateDefaultDurationIfNeeded(opts?: NotificationOptions): Promise<void> {
    if (!opts?.timeoutMs) {
      await this.updateDefaultDuration()
    }
  }

  /**
   * 检查并处理去重逻辑
   */
  private checkSuppression(options: Required<NotificationOptions>, message: string): boolean {
    const suppressKey = options.key || `${options.level}:${message}`
    const last = this.recentMap.get(suppressKey) || 0
    const ts = Date.now()

    const timeoutMs = options.timeoutMs ?? this.config.defaultTimeout
    const effectiveSuppressWindow = Math.max(
      this.config.suppressWindowMs,
      timeoutMs + ANIMATION_CONFIG.DURATION.TOAST_LEAVE + 500
    )

    logger.info('NotificationService', '🔔 Notify 调用', {
      message,
      suppressKey,
      ts,
      last,
      elapsed: ts - last,
      suppressWindow: effectiveSuppressWindow,
      willSuppress: ts - last < effectiveSuppressWindow
    })

    if (ts - last < effectiveSuppressWindow) {
      logger.warn('NotificationService', '❌ 通知被去重抑制', {
        suppressKey,
        elapsed: ts - last,
        suppressWindow: effectiveSuppressWindow
      })
      return false
    }

    this.recentMap.set(suppressKey, ts)
    logger.info('NotificationService', '✅ 通知通过去重检查，更新时间戳', {
      suppressKey,
      ts
    })
    return true
  }

  /**
   * 处理徽章更新
   */
  private async handleBadgeUpdate(
    opts?: NotificationOptions,
    options?: Required<NotificationOptions>
  ): Promise<void> {
    if (!opts?.updateBadge || !this.config.enableBadge) return

    const badgeText = opts.badgeText || opts.badge?.text || '!'
    const badgeColor =
      opts.badgeColor || opts.badge?.color || this.getBadgeColor(options?.level || 'info')

    await this.updateBadge(badgeText, badgeColor)

    logger.debug('NotificationService', 'Badge 已更新', {
      text: badgeText,
      color: badgeColor
    })

    this.scheduleBadgeAutoClear(opts)
  }

  /**
   * 调度徽章自动清除
   */
  private scheduleBadgeAutoClear(opts?: NotificationOptions): void {
    if (!opts?.badge?.autoClear) return

    const clearDelay = opts.badge.clearDelay || NOTIFICATION_CONFIG.BADGE_AUTO_CLEAR_DELAY
    if (clearDelay > 0) {
      setTimeout(() => {
        void this.clearBadge()
      }, clearDelay)
    }
  }

  /**
   * 处理页面 Toast 显示
   */
  private async handlePageToast(item: QueuedNotification): Promise<void> {
    if (!this.config.enablePageToasts) return
    await this.showPageToast(item)
  }

  /**
   * 处理系统通知
   */
  private handleSystemNotification(item: QueuedNotification): void {
    const shouldMirror = typeof document !== 'undefined' ? document.hidden : true

    if (shouldMirror && this.config.enableSystemNotifications) {
      this.queue.push(item)
      void this.runNext()
    }
  }

  /**
   * 显示成功通知
   *
   * @param message - 通知消息
   * @param title - 可选的标题
   * @returns 操作结果
   */
  async notifySuccess(message: string, title?: string): Promise<Result<void, Error>> {
    return this.notify(message, { level: 'success', title, type: 'success' })
  }

  /**
   * 显示信息通知
   *
   * @param message - 通知消息
   * @param title - 可选的标题
   * @returns 操作结果
   */
  async notifyInfo(message: string, title?: string): Promise<Result<void, Error>> {
    return this.notify(message, { level: 'info', title, type: 'info' })
  }

  /**
   * 显示警告通知
   *
   * @param message - 通知消息
   * @param title - 可选的标题
   * @returns 操作结果
   */
  async notifyWarning(message: string, title?: string): Promise<Result<void, Error>> {
    return this.notify(message, { level: 'warning', title, type: 'warning' })
  }

  /**
   * 显示错误通知
   *
   * @param message - 通知消息
   * @param title - 可选的标题
   * @returns 操作结果
   */
  async notifyError(message: string, title?: string): Promise<Result<void, Error>> {
    return this.notify(message, { level: 'error', title, type: 'error' })
  }

  /**
   * 构建完整的通知选项
   *
   * 将用户提供的选项与默认值合并
   *
   * @param opts - 用户提供的选项
   * @returns 完整的通知选项
   */
  private buildOptions(opts?: NotificationOptions): Required<NotificationOptions> {
    const level: NotificationLevel = opts?.level || opts?.type || 'info'
    const timeoutMs = opts?.timeoutMs ?? this.config.defaultTimeout

    return {
      ...this.buildBasicOptions(opts, level, timeoutMs),
      ...this.buildBadgeOptions(opts)
    } as Required<NotificationOptions>
  }

  /**
   * 构建基本通知选项
   */
  private buildBasicOptions(
    opts?: NotificationOptions,
    level: NotificationLevel = 'info',
    timeoutMs?: number
  ): Partial<Required<NotificationOptions>> {
    return {
      ...this.buildTextOptions(opts),
      ...this.buildLevelOptions(level, timeoutMs),
      ...this.buildIconOptions(opts, level),
      ...this.buildActionOptions(opts),
      ...this.buildMetaOptions(opts)
    }
  }

  /**
   * 构建文本选项
   */
  private buildTextOptions(opts?: NotificationOptions): Partial<Required<NotificationOptions>> {
    return {
      title: opts?.title || this.config.defaultTitle,
      message: opts?.message || ''
    }
  }

  /**
   * 构建级别选项
   */
  private buildLevelOptions(
    level: NotificationLevel,
    timeoutMs?: number
  ): Partial<Required<NotificationOptions>> {
    return {
      level,
      type: level,
      timeoutMs
    }
  }

  /**
   * 构建图标选项
   */
  private buildIconOptions(
    opts?: NotificationOptions,
    level: NotificationLevel = 'info'
  ): Partial<Required<NotificationOptions>> {
    return {
      iconUrl: this.resolveIconUrl(opts?.iconUrl, level),
      icon: opts?.icon || '',
      imageUrl: opts?.imageUrl || ''
    }
  }

  /**
   * 构建操作选项
   */
  private buildActionOptions(opts?: NotificationOptions): Partial<Required<NotificationOptions>> {
    return {
      priority: opts?.priority || 'normal',
      persistent: opts?.persistent || false,
      autoClose: typeof opts?.autoClose === 'number' ? opts.autoClose : undefined,
      actions: opts?.actions || []
    }
  }

  /**
   * 构建元数据选项
   */
  private buildMetaOptions(opts?: NotificationOptions): Partial<Required<NotificationOptions>> {
    return {
      data: opts?.data || {},
      source: opts?.source || '',
      groupId: opts?.groupId || '',
      playSound: opts?.playSound || false,
      showDesktopNotification: opts?.showDesktopNotification || false,
      key: opts?.key || ''
    }
  }

  /**
   * 构建 Badge 选项
   */
  private buildBadgeOptions(opts?: NotificationOptions): Partial<Required<NotificationOptions>> {
    return {
      updateBadge: opts?.updateBadge || false,
      badge: opts?.badge ?? undefined,
      badgeText: opts?.badgeText ?? undefined,
      badgeColor: opts?.badgeColor ?? undefined
    }
  }

  /**
   * ✨ 从设置中获取通知显示时长
   *
   * @returns 通知显示时长（毫秒）
   * @private
   */
  private async getNotificationDuration(): Promise<number> {
    try {
      // 动态导入避免循环依赖
      const { settingsAppService } = await import('@/application/settings/settings-app-service')
      const duration = await settingsAppService.getSetting<number>('notifications.duration')

      if (duration !== null && typeof duration !== 'undefined') {
        const value = Number((duration as unknown as { value?: number }).value ?? duration)
        // 确保值在合理范围内（1-10秒）
        return Math.max(1000, Math.min(10000, value))
      }
    } catch (error) {
      logger.warn('NotificationService', '获取通知时长设置失败，使用默认值', error)
    }

    // 返回默认值
    return this.config.defaultTimeout
  }

  /**
   * ✨ 更新默认通知时长
   *
   * 从设置中读取并更新配置
   */
  async updateDefaultDuration(): Promise<void> {
    const duration = await this.getNotificationDuration()
    this.config.defaultTimeout = duration
    logger.debug('NotificationService', '通知时长已更新', { duration })
  }

  /**
   * 解析图标URL
   *
   * 将相对路径转换为扩展资源的完整URL
   *
   * @param iconUrl - 可选的图标URL
   * @param level - 通知级别
   * @returns 完整的图标URL
   */
  private resolveIconUrl(iconUrl?: string, level: NotificationLevel = 'info'): string {
    const defaultIcon = this.getDefaultIcon(level)
    const raw = iconUrl || defaultIcon

    try {
      if (_isExtensionRuntime && typeof chrome !== 'undefined' && chrome?.runtime?.getURL) {
        if (/^https?:\/\//.test(raw) || raw.startsWith('chrome-extension://')) {
          return raw
        }
        const cleaned = raw.replace(/^\//, '')
        return chrome.runtime.getURL(cleaned)
      }
    } catch {
      // ignore errors
    }

    return raw || ''
  }

  /**
   * 获取默认图标URL
   *
   * @param _level - 通知级别（预留用于未来扩展）
   * @returns 默认图标URL
   */

  private getDefaultIcon(_level: NotificationLevel): string {
    try {
      if (_isExtensionRuntime && typeof chrome !== 'undefined' && chrome?.runtime?.getURL) {
        return chrome.runtime.getURL('images/icon128.png')
      }
    } catch {
      // 忽略错误
    }
    return '/images/icon128.png'
  }

  /**
   * 生成唯一ID
   *
   * @returns 随机生成的唯一标识符
   */
  private makeId(): string {
    return Math.random().toString(36).slice(2)
  }

  /**
   * 显示页面 Toast
   *
   * 在页面内显示轻量级提示消息
   *
   * @param notification - 队列中的通知对象
   */
  private async showPageToast(notification: QueuedNotification): Promise<void> {
    try {
      if (!this.pageNotificationManager) {
        logger.warn('NotificationService', '页面通知管理器未初始化')
        return
      }

      const level = notification.options.level as ToastLevel
      await this.pageNotificationManager.show(notification.message, {
        title: notification.options.title,
        level,
        timeoutMs: notification.options.timeoutMs,
        key: notification.options.key // 🎯 传递 key 以支持 Ant Design 风格的更新
      })

      logger.debug('NotificationService', '页面通知显示成功', {
        message: notification.message,
        level,
        key: notification.options.key
      })
    } catch (error) {
      logger.error('Component', 'NotificationService', '页面通知显示失败', error)
    }
  }

  /**
   * 创建 Chrome 系统通知
   *
   * @param notification - 队列中的通知对象
   * @returns 通知ID，用于后续清除
   */
  private async createChromeNotification(notification: QueuedNotification): Promise<string> {
    try {
      if (!_isExtensionRuntime) {
        logger.warn('NotificationService', 'Not running in extension context')
        return ''
      }

      // 通过消息发送到 Background Script 创建系统通知
      // 因为 chrome.notifications API 只在 Background Script 中可用
      const response = await chrome.runtime.sendMessage({
        type: 'NOTIFICATION',
        data: {
          title: notification.options.title || 'otterSage',
          message: notification.message,
          iconUrl: notification.options.iconUrl || ''
        }
      })

      return response?.notificationId || ''
    } catch (error) {
      logger.warn('NotificationService', '调用 Chrome 系统通知失败', error)
      return ''
    }
  }

  /**
   * 清除 Chrome 系统通知
   *
   * @param notificationId - 通知ID
   */
  private clearChromeNotification(notificationId: string): void {
    if (!notificationId) return
    void navigationService.clearChromeNotification(notificationId).catch(error => {
      logger.warn('NotificationService', '清除通知失败', {
        id: notificationId,
        error
      })
    })
  }

  /**
   * 运行队列中的下一个通知
   *
   * 按并发数限制逐个显示系统通知
   */
  private async runNext(): Promise<void> {
    if (this.active >= this.config.concurrency) return

    const notification = this.queue.shift()
    if (!notification) return

    this.active++

    try {
      const id = await this.createChromeNotification(notification)
      if (!!notification.options.timeoutMs) {
        setTimeout(() => {
          this.clearChromeNotification(id)
        }, notification.options.timeoutMs)
      }

      // ✅ 记录通知显示时间，用于计算队列延迟
      this.lastNotificationTime = Date.now()
    } finally {
      this.active--
      if (this.queue.length > 0) {
        // ✅ 基于实际时间间隔计算延迟，避免过快闪烁
        const minInterval = 100 // 最小间隔（毫秒）
        const elapsed = Date.now() - this.lastNotificationTime
        const delay = Math.max(0, minInterval - elapsed)

        setTimeout(() => {
          void this.runNext()
        }, delay)
      }
    }
  }

  /**
   * 获取通知权限级别
   *
   * @returns 权限级别字符串
   */
  async getPermissionLevel(): Promise<string> {
    if (this.permissionCache) return this.permissionCache

    try {
      const chromeNotifications = (
        chrome as unknown as {
          notifications?: {
            getPermissionLevel?: (callback: (level: string) => void) => void
          }
        }
      )?.notifications

      if (chromeNotifications && typeof chromeNotifications.getPermissionLevel === 'function') {
        this.permissionCache = await new Promise<string>(resolve => {
          chromeNotifications.getPermissionLevel!((level: string) => resolve(level || 'unknown'))
        })
        return this.permissionCache
      }
    } catch {
      // 忽略错误
    }

    return 'unknown'
  }

  /**
   * 检查通知系统诊断信息
   *
   * 用于调试和排查通知功能问题
   *
   * @returns 包含诊断信息的对象
   */
  async checkDiagnostics(): Promise<Record<string, unknown>> {
    const diagnostics: Record<string, unknown> = {}

    try {
      diagnostics.hasChrome = typeof chrome !== 'undefined'
      diagnostics.hasNotifications = !!(chrome as unknown as { notifications?: unknown })
        ?.notifications
      diagnostics.manifestHasPermission = false

      try {
        const manifest = chrome?.runtime?.getManifest
          ? (chrome.runtime.getManifest() as { permissions?: string[] })
          : null
        if (manifest && Array.isArray(manifest.permissions)) {
          diagnostics.manifestHasPermission = manifest.permissions.includes('notifications')
        }
      } catch {
        // 忽略错误
      }

      diagnostics.permissionLevel = await this.getPermissionLevel()
      diagnostics.swReachable = false

      try {
        await new Promise<void>(resolve => {
          chrome.runtime.sendMessage({ type: 'OTTERSAGE_NOTIFY_PING' }, resp => {
            try {
              if (chrome?.runtime?.lastError) {
                diagnostics.swReachable = false
                return resolve()
              }
            } catch {
              // 忽略错误
            }
            diagnostics.swReachable = !!resp?.ok
            resolve()
          })
        })
      } catch {
        // 忽略错误
      }

      logger.info('NotificationService', 'Diagnostics completed', diagnostics)
    } catch (error) {
      logger.warn('NotificationService', 'Diagnostics failed', error)
    }

    return diagnostics
  }

  /**
   * 设置服务配置
   *
   * @param config - 配置项（部分）
   */
  setConfig(config: Partial<NotificationServiceConfig>): void {
    this.config = { ...this.config, ...config }

    // ✨ 如果勿扰模式状态改变，记录日志
    if (config.enableDoNotDisturb !== undefined) {
      logger.info(
        'NotificationService',
        config.enableDoNotDisturb ? '🔕 勿扰模式已开启' : '🔔 勿扰模式已关闭'
      )
    }
  }

  /**
   * 获取当前配置
   *
   * @returns 服务配置的副本
   */
  getConfig(): NotificationServiceConfig {
    return { ...this.config }
  }

  /**
   * ✨ 设置勿扰模式
   *
   * @param enabled - 是否启用勿扰模式
   */
  setDoNotDisturb(enabled: boolean): void {
    this.setConfig({ enableDoNotDisturb: enabled })
  }

  /**
   * ✨ 获取勿扰模式状态
   *
   * @returns 是否启用勿扰模式
   */
  getDoNotDisturb(): boolean {
    return this.config.enableDoNotDisturb
  }

  /**
   * 清空通知队列
   */
  clearQueue(): void {
    this.queue = []
  }

  /**
   * 获取队列状态
   *
   * @returns 包含队列长度和活跃数量的对象
   */
  getQueueStatus(): { queueLength: number; activeCount: number } {
    return {
      queueLength: this.queue.length,
      activeCount: this.active
    }
  }

  /**
   * 清理服务资源
   *
   * 清空队列并销毁 Toast 管理器
   */
  dispose(): void {
    this.clearQueue()
    if (this.pageNotificationManager) {
      this.pageNotificationManager.dispose()
      this.pageNotificationManager = null
    }
    // ✅ 清理定时器
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
      this.cleanupTimer = null
    }
  }
}

/**
 * 默认通知服务实例
 */
export const notificationService = new NotificationService()

/**
 * 便捷函数（保持向后兼容）
 */
export async function notify(message: string, opts?: NotificationOptions): Promise<void> {
  const result = await notificationService.notify(message, opts)
  if (!result.ok) {
    throw result.error
  }
}

export const notifySuccess = (message: string, title?: string) =>
  notificationService.notifySuccess(message, title)

export const notifyInfo = (message: string, title?: string) =>
  notificationService.notifyInfo(message, title)

export const notifyWarning = (message: string, title?: string) =>
  notificationService.notifyWarning(message, title)

export const notifyError = (message: string, title?: string) =>
  notificationService.notifyError(message, title)
