/**
 * 通知系统的级别定义。
 */
export type NotificationLevel = 'info' | 'success' | 'warning' | 'error'

/**
 * 徽章级别（与通知级别保持一致）。
 */
export type BadgeLevel = NotificationLevel

/**
 * 徽章颜色映射。
 */
export type BadgeColor = string

/** 页面/系统通知的原始载荷，便于事件订阅与总线传递。 */
export interface NotificationPayload {
  /** 唯一 ID */
  id: string
  /** 展示文案 */
  text: string
  /** 通知级别 */
  level: NotificationLevel
  /** 创建时间戳（毫秒） */
  createdAt: number
  /** 是否自动关闭 */
  autoClose?: boolean | undefined
  /** 自定义停留时间 */
  duration?: number | undefined
}

/**
 * 徽章配置选项。
 */
export interface BadgeOptions {
  /** 徽章文本内容 */
  text: string
  /** 徽章背景颜色（默认根据级别自动选择） */
  color?: BadgeColor | undefined
  /** 徽章级别（影响默认颜色） */
  level?: BadgeLevel | undefined
  /** 是否在通知结束后自动清除徽章 */
  autoClear?: boolean | undefined
  /** 自动清除延迟（毫秒，默认立即清除） */
  clearDelay?: number | undefined
}

/**
 * 通知显示选项。
 *
 * 同时兼容旧字段 `type`，避免升级带来破坏性改动。
 */
export interface NotificationOptions {
  /** 标题 */
  title?: string | undefined
  /** 主体内容 */
  message?: string | undefined
  /** 新版级别字段 */
  level?: NotificationLevel | undefined
  /** 旧版级别字段 */
  type?: NotificationLevel | undefined
  /** 显示时长（毫秒） */
  timeoutMs?: number | undefined
  /** 通知优先级，用于系统通知 */
  priority?: 'low' | 'normal' | 'high' | undefined
  /** 是否保持常驻 */
  persistent?: boolean | undefined
  /** 自动关闭（布尔或毫秒） */
  autoClose?: boolean | number | undefined
  /** 图标地址 */
  iconUrl?: string | undefined
  /** 图标字体类名等 */
  icon?: string | undefined
  /** 图片地址 */
  imageUrl?: string | undefined
  /** 自定义操作按钮 */
  actions?: Array<{ label: string; action: string }> | undefined
  /** 附加数据 */
  data?: Record<string, unknown> | undefined
  /** 来源标识 */
  source?: string | undefined
  /** 分组 ID（防止重复） */
  groupId?: string | undefined
  /** 是否播放提示音 */
  playSound?: boolean | undefined
  /** 是否弹出系统通知 */
  showDesktopNotification?: boolean | undefined
  /** 去重 key */
  key?: string | undefined
  /** ✨ 是否更新扩展图标徽章 */
  updateBadge?: boolean | undefined
  /** ✨ 徽章配置（如果 updateBadge 为 true） */
  badge?: BadgeOptions | undefined
  /** ✨ 简化配置：直接指定徽章文本 */
  badgeText?: string | undefined
  /** ✨ 简化配置：直接指定徽章颜色 */
  badgeColor?: BadgeColor | undefined
}

/** Toast 级别与通知级别保持一致。 */
export type ToastLevel = NotificationLevel

/** Toast 展示时的附加选项。 */
export interface ToastShowOptions {
  /** Toast 级别 */
  level?: ToastLevel | undefined
  /** 标题 */
  title?: string | undefined
  /** 旧版停留时间（毫秒） */
  timeout?: number | undefined
  /** 新版停留时间（毫秒） */
  timeoutMs?: number | undefined
  /** 🎯 Ant Design 风格：相同 key 的通知会更新而不是创建新的 */
  key?: string | undefined
}

/**
 * Toast 组件对外暴露的实例接口。
 */
export interface ToastInstance {
  /** Toast 唯一 ID */
  id: string
  /** Toast 级别 */
  level: ToastLevel
  /** 展示文案 */
  message: string
  /** 创建时间戳 */
  createdAt: number
  /** 定时器句柄 */
  timeoutHandle?: number | undefined
  /** 对外暴露的显示方法 */
  showToast(message: string, opts?: ToastShowOptions): string
}

/**
 * NotificationService 的内部队列项。
 */
export interface QueuedNotification {
  /** 队列 ID */
  id: string
  /** 文案内容 */
  message: string
  /** 通知配置 */
  options: NotificationOptions
  /** 入队时间 */
  createdAt: number
}

/**
 * 通知服务的全局配置。
 */
export interface NotificationServiceConfig {
  /** 默认标题 */
  defaultTitle: string
  /** 默认显示时长 */
  defaultTimeout: number
  /** 同时允许的系统通知数量 */
  concurrency: number
  /** 同内容抑制间隔 */
  suppressWindowMs: number
  /** 是否启用系统通知 */
  enableSystemNotifications: boolean
  /** 是否启用页面 Toast */
  enablePageToasts: boolean
  /** ✨ 是否启用扩展图标徽章 */
  enableBadge: boolean
  /** ✨ 勿扰模式：开启后所有通知都不会显示 */
  enableDoNotDisturb: boolean
}

/**
 * 事件通道接口，用于在不同模块之间广播通知。
 */
export interface NotificationChannel {
  /** 注册监听 */
  subscribe(callback: (payload: NotificationPayload) => void): () => void
  /** 广播通知 */
  publish(payload: NotificationPayload): void
}
