/**
 * IndexedDB 数据库模式定义
 *
 * 职责：
 * - 定义数据库配置和版本
 * - 定义所有数据表结构
 * - 提供类型安全的数据库操作接口
 */

import type { BookmarkRecord } from './types/bookmark-record'

// ==================== 数据库配置 ====================
/**
 * IndexedDB 数据库配置
 */
export const DB_CONFIG = {
  NAME: 'YivenoDB',
  LEGACY_NAMES: [`${'otter'}${'Sage'}DB`],
  VERSION: 15, // 升级：移除未使用的 searchHistory / faviconStats / ai_jobs 表

  // 存储表名
  STORES: {
    BOOKMARKS: 'bookmarks',
    GLOBAL_STATS: 'globalStats',
    SETTINGS: 'settings',
    FAVICON_CACHE: 'faviconCache',
    EMBEDDINGS: 'embeddings',
    FOLDER_VECTORS: 'folderVectors'
  } as const
} as const

// ==================== 核心数据接口 ====================

/**
 * 书签记录 - 从 validation/records.ts 导出，确保类型与 Zod schema 一致
 */
export type { BookmarkRecord }

/**
 * 全局统计记录
 */
export interface GlobalStats {
  /** 主键 */
  key: string
  /** 兼容旧版本字段 */
  id?: string
  /** 书签数量 */
  totalBookmarks: number
  /** 文件夹数量 */
  totalFolders: number
  totalDomains: number
  /** 最后更新时间 */
  lastUpdated: number
  /** 数据版本 */
  dataVersion: number
}

/**
 * 应用设置记录
 */
export interface AppSettings {
  /** 主键 */
  key: string
  /** 值 */
  value: unknown
  type: 'string' | 'number' | 'boolean' | 'object'
  description?: string
  /** 更新时间 */
  updatedAt: number
}

/**
 * 网站图标缓存记录
 */
export interface FaviconCacheRecord {
  /** 域名 */
  domain: string
  /** 图标URL */
  faviconUrl: string
  /** 数据URL */
  dataUrl?: string
  /** 大小 */
  size: number
  /** 格式 */
  format: 'ico' | 'png' | 'svg' | 'gif'
  /** 时间戳 */
  timestamp: number
  /** 最后访问时间 */
  lastAccessed: number
  /** 访问次数 */
  accessCount: number
  /** 过期时间 */
  expiresAt: number
  /** 质量 */
  quality: 'high' | 'medium' | 'low'
  /** 是否默认 */
  isDefault: boolean
  /** 加载时间 */
  loadTime?: number
  /** 书签数量 */
  bookmarkCount: number
  /** 是否流行 */
  isPopular: boolean
  /** 重试次数 */
  retryCount: number
  /** 最后错误 */
  lastError?: string
  /** 是否阻塞 */
  isBlocked: boolean
  /** 更新时间 */
  updatedAt: number
}

/**
 * 文件夹向量记录
 *
 * 用于智能书签分类推荐
 * 每个文件夹的向量是该文件夹下所有书签向量的平均值
 */
export interface FolderVectorRecord {
  /** 文件夹 ID（主键） */
  folderId: string
  /** 文件夹名称（冗余存储，避免查询时回表） */
  folderName: string
  /** 文件夹路径（例如："书签栏 > 前端开发 > React"） */
  folderPath: string
  /** 代表向量（该文件夹下所有书签向量的平均值） */
  vector: number[]
  /** 该文件夹下的书签数量 */
  bookmarkCount: number
  /** 生成向量时使用的模型名称 */
  model: string
  /** 创建/更新时间 */
  updatedAt: number
}

// ==================== 数据库健康检查接口 ====================

/**
 * 数据库健康状态
 */
export interface DatabaseHealth {
  /** 是否健康 */
  isHealthy: boolean
  /** 预期存储 */
  expectedStores: string[]
  /** 现有存储 */
  existingStores: string[]
  /** 缺失存储 */
  missingStores: string[]
  /** 额外存储 */
  extraStores: string[]
  /** 最后检查时间 */
  lastCheck: number
  /** 错误列表 */
  errors: string[]
}

/**
 * 数据库统计信息
 */
export interface DatabaseStats {
  /** 书签数量 */
  bookmarkCount: number
  /** 图标数量 */
  faviconCount: number
  /** 设置数量 */
  settingsCount: number
  /** 总大小 */
  totalSize: number
  /** 索引大小 */
  indexSize: number
  /** 最后优化时间 */
  lastOptimized: number
}
