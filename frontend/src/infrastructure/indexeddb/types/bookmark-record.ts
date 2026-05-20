/**
 * BookmarkRecord 类型定义
 * 
 * Type-First 方法：优先定义 TypeScript 类型，然后创建对应的 Zod schema
 * 优势：
 * 1. 类型推断更准确，避免 z.infer 的复杂性
 * 2. 类型定义和运行时验证分离，职责清晰
 * 3. 更容易维护和理解
 */

// ==================== 导入统一的特征类型 ====================

export type { TraitTag } from '@/core/bookmark/trait-rules'

// ==================== 辅助类型 ====================

export type TraitMetadataSource = 'worker' | 'user' | 'imported'

export type InvalidReason = 'url_format' | 'http_error' | 'network_error' | 'timeout' | 'unknown'

export type MetadataSource = 'chrome' | 'crawler' | 'merged'

export interface TraitMetadata {
  tag: string // 使用 string 而不是 TraitTag，避免循环依赖
  detectedAt: number
  source: TraitMetadataSource
  notes?: string
}

// ==================== 核心类型 ====================

/**
 * 书签记录 - 明确的类型定义
 * 
 * 必需字段：数据完整性的核心字段
 * 可选字段：扩展功能字段，向后兼容
 */
export interface BookmarkRecord {
  // ===== 必需字段 (Core Fields) =====
  id: string
  title: string
  index: number
  path: string[]
  pathString: string
  pathIds: string[]
  pathIdsString: string
  ancestorIds: string[]
  siblingIds: string[]
  depth: number
  titleLower: string
  keywords: string[]
  isFolder: boolean
  childrenCount: number
  tags: string[]
  traitTags: string[]
  createdYear: number
  createdMonth: number
  dataVersion: number
  lastCalculated: number

  // ===== 可选字段 (Optional Fields) =====
  // Chrome 原生字段
  parentId?: string
  url?: string
  dateAdded?: number
  dateGroupModified?: number

  // 派生字段
  urlLower?: string
  domain?: string
  domainCategory?: string

  // 特征字段
  traitMetadata?: TraitMetadata[]
  isInvalid?: boolean
  invalidReason?: InvalidReason
  httpStatus?: number
  isDuplicate?: boolean
  duplicateOf?: string

  // 用户数据
  category?: string
  notes?: string
  description?: string // AI 生成的文件夹描述
  lastVisited?: number
  visitCount?: number

  // 收藏功能
  isFavorite?: boolean
  favoriteOrder?: number
  favoritedAt?: number

  // 元数据增强
  hasMetadata?: boolean
  metadataUpdatedAt?: number
  metadataSource?: MetadataSource
  metaTitleLower?: string
  metaDescriptionLower?: string
  metaKeywordsTokens?: string[]
  metaBoost?: number

  // 虚拟化支持
  flatIndex?: number
  isVisible?: boolean
  sortKey?: string
}
