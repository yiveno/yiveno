/**
 * 解析并校验 LLM 返回的一键整理 JSON
 */

import { z } from 'zod'
import { logger } from '@/infrastructure/logging/logger'

const loggerPrefix = 'OrganizeResponseParser'

export const ORGANIZE_FALLBACK_FOLDER_PATH = '未分类'
const MAX_ORGANIZE_FOLDER_DEPTH = 3
const MAX_ORGANIZE_FOLDER_NAME_LENGTH = 80

const OrganizeFolderSchema = z.object({
  name: z.string().min(1),
  path: z.string().min(1),
  bookmarkIds: z.array(z.string())
})

const OrganizeResponseSchema = z.object({
  folders: z.array(OrganizeFolderSchema)
})

export type ParsedOrganizeFolder = z.infer<typeof OrganizeFolderSchema>

/**
 * 从 LLM 文本中提取 JSON 对象
 */
export function extractOrganizeJson(text: string): string | null {
  const trimmed = text.trim()
  const markdownMatch = trimmed.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/)
  if (markdownMatch?.[1]) {
    return markdownMatch[1]
  }

  const firstBrace = trimmed.indexOf('{')
  const lastBrace = trimmed.lastIndexOf('}')
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1)
  }

  return null
}

/**
 * 从 LLM 文件夹条目中提取书签 ID 引用（兼容多种字段名与嵌套格式）
 */
function extractRawBookmarkRefs(folder: Record<string, unknown>): unknown[] {
  const candidates = [
    folder.bookmarkIds,
    folder.bookmark_ids,
    folder.bookmarks,
    folder.items,
    folder.children
  ]

  for (const candidate of candidates) {
    if (Array.isArray(candidate) && candidate.length > 0) {
      return candidate
    }
  }

  return []
}

/**
 * 提取嵌套对象中的 id 值
 */
function extractNestedId(raw: unknown): unknown {
  if (raw && typeof raw === 'object' && 'id' in raw) {
    return (raw as { id: unknown }).id
  }
  return raw
}

/**
 * 规范化 ID 字符串（去除引号、括号、前缀）
 */
