/**
 * BookmarkRecord 类型定义
 *
 * Type-First 方法：优先定义 TypeScript 类型，然后创建对应的 Zod schema
 */

export type { TraitTag } from '@/core/bookmark/trait-rules'

export type TraitMetadataSource = 'worker' | 'user' | 'imported'

export type InvalidReason = 'url_format' | 'http_error' | 'network_error' | 'timeout' | 'unknown'

export interface TraitMetadata {
  tag: string
  detectedAt: number
  source: TraitMetadataSource
  notes?: string | undefined
}

/**
 * 书签记录 - IndexedDB bookmarks 表结构
 *
 * 仅保留实际读写使用的字段；派生值（如 pathString）在同步时预计算以加速筛选。
 */
export interface BookmarkRecord {
  // ===== 必需字段 =====
  id: string
  title: string
  index: number
  path: string[]
  pathString: string
  pathIds: string[]
  ancestorIds: string[]
  depth: number
  titleLower: string
  keywords: string[]
  isFolder: boolean
  childrenCount: number
  tags: string[]
  traitTags: string[]

  // ===== Chrome 原生 / 派生字段 =====
  parentId?: string | undefined
  url?: string | undefined
  dateAdded?: number | undefined
  dateGroupModified?: number | undefined
  urlLower?: string | undefined
  domain?: string | undefined

  // ===== 特征检测 =====
  traitMetadata?: TraitMetadata[] | undefined
  isInvalid?: boolean | undefined
  invalidReason?: InvalidReason | undefined
  httpStatus?: number | undefined
  isDuplicate?: boolean | undefined
  duplicateOf?: string | undefined

  // ===== 用户数据 =====
  notes?: string | undefined
  description?: string | undefined
  lastVisited?: number | undefined
  visitCount?: number | undefined

  // ===== 收藏 =====
  isFavorite?: boolean | undefined
  favoriteOrder?: number | undefined
  favoritedAt?: number | undefined

  // ===== LLM 检索 Profile =====
  retrievalProfile?: string | undefined
  retrievalKeywords?: string[] | undefined
  retrievalProfileSourceHash?: string | undefined
  retrievalProfileVersion?: number | undefined
  retrievalProfileUpdatedAt?: number | undefined
}
