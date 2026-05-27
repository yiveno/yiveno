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
  NAME: 'AcuityBookmarksDB',
  VERSION: 12, // 升级：添加 FOLDER_VECTORS 存储文件夹向量

  // 存储表名
  STORES: {
    BOOKMARKS: 'bookmarks',
    GLOBAL_STATS: 'globalStats',
    SETTINGS: 'settings',
    SEARCH_HISTORY: 'searchHistory',
    FAVICON_CACHE: 'faviconCache',
    FAVICON_STATS: 'faviconStats',
    EMBEDDINGS: 'embeddings',
    FOLDER_VECTORS: 'folderVectors', // 新增：文件夹向量存储
    AI_JOBS: 'ai_jobs'
  } as const
} as const

// ==================== 索引配置 ====================
/**
 * 索引配置
 */
export const INDEX_CONFIG = {
  BOOKMARKS: {
    // 主键
    PRIMARY_KEY: 'id',

    // 单字段索引
    PARENT_ID: 'parentId',
    TITLE_LOWER: 'titleLower',
    URL_LOWER: 'urlLower',
    DOMAIN: 'domain',
    IS_FOLDER: 'isFolder',
    IS_INVALID: 'isInvalid',
    IS_DUPLICATE: 'isDuplicate',
    DEPTH: 'depth',
    CREATED_YEAR: 'createdYear',
    CREATED_MONTH: 'createdMonth',
    LAST_VISITED: 'lastVisited',
    VISIT_COUNT: 'visitCount',

    // 复合索引
    PARENT_INDEX: 'parentIndex',
    DOMAIN_CATEGORY: 'domainCategory',
    METADATA_UPDATED: 'metadataUpdatedAt',

    // 数组字段索引
    PATH_IDS: 'pathIds',
    ANCESTOR_IDS: 'ancestorIds',
    KEYWORDS: 'keywords',
    TAGS: 'tags'
  }
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
 * 筛选历史记录
 */
export interface SearchHistoryRecord {
  /** 主键 */
  id?: number
  /** 查询关键词 */
  query: string
  /** 结果数量 */
  results: number
  /** 执行时间 */
  executionTime: number
  /** 来源 */
  source: 'popup' | 'management' | 'side-panel'
  /** 时间戳 */
  timestamp: number
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
 * 嵌入向量记录
 */
export interface EmbeddingRecord {
  /** 主键 */
  id: string
  /** 关联书签ID */
  bookmarkId: string
  /** 向量 */
  vector: number[]
  /** 模型 */
  model: string
  /** 创建时间 */
  createdAt: number
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

/**
 * AI 作业记录
 */
export interface AIJobRecord {
  /** 主键 */
  id: string
  /** 作业类型 */
  type: 'embedding' | 'classification' | 'recommendation'
  /** 作业状态 */
  status: 'pending' | 'processing' | 'completed' | 'failed'
  /** 作业输入 */
  input: unknown
  /** 作业输出 */
  output?: unknown
  /** 作业错误 */
  error?: string
  /** 创建时间 */
  createdAt: number
  /** 完成时间 */
  completedAt?: number
}

// ==================== 筛选相关接口 ====================

/**
 * 筛选选项
 */
export interface SearchOptions {
  /** 查询关键词 */
  query: string
  /** 限制结果数量 */
  limit?: number
  /** 偏移量 */
  offset?: number
  /** 包含文件夹 */
  includeFolders?: boolean
  /** 包含书签 */
  includeBookmarks?: boolean
  /** 域名 */
  domains?: string[]
  /** 标签 */
  tags?: string[]
  /** 日期范围 */
  dateRange?: {
    start: number
    end: number
  }
  /** 排序字段 */
  sortBy?: 'relevance' | 'date' | 'title' | 'visitCount'
  /** 排序顺序 */
  sortOrder?: 'asc' | 'desc'
}

/**
 * 筛选结果
 */
export interface SearchResult {
  /** 书签记录 */
  record: BookmarkRecord
  /** 匹配分数 */
  score: number
  /** 匹配字段 */
  matchedFields: string[]
  /** 路径字符串 */
  pathString?: string
  highlights: Array<{
    field: string
    /** 匹配内容 */
    matches: string[]
  }>
}

// ==================== 批量操作接口 ====================

/**
 * 批量操作选项
 */
export interface BatchOptions {
  /** 批量大小 */
  batchSize?: number
  /** 延迟时间 */
  delay?: number
  /** 进度回调 */
  onProgress?: (processed: number, total: number) => void
  /** 错误回调 */
  onError?: (error: Error, item: unknown) => void
}

/**
 * 批量操作结果
 */
export interface BatchResult<T> {
  /** 是否成功 */
  success: boolean
  /** 处理数量 */
  processed: number
  /** 成功数量 */
  successful: number
  /** 失败数量 */
  failed: number
  /** 错误列表 */
  errors: Error[]
  /** 结果列表 */
  results: T[]
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
  /** 筛选历史记录数量 */
  searchHistoryCount: number
  /** 设置数量 */
  settingsCount: number
  /** 总大小 */
  totalSize: number
  /** 索引大小 */
  indexSize: number
  /** 最后优化时间 */
  lastOptimized: number
}
