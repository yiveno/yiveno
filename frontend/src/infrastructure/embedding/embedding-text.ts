/**
 * Embedding 文本构造与 E5 query/passage 前缀
 */

import type { BookmarkRecord } from '@/infrastructure/indexeddb/manager'
import {
  EMBEDDING_PASSAGE_PREFIX,
  EMBEDDING_QUERY_PREFIX
} from '@/infrastructure/embedding/embedding-model-config'

/** 书签 passage 文本的最大长度（字符），超出截断 */
export const EMBEDDING_PASSAGE_MAX_CHARS = 512

/**
 * 为 E5 检索模型格式化用户查询
 */
export function formatEmbeddingQuery(text: string): string {
  const trimmed = text.trim()
  if (!trimmed) return EMBEDDING_QUERY_PREFIX
  if (trimmed.startsWith(EMBEDDING_QUERY_PREFIX)) return trimmed
  return `${EMBEDDING_QUERY_PREFIX}${trimmed}`
}

/**
 * 为 E5 检索模型格式化文档 passage（书签、文件夹等）
 */
export function formatEmbeddingPassage(text: string): string {
  const trimmed = text.trim()
  if (!trimmed) return EMBEDDING_PASSAGE_PREFIX
  if (trimmed.startsWith(EMBEDDING_PASSAGE_PREFIX))
    return trimmed.slice(0, EMBEDDING_PASSAGE_MAX_CHARS)
  return `${EMBEDDING_PASSAGE_PREFIX}${trimmed}`.slice(0, EMBEDDING_PASSAGE_MAX_CHARS)
}

/**
 * 将书签转换为用于 passage embedding 的文本（不含前缀）
 */
export function buildBookmarkPassageBody(bookmark: BookmarkRecord): string {
  const parts: string[] = []

  if (bookmark.metaTitleLower) {
    parts.push(bookmark.metaTitleLower)
  } else if (bookmark.title) {
    parts.push(bookmark.title)
  }

  if (bookmark.path && bookmark.path.length > 1) {
    const folderPath = bookmark.path.slice(0, -1).join(' > ')
    if (folderPath) {
      parts.push(folderPath)
    }
  }

  if (bookmark.metaDescriptionLower) {
    parts.push(bookmark.metaDescriptionLower.slice(0, 200))
  }

  if (bookmark.metaKeywordsTokens && bookmark.metaKeywordsTokens.length > 0) {
    parts.push(bookmark.metaKeywordsTokens.slice(0, 10).join(' '))
  }

  if (bookmark.domain) {
    parts.push(bookmark.domain)
  }

  if (bookmark.url) {
    try {
      const url = new URL(bookmark.url)
      const pathWords = url.pathname
        .split(/[/\-_.]/)
        .filter(w => w.length > 2)
        .slice(0, 5)
        .join(' ')
      if (pathWords) parts.push(pathWords)
    } catch {
      // 忽略无效 URL
    }
  }

  return parts.join(' | ').slice(0, EMBEDDING_PASSAGE_MAX_CHARS)
}

/**
 * 书签 passage 文本（含 E5 前缀，用于 embedding）
 */
export function buildBookmarkPassageText(bookmark: BookmarkRecord): string {
  return formatEmbeddingPassage(buildBookmarkPassageBody(bookmark))
}
