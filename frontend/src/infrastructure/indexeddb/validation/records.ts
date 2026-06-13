import { z } from 'zod'
import type { BookmarkRecord, TraitMetadata } from '../types/bookmark-record'

/**
 * 简化的 Zod Schema 验证策略
 *
 * 原则：
 * 1. **必需字段**：严格验证类型和格式
 * 2. **可选字段**：宽松验证
 * 3. **向后兼容**：旧版冗余字段在 parse 时通过 strip 丢弃
 */

const TraitMetadataItemSchema = z.object({
  tag: z.enum(['duplicate', 'invalid', 'internal']),
  detectedAt: z.number(),
  source: z.enum(['worker', 'user', 'imported']),
  notes: z.string().optional()
})

/**
 * 数据迁移：清理旧的特征标签
 */
export function migrateTraitTags(tags: string[] | undefined): string[] | undefined {
  if (!tags || tags.length === 0) return tags
  return tags
    .filter(tag => tag !== 'empty' && tag !== 'untagged')
    .map(tag => (tag === '404' ? 'invalid' : tag))
}

/**
 * 数据迁移：清理旧的特征元数据
 */
export function migrateTraitMetadata(
  metadata:
    | Array<{
        tag: string
        detectedAt: number
        source: string
        notes?: string | undefined
      }>
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

  return metadata
    .filter(item => item.tag !== 'empty' && item.tag !== 'untagged')
    .map(item => ({
      tag: (item.tag === '404' ? 'invalid' : item.tag) as 'duplicate' | 'invalid' | 'internal',
      detectedAt: item.detectedAt,
      source: item.source as 'worker' | 'user' | 'imported',
      ...(item.notes !== undefined ? { notes: item.notes } : {})
    }))
}

export const BookmarkRecordSchema = z
  .object({
    id: z.string(),
    title: z.string(),
    index: z.number(),
    path: z.array(z.string()),
    pathString: z.string(),
    pathIds: z.array(z.string()),
    ancestorIds: z.array(z.string()),
    depth: z.number(),
    titleLower: z.string(),
    keywords: z.array(z.string()),
    isFolder: z.boolean(),
    childrenCount: z.number(),
    tags: z.array(z.string()),
    traitTags: z.array(z.string()).default([]),

    parentId: z.string().optional(),
    url: z.string().optional(),
    dateAdded: z.number().optional(),
    dateGroupModified: z.number().optional(),
    urlLower: z.string().optional(),
    domain: z.string().optional(),

    traitMetadata: z.array(TraitMetadataItemSchema).optional(),
    isInvalid: z.boolean().optional(),
    invalidReason: z
      .enum(['url_format', 'http_error', 'network_error', 'timeout', 'unknown'])
      .optional(),
    httpStatus: z.number().optional(),
    isDuplicate: z.boolean().optional(),
    duplicateOf: z.string().optional(),

    notes: z.string().optional(),
    description: z.string().optional(),
    lastVisited: z.number().optional(),
    visitCount: z.number().optional(),

    isFavorite: z.boolean().optional(),
    favoriteOrder: z.number().optional(),
    favoritedAt: z.number().optional(),

    retrievalProfile: z.string().optional(),
    retrievalKeywords: z.array(z.string()).optional(),
    retrievalProfileSourceHash: z.string().optional(),
    retrievalProfileVersion: z.number().optional(),
    retrievalProfileUpdatedAt: z.number().optional()
  })
  .strip()

export const BookmarkRecordArraySchema = z.array(BookmarkRecordSchema)

export type { BookmarkRecord }

/**
 * 将校验后的原始记录规范化为 BookmarkRecord（补全默认值）
 */
export function normalizeBookmarkRecord(
  record: z.infer<typeof BookmarkRecordSchema>
): BookmarkRecord {
  return {
    ...record,
    traitTags: record.traitTags ?? [],
    traitMetadata: (record.traitMetadata ?? []) as TraitMetadata[]
  }
}

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
  .strip()

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
