/**
 * 分享功能类型定义
 * @module share/types
 */

/**
 * 分享数据结构（用于编码到 URL）
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
 * 分享书签数据
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
