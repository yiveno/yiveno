import { z } from 'zod'

import { ThirdPartyCorpusSourceSchema } from '@/core/memory/third-party-corpus-source'

/** Bookmark MemoryItem 载荷。 */
export const BookmarkPayloadSchema = z.object({
  /** 书签标题 */
  title: z.string().min(1),
  /** 书签 URL */
  url: z.url(),
  /** 域名（无路径） */
  domain: z.string().min(1),
  /** favicon URL（可选） */
  faviconUrl: z.url().optional(),
  /** Chrome 书签节点 id（本机灌库） */
  chromeBookmarkId: z.string().optional(),
  /** Chrome 父文件夹 id */
  parentFolderId: z.string().optional(),
  /** Chrome 书签创建时间（ISO） */
  chromeCreatedAt: z.iso.datetime().optional(),
  /** 第三方语料源（Raindrop / Pocket · §5.10.6） */
  corpusSource: ThirdPartyCorpusSourceSchema.optional(),
  /** 源系统稳定 id（与 corpusSource 成对） */
  remoteId: z.string().min(1).optional(),
  /** 导出文件中的原始保存时间 */
  sourceCreatedAt: z.iso.datetime().optional()
})

export type BookmarkPayload = z.infer<typeof BookmarkPayloadSchema>

/** 摘录来源：缺省 / user = 用户划词；auto_extract = 打开页自动提炼摘要。 */
export const TextExcerptOriginSchema = z.enum([
  'user', // 用户主动摘录
  'auto_extract' // 打开库内页后自动提炼
])

/** Text Excerpt MemoryItem 载荷。 */
export const TextExcerptPayloadSchema = z.object({
  /** 选区正文（摘录主内容） */
  selectedText: z.string().min(1),
  /** 摘录所在页 URL */
  sourceUrl: z.url(),
  /** 页标题 */
  pageTitle: z.string(),
  /** 域名（无路径） */
  domain: z.string().min(1),
  /** 选区前上下文（可选） */
  contextBefore: z.string().optional(),
  /** 选区后上下文（可选） */
  contextAfter: z.string().optional(),
  /**
   * 来源标记；缺省视为用户摘录（兼容旧数据与云同步）。
   * auto_extract = 打开页自动提炼，不参与自循环触发。
   */
  origin: TextExcerptOriginSchema.optional()
})

export type TextExcerptPayload = z.infer<typeof TextExcerptPayloadSchema>

/** 从 URL 提取域名（纯函数）。 */
export function extractDomainFromUrl(url: string): string {
  return new URL(url).hostname
}
