import { z } from 'zod'

/** Bookmark MemoryItem 载荷。 */
export const BookmarkPayloadSchema = z.object({
  title: z.string().min(1),
  url: z.string().url(),
  domain: z.string().min(1),
  faviconUrl: z.string().url().optional(),
  chromeBookmarkId: z.string().optional(),
  parentFolderId: z.string().optional(),
  chromeCreatedAt: z.string().datetime().optional()
})

export type BookmarkPayload = z.infer<typeof BookmarkPayloadSchema>

/** Text Excerpt MemoryItem 载荷。 */
export const TextExcerptPayloadSchema = z.object({
  selectedText: z.string().min(1),
  sourceUrl: z.string().url(),
  pageTitle: z.string(),
  domain: z.string().min(1),
  contextBefore: z.string().optional(),
  contextAfter: z.string().optional()
})

export type TextExcerptPayload = z.infer<typeof TextExcerptPayloadSchema>

/** 从 URL 提取域名（纯函数）。 */
export function extractDomainFromUrl(url: string): string {
  return new URL(url).hostname
}