function normalizeIdString(raw: string): string {
  const id = raw.trim().replace(/^[`'"]+|[`'"]+$/g, '')
  
  const bracketIdMatch = id.match(/^\[?id:\s*(.+?)\]?$/i)
  if (bracketIdMatch?.[1]) {
    return bracketIdMatch[1].trim()
  }
  
  const idPrefixMatch = id.match(/^id:\s*(.+)$/i)
  if (idPrefixMatch?.[1]) {
    return idPrefixMatch[1].trim()
  }
  
  return id
}

/**
 * 将 LLM 返回的单个引用解析为真实书签 ID
 */
export function resolveOrganizeBookmarkId(
  raw: unknown,
  validBookmarkIds: ReadonlySet<string>,
  idByListIndex?: ReadonlyMap<string, string>
): string | null {
  // 处理数字类型
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    raw = String(raw)
  }

  // 递归处理嵌套对象
  const extracted = extractNestedId(raw)
  if (extracted !== raw) {
    return resolveOrganizeBookmarkId(extracted, validBookmarkIds, idByListIndex)
  }

  // 只处理字符串
  if (typeof raw !== 'string') {
    return null
  }

  const id = normalizeIdString(raw)
  if (!id) {
    return null
  }

  // 直接匹配
  if (validBookmarkIds.has(id)) {
    return id
  }

  // 通过索引映射
  if (idByListIndex?.has(id)) {
    const mapped = idByListIndex.get(id)
    if (mapped && validBookmarkIds.has(mapped)) {
      return mapped
    }
  }

  return null
}

/**
 * 规范化 LLM 原始 JSON，统一 bookmarkIds 字段
 */
function normalizeOrganizeResponsePayload(parsed: unknown): unknown {
  if (!parsed || typeof parsed !== 'object') {
    return parsed
  }

  const record = parsed as Record<string, unknown>
  if (!Array.isArray(record.folders)) {
    return parsed
  }

  return {
    ...record,
    folders: record.folders.map(folder => {
      if (!folder || typeof folder !== 'object') {
        return folder
      }

      const folderRecord = folder as Record<string, unknown>
      const name = typeof folderRecord.name === 'string' ? folderRecord.name : ''
      const path =
        typeof folderRecord.path === 'string'
          ? folderRecord.path
          : name || (typeof folderRecord.title === 'string' ? folderRecord.title : '')

      const refs = extractRawBookmarkRefs(folderRecord)
      const bookmarkIds = refs
        .map(ref => {
          if (typeof ref === 'number') {
            return String(ref)
          }
          if (typeof ref === 'string') {
            return ref
          }
          if (ref && typeof ref === 'object' && 'id' in ref) {
            const nestedId = (ref as { id: unknown }).id
            return typeof nestedId === 'string' || typeof nestedId === 'number'
              ? String(nestedId)
              : null
          }
          return null
        })
        .filter((id): id is string => typeof id === 'string' && id.length > 0)

      return {
        ...folderRecord,
        name: name || path,
        path,
        bookmarkIds
      }
    })
  }
}

/**
 * 解析 LLM 整理响应，过滤无效书签 ID
 */
export function parseOrganizeLlmResponse(
  rawText: string,
  validBookmarkIds: ReadonlySet<string>,
  idByListIndex?: ReadonlyMap<string, string>
): ParsedOrganizeFolder[] {
  const jsonText = extractOrganizeJson(rawText)
  if (!jsonText) {
    logger.warn(loggerPrefix, '未找到 JSON 对象')
    return []
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(jsonText)
  } catch (error) {
    logger.warn(loggerPrefix, 'JSON 解析失败', error)
    return []
  }

  const normalized = normalizeOrganizeResponsePayload(parsed)
  const validated = OrganizeResponseSchema.safeParse(normalized)
  if (!validated.success) {
    logger.warn(loggerPrefix, '整理结果 schema 校验失败', validated.error.flatten())
    return []
  }

  const assigned = new Set<string>()
  const folders: ParsedOrganizeFolder[] = []

  for (const folder of validated.data.folders) {
    const bookmarkIds: string[] = []

    for (const rawId of folder.bookmarkIds) {
      const resolvedId = resolveOrganizeBookmarkId(rawId, validBookmarkIds, idByListIndex)
      if (!resolvedId || assigned.has(resolvedId)) {
        if (rawId && !resolvedId) {
          logger.debug(loggerPrefix, '忽略无效书签 ID', { id: rawId, path: folder.path })
        }
        continue
      }
      assigned.add(resolvedId)
      bookmarkIds.push(resolvedId)
    }

    if (bookmarkIds.length === 0 && folder.bookmarkIds.length > 0) {
      continue
    }

    folders.push({
      ...folder,
      bookmarkIds
    })
  }

  return folders
}

/**
 * 合并单个文件夹的书签 ID
 */
function mergeFolderBookmarkIds(
  existing: ParsedOrganizeFolder,
  uniqueIds: string[]
): ParsedOrganizeFolder {
  const mergedIds = [...existing.bookmarkIds]
  for (const bookmarkId of uniqueIds) {
    if (!mergedIds.includes(bookmarkId)) {
      mergedIds.push(bookmarkId)
    }
  }
  return {
    ...existing,
    bookmarkIds: mergedIds
  }
}

/**
 * 合并多批 LLM 整理结果
 */
export function mergeOrganizeFolderBatches(
  batches: ParsedOrganizeFolder[][]
): ParsedOrganizeFolder[] {
  const pathMap = new Map<string, ParsedOrganizeFolder>()
  const globallyAssigned = new Set<string>()

  for (const batch of batches) {
    for (const folder of batch) {
      const uniqueIds: string[] = []
      for (const bookmarkId of folder.bookmarkIds) {
        if (globallyAssigned.has(bookmarkId)) {
          continue
        }
        globallyAssigned.add(bookmarkId)
        uniqueIds.push(bookmarkId)
      }

      if (uniqueIds.length === 0) {
        continue
      }

      const existing = pathMap.get(folder.path)
      if (existing) {
        pathMap.set(folder.path, mergeFolderBookmarkIds(existing, uniqueIds))
      } else {
        pathMap.set(folder.path, { ...folder, bookmarkIds: uniqueIds })
      }
    }
  }

  return [...pathMap.values()]
}

/**
 * 将未分配的书签归入「未分类」文件夹
 */
export function appendUnassignedBookmarksToFallback(
  folders: ParsedOrganizeFolder[],
  _allBookmarkIds: readonly string[]
): ParsedOrganizeFolder[] {
  const assigned = new Set(folders.flatMap(folder => folder.bookmarkIds))
  const unassigned = _allBookmarkIds.filter(id => !assigned.has(id))

  if (unassigned.length === 0) {
    return folders
  }

  const result = [...folders]
  const fallbackPath = ORGANIZE_FALLBACK_FOLDER_PATH
  const existing = result.find(folder => folder.path === fallbackPath || folder.name === '未分类')

  if (existing) {
    const merged = new Set([...existing.bookmarkIds, ...unassigned])
    existing.bookmarkIds = [...merged]
    return result
  }

  result.push({
    name: '未分类',
    path: fallbackPath,
    bookmarkIds: [...unassigned]
  })

  logger.info(loggerPrefix, '未分类书签已归入兜底文件夹', {
    unassignedCount: unassigned.length
  })

  return result
}

/**
 * 规范化文件夹路径：统一分隔符、裁剪深度、过滤空段。
 */
export function sanitizeOrganizeFolderPath(path: string, fallbackName?: string): string {
  const parts = path
    .split(/\s*(?:>|\/)\s*/)
    .map(part => part.trim())
    .filter(Boolean)
    .slice(0, MAX_ORGANIZE_FOLDER_DEPTH)
    .map(part => part.slice(0, MAX_ORGANIZE_FOLDER_NAME_LENGTH))

  if (parts.length > 0) {
    return parts.join('/')
  }

  const name = (fallbackName || '未分类').trim()
  return name.slice(0, MAX_ORGANIZE_FOLDER_NAME_LENGTH) || ORGANIZE_FALLBACK_FOLDER_PATH
}

/**
 * 为整批书签生成确定性兜底文件夹（LLM 批次失败时使用）。
 */
export function createDeterministicChunkFallback(
  bookmarkIds: readonly string[],
  path: string = ORGANIZE_FALLBACK_FOLDER_PATH
): ParsedOrganizeFolder {
  const safePath = sanitizeOrganizeFolderPath(path)
  const name = safePath.split('/').pop() || '未分类'
  return {
    name,
    path: safePath,
    bookmarkIds: [...bookmarkIds]
  }
}

/**
 * 规范化 LLM 文件夹列表，确保路径合法且全部书签 ID 被覆盖。
 */
export function sanitizeOrganizeFolders(
  folders: ParsedOrganizeFolder[]
): ParsedOrganizeFolder[] {
  const normalized = folders
    .map(folder => {
      const path = sanitizeOrganizeFolderPath(folder.path || folder.name, folder.name)
      const name = (folder.name || path.split('/').pop() || '未分类').slice(
        0,
        MAX_ORGANIZE_FOLDER_NAME_LENGTH
      )
      const bookmarkIds = [
        ...new Set(folder.bookmarkIds.map(id => String(id).trim()).filter(Boolean))
      ]

      return { name, path, bookmarkIds }
    })
    .filter(folder => folder.path.length > 0)

  const merged = mergeOrganizeFolderBatches([normalized])
  return merged
}
