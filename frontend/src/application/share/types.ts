/**
 * 分享功能类型定义
 * @module share/types
 */

/**
 * 分享数据结构（用于编码到 URL，已废弃，改用云端存储）
 * @deprecated 使用 ShareRecord 替代
 */
export interface ShareData {
  /** 版本号，当前为 1 */
  v: number
  /** 分享标题（可选） */
  t?: string
  /** 书签列表 */
  b: ShareBookmark[]
  /** 分享者信息（可选，仅显示昵称） */
  s?: string
}

/**
 * 分享书签数据（用于 URL 编码，已废弃）
 * @deprecated 使用 SharedBookmark 替代
 */
export interface ShareBookmark {
  /** 书签标题 */
  t: string
  /** URL */
  u: string
  /** 描述（可选） */
  d?: string
}

/**
 * 分享记录（数据库表）
 */
export interface ShareRecord {
  id: string
  user_id: string
  short_code: string | null
  title: string
  description: string | null
  bookmark_count: number
  share_type: 'link' | 'direct'
  view_count: number
  import_count: number
  created_at: string
}

/**
 * 分享的书签（数据库表）
 */
export interface SharedBookmark {
  id: string
  share_id: string
  title: string
  url: string
  description: string | null
  position: number
  created_at: string
}

/**
 * 直接分享记录（数据库表）
 */
export interface DirectShareRecord {
  id: string
  share_id: string
  sender_id: string
  recipient_id: string
  status: 'pending' | 'accepted' | 'rejected'
  message: string | null
  sent_at: string
  read_at: string | null
  imported_at: string | null
}

/**
 * 通知记录（数据库表）
 */
export interface NotificationRecord {
  id: string
  user_id: string
  type: string
  title: string
  message: string
  data: Record<string, unknown> | null
  is_read: boolean
  created_at: string
  read_at: string | null
}

/**
 * 导入历史记录（数据库表）
 */
export interface ImportHistoryRecord {
  id: string
  user_id: string
  share_id: string
  bookmark_count: number
  imported_at: string
}

/**
 * 用户信息（用于搜索）
 */
export interface UserProfile {
  id: string
  name: string
  email: string
  avatar_url: string | null
}

/**
 * 海报配置
 */
export interface PosterConfig {
  /** 海报宽度，默认 800px */
  width: number
  /** 主题 */
  theme: 'dark' | 'light'
  /** 内边距 */
  padding: number
  /** 每个书签的高度 */
  bookmarkHeight: number
  /** 二维码尺寸 */
  qrSize: number
  /** 颜色配置 */
  colors: {
    background: string
    text: string
    primary: string
    secondary: string
  }
}

/**
 * 海报生成选项
 */
export interface PosterOptions {
  /** 书签列表 */
  bookmarks: Array<{ title: string; url: string; description?: string }>
  /** 主题 */
  theme: 'dark' | 'light'
  /** 分享标题（可选） */
  title?: string
  /** 分享 URL（用于生成二维码） */
  shareUrl: string
  /** 是否显示用户名 */
  showUsername?: boolean
  /** 用户名 */
  username?: string
}

/**
 * 导入选项
 */
export interface ImportOptions {
  /** 书签列表 */
  bookmarks: Array<{ title: string; url: string }>
  /** 目标文件夹 ID */
  targetFolderId: string
  /** 进度回调 */
  onProgress?: (current: number, total: number) => void
}

/**
 * 导入结果
 */
export interface ImportResult {
  /** 成功数量 */
  success: number
  /** 失败数量 */
  failed: number
  /** 错误列表 */
  errors: Array<{ bookmark: string; error: string }>
}

/**
 * 分享错误代码
 */
export enum ShareErrorCode {
  DATA_TOO_LARGE = 'DATA_TOO_LARGE',
  INVALID_DATA = 'INVALID_DATA',
  CLIPBOARD_NOT_SUPPORTED = 'CLIPBOARD_NOT_SUPPORTED',
  CANVAS_NOT_SUPPORTED = 'CANVAS_NOT_SUPPORTED',
  EXTENSION_NOT_INSTALLED = 'EXTENSION_NOT_INSTALLED',
  IMPORT_FAILED = 'IMPORT_FAILED'
}

/**
 * 分享错误类
 */
export class ShareError extends Error {
  constructor(
    public code: ShareErrorCode,
    message: string
  ) {
    super(message)
    this.name = 'ShareError'
  }
}
