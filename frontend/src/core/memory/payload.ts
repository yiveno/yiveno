import { z } from 'zod'

import { ThirdPartyCorpusSourceSchema } from '@/core/memory/third-party-corpus-source'

/** Bookmark MemoryItem 载荷。 */
export const BookmarkPayloadSchema = z.object({
  title: z.string().min(1),
  url: z.string().url(),
  domain: z.string().min(1),
  faviconUrl: z.string().url().optional(),
  chromeBookmarkId: z.string().optional(),
  parentFolderId: z.string().optional(),
  chromeCreatedAt: z.string().datetime().optional(),
  /** 第三方语料源（Raindrop / Pocket · §5.10.6） */
  corpusSource: ThirdPartyCorpusSourceSchema.optional(),
  /** 源系统稳定 id（与 corpusSource 成对） */
  remoteId: z.string().min(1).optional(),
  /** 导出文件中的原始保存时间 */
  sourceCreatedAt: z.string().datetime().optional()
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
