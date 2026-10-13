/**
 * Netscape 书签 HTML 解析（Raindrop / Pocket / Chrome 导出共用格式）。
 */

import type { ParsedThirdPartyBookmark } from '@/core/memory/third-party-corpus-source'

const LINK_TAG_PATTERN = /<DT>\s*<A\b([^>]*)>([\s\S]*?)<\/A>/gi

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
}

function readAttribute(attributes: string, name: string): string | undefined {
  const pattern = new RegExp(`${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i')
  const match = attributes.match(pattern)
  if (!match) {
    return undefined
  }
  return match[2] ?? match[3] ?? match[4]
}

function parseAddDateIso(attributes: string): string | undefined {
  const raw = readAttribute(attributes, 'ADD_DATE') ?? readAttribute(attributes, 'add_date')
  if (!raw) {
    return undefined
  }
  const seconds = Number.parseInt(raw, 10)
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return undefined
  }
  return new Date(seconds * 1000).toISOString()
}

function normalizeHttpUrl(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed) {
    return null
  }
  try {
    const url = new URL(trimmed)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return null
    }
    return url.toString()
  } catch {
    return null
  }
}

function buildRemoteId(url: string, addDateIso?: string): string {
  return addDateIso ? `${url}#${addDateIso}` : url
}

/** 从 Netscape 书签 HTML 提取链接条目（忽略文件夹节点）。 */
export function parseNetscapeBookmarksHtml(html: string): ParsedThirdPartyBookmark[] {
  const results: ParsedThirdPartyBookmark[] = []
  const seen = new Set<string>()

  for (const match of html.matchAll(LINK_TAG_PATTERN)) {
    const attributes = match[1] ?? ''
    const titleRaw = match[2] ?? ''
    const href = readAttribute(attributes, 'HREF') ?? readAttribute(attributes, 'href')
    if (!href) {
      continue
    }
    const url = normalizeHttpUrl(href)
    if (!url) {
      continue
    }
    const createdAt = parseAddDateIso(attributes)
    const remoteId = buildRemoteId(url, createdAt)
    if (seen.has(remoteId)) {
      continue
    }
    seen.add(remoteId)

    const tags = readAttribute(attributes, 'TAGS') ?? readAttribute(attributes, 'tags')
    const title = decodeHtmlEntities(titleRaw.replace(/<[^>]+>/g, '').trim()) || url

    const entry: ParsedThirdPartyBookmark = {
      remoteId,
      title,
      url,
      ...(createdAt ? { createdAt } : {}),
      ...(tags?.trim() ? { note: tags.trim() } : {})
    }
    results.push(entry)
  }

  return results
}
