import { z } from 'zod'
import type { BookmarkRecord } from '../types/bookmark-record'

/**
 * 简化的 Zod Schema 验证策略
 *
 * 原则：
 * 1. **必需字段**：严格验证类型和格式
 * 2. **可选字段**：宽松验证，允许任意值（使用 z.unknown()）
 * 3. **向后兼容**：接受旧数据格式
 * 4. **性能优先**：避免复杂的 transform 和深度验证
 */

// ==================== 公共 Schema 定义 ====================

const TraitMetadataItemSchema = z.object({
  tag: z.enum(['duplicate', 'invalid', 'internal']),
  detectedAt: z.number(),
  source: z.enum(['worker', 'user', 'imported']),
  notes: z.string().optional()
})

// ==================== 数据迁移工具 ====================

/**
 * 数据迁移：清理旧的特征标签
 * 'empty' → 删除
 * '404' → 'invalid'
 * 'untagged' → 删除（不是有效的特征标签）
 */
export function migrateTraitTags(tags: string[] | undefined): string[] | undefined {
  if (!tags || tags.length === 0) return tags
  return tags
    .filter(tag => tag !== 'empty' && tag !== 'untagged')
    .map(tag => (tag === '404' ? 'invalid' : tag))
}

/**
 * 数据迁移：清理旧的特征元数据
 * 'empty' → 删除
 * '404' → 'invalid'
 * 'untagged' → 删除（不是有效的特征标签）
 */
export function migrateTraitMetadata(
  metadata:
    | Array<{ tag: string; detectedAt: number; source: string; notes?: string | undefined }>
    | undefined
):
  | Array<{
      tag: 'duplicate' | 'invalid' | 'internal'
      detectedAt: number
      source: 'worker' | 'user' | 'imported'
      notes?: string
    }>
  | undefined {
  if (!metadata || metadata.length === 0) return undefined

  const migrated = metadata
    .filter(m => m.tag !== 'empty' && m.tag !== 'untagged')
    .map(m => {
      const normalized = {
        tag:
          m.tag === '404' ? ('invalid' as const) : (m.tag as 'duplicate' | 'invalid' | 'internal'),
        detectedAt: m.detectedAt,
        source: m.source as 'worker' | 'user' | 'imported'
      }

      return m.notes !== undefined ? { ...normalized, notes: m.notes } : normalized
    })

  // 如果过滤后为空，返回 undefined
  return migrated.length > 0 ? migrated : undefined
}

// ==================== BookmarkRecord Schema ====================

/**
 * 简化的 BookmarkRecord Schema
 *
 * 策略改进：
 * 1. 保持运行时验证的严格性和类型安全
 * 2. 使用 .partial() 使大部分字段可选，简化类型推断
 * 3. 使用明确的 TypeScript 类型定义（来自 bookmark-record.ts）
 * 4. Zod schema 主要用于运行时验证，类型系统使用明确的接口
 */
export const BookmarkRecordSchema = z
  .object({
    // 必需核心字段
    id: z.string(),
    title: z.string(),
    index: z.number(),
    path: z.array(z.string()),
    pathString: z.string(),
    pathIds: z.array(z.string()),
    pathIdsString: z.string(),
    ancestorIds: z.array(z.string()),
    siblingIds: z.array(z.string()),
    depth: z.number(),
    titleLower: z.string(),
    keywords: z.array(z.string()),
    isFolder: z.boolean(),
    childrenCount: z.number(),
    tags: z.array(z.string()),
    traitTags: z.array(z.string()).default([]),
    createdYear: z.number(),
    createdMonth: z.number(),
    dataVersion: z.number(),
    lastCalculated: z.number(),

    // 可选字段
    parentId: z.string().optional(),
    url: z.string().optional(),
    dateAdded: z.number().optional(),
    dateGroupModified: z.number().optional(),
    urlLower: z.string().optional(),
    domain: z.string().optional(),
    domainCategory: z.string().optional(),
    traitMetadata: z.array(TraitMetadataItemSchema).optional(),
    isInvalid: z.boolean().optional(),
    invalidReason: z
      .enum(['url_format', 'http_error', 'network_error', 'timeout', 'unknown'])
      .optional(),
    httpStatus: z.number().optional(),
    isDuplicate: z.boolean().optional(),
    duplicateOf: z.string().optional(),
    category: z.string().optional(),
    notes: z.string().optional(),
    description: z.string().optional(),
    lastVisited: z.number().optional(),
    visitCount: z.number().optional(),
    isFavorite: z.boolean().optional(),
    favoriteOrder: z.number().optional(),
    favoritedAt: z.number().optional(),
    hasMetadata: z.boolean().optional(),
    metadataUpdatedAt: z.number().optional(),
    metadataSource: z.enum(['chrome', 'merged']).optional(),
    metaTitleLower: z.string().optional(),
    metaDescriptionLower: z.string().optional(),
    metaKeywordsTokens: z.array(z.string()).optional(),
    metaBoost: z.number().optional(),
    flatIndex: z.number().optional(),
    isVisible: z.boolean().optional(),
    sortKey: z.string().optional()
  })
  .passthrough()

export const BookmarkRecordArraySchema = z.array(BookmarkRecordSchema)

// ✅ 使用明确的类型定义，而不是 z.infer
// 这样可以避免 Zod 类型推断的复杂性
export type { BookmarkRecord }

// ==================== Search Options Schema ====================

export const BookmarkSearchOptionsSchema = z
  .object({
    query: z.string().min(1),
    limit: z.number().int().nonnegative().optional(),
    sortBy: z.enum(['relevance', 'title', 'dateAdded', 'visitCount']).optional(),
    minScore: z.number().nonnegative().optional(),
    includeDomain: z.boolean().optional(),
    includeUrl: z.boolean().optional(),
    includeKeywords: z.boolean().optional(),
    includeTags: z.boolean().optional(),
    includeContent: z.boolean().optional(),
    exactMatch: z.boolean().optional(),
    fuzzyMatch: z.boolean().optional()
  })
  .passthrough()

export const BookmarkSearchResultSchema = z.object({
  id: z.string(),
  score: z.number(),
  bookmark: BookmarkRecordSchema,
  highlights: z
    .array(
      z.object({
        field: z.string(),
        matchedText: z.string()
      })
    )
    .optional()
})

export const BookmarkSearchResultArraySchema = z.array(BookmarkSearchResultSchema)
