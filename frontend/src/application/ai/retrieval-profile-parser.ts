/**
 * 解析 LLM 批处理检索 Profile JSON
 */

import { z } from 'zod'
import type { BookmarkRetrievalProfile } from '@/core/ai/retrieval-profile-types'
import { logger } from '@/infrastructure/logging/logger'

const LOG_TAG = 'RetrievalProfileParser'

const RetrievalProfileItemSchema = z.object({
  bookmarkId: z.string().min(1),
  profile: z.string().min(1),
  keywords: z.array(z.string()).default([])
})

const RetrievalProfileBatchSchema = z.object({
  profiles: z.array(RetrievalProfileItemSchema).default([])
})

/**
 * 从 LLM 文本中提取 JSON 对象（取最外层首尾大括号，避免 markdown 非贪婪截断）
 */
export function extractRetrievalProfileJson(text: string): string | null {
  const trimmed = text.trim()
  if (!trimmed) {
    return null
  }

  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const candidate = (fencedMatch?.[1] ?? trimmed).trim()

  const firstBrace = candidate.indexOf('{')
  const lastBrace = candidate.lastIndexOf('}')
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return candidate.slice(firstBrace, lastBrace + 1)
  }

  return null
}

/**
 * 修复 LLM 常见 JSON 语法问题
 */
export function repairLlmJsonText(jsonText: string): string {
  return jsonText
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/,\s*([}\]])/g, '$1')
    .replace(/\r/g, '')
}

function tryParseJson(jsonText: string): unknown | null {
  try {
    return JSON.parse(jsonText)
  } catch {
    return null
  }
}

function normalizeKeywordList(keywords: unknown): string[] {
  if (!Array.isArray(keywords)) {
    return []
  }

  const seen = new Set<string>()
  const normalized: string[] = []

  for (const keyword of keywords) {
    if (typeof keyword !== 'string') {
      continue
    }
    const value = keyword.trim().toLowerCase()
    if (!value || seen.has(value)) {
      continue
    }
    seen.add(value)
    normalized.push(value)
    if (normalized.length >= 8) {
      break
    }
  }

  return normalized
}

function resolveBookmarkId(
  rawId: string,
  validBookmarkIds: ReadonlySet<string>,
  idByListIndex?: ReadonlyMap<string, string>
): string | null {
  let id = rawId.trim().replace(/^[`'"]+|[`'"]+$/g, '')
  if (!id) {
    return null
  }

  const bracketMatch = id.match(/^\[?id:\s*(.+?)\]?$/i)
  if (bracketMatch?.[1]) {
    id = bracketMatch[1].trim()
  }

  if (validBookmarkIds.has(id)) {
    return id
  }

  if (idByListIndex?.has(id)) {
    const mapped = idByListIndex.get(id)
    if (mapped && validBookmarkIds.has(mapped)) {
      return mapped
    }
  }

  return null
}

function mapProfilesFromUnknown(
  parsedUnknown: unknown,
  validBookmarkIds: ReadonlySet<string>,
  idByListIndex?: ReadonlyMap<string, string>
): BookmarkRetrievalProfile[] {
  const parsed = RetrievalProfileBatchSchema.safeParse(parsedUnknown)
  if (!parsed.success) {
    logger.warn(LOG_TAG, 'Schema 校验失败', { error: parsed.error.flatten() })
    return []
  }

  const results: BookmarkRetrievalProfile[] = []
  const seenIds = new Set<string>()

  for (const item of parsed.data.profiles) {
    const bookmarkId = resolveBookmarkId(item.bookmarkId, validBookmarkIds, idByListIndex)
    if (!bookmarkId || seenIds.has(bookmarkId)) {
      continue
    }

    const profile = item.profile.trim().slice(0, 120)
    const keywords = normalizeKeywordList(item.keywords)
    if (!profile) {
      continue
    }

    seenIds.add(bookmarkId)
    results.push({
      bookmarkId,
      profile,
      keywords
    })
  }

  return results
}

/**
 * 从损坏 JSON 中逐条 salvage profile 对象
 */
export function salvageRetrievalProfilesFromText(
  text: string,
  validBookmarkIds: ReadonlySet<string>,
  idByListIndex?: ReadonlyMap<string, string>
): BookmarkRetrievalProfile[] {
  const objectPattern =
    /\{[^{}]*"bookmarkId"\s*:\s*"([^"]+)"[^{}]*"profile"\s*:\s*"((?:\\.|[^"\\])*)"[^{}]*"keywords"\s*:\s*\[(.*?)\][^{}]*\}/gs

  const results: BookmarkRetrievalProfile[] = []
  const seenIds = new Set<string>()

  for (const match of text.matchAll(objectPattern)) {
    const rawId = match[1] ?? ''
    const rawProfile = (match[2] ?? '').replace(/\\"/g, '"').trim()
    const rawKeywords = match[3] ?? ''
    const bookmarkId = resolveBookmarkId(rawId, validBookmarkIds, idByListIndex)
    if (!bookmarkId || seenIds.has(bookmarkId) || !rawProfile) {
      continue
    }

    const keywords = normalizeKeywordList(
      rawKeywords
        .split(',')
        .map(part => part.trim().replace(/^['"]+|['"]+$/g, ''))
        .filter(Boolean)
    )

    seenIds.add(bookmarkId)
    results.push({
      bookmarkId,
      profile: rawProfile.slice(0, 120),
      keywords
    })
  }

  if (results.length > 0) {
    logger.info(LOG_TAG, '已从损坏 JSON salvage 部分 Profile', { count: results.length })
  }

  return results
}

/**
 * 解析并校验 LLM 批处理检索 Profile 响应
 */
export function parseRetrievalProfileBatchResponse(
  text: string,
  validBookmarkIds: ReadonlySet<string>,
  idByListIndex?: ReadonlyMap<string, string>
): BookmarkRetrievalProfile[] {
  const jsonText = extractRetrievalProfileJson(text)
  if (!jsonText) {
    logger.warn(LOG_TAG, '未找到 JSON 内容')
    return salvageRetrievalProfilesFromText(text, validBookmarkIds, idByListIndex)
  }

  const repaired = repairLlmJsonText(jsonText)
  let parsedUnknown = tryParseJson(repaired)
  if (parsedUnknown === null) {
    parsedUnknown = tryParseJson(jsonText)
  }

  if (parsedUnknown !== null) {
    const mapped = mapProfilesFromUnknown(parsedUnknown, validBookmarkIds, idByListIndex)
    if (mapped.length > 0) {
      return mapped
    }
  }

  logger.warn(LOG_TAG, 'JSON 解析失败，尝试 salvage', {
    preview: repaired.slice(0, 240)
  })

  return salvageRetrievalProfilesFromText(text, validBookmarkIds, idByListIndex)
}
