/**
 * Raindrop API / 备份 JSON 解析（items 数组；_id + link + title + created）。
 */

import { z } from 'zod'

import type { ParsedThirdPartyBookmark } from '@/core/memory/third-party-corpus-source'

const raindropItemSchema = z.object({
  _id: z.union([z.string(), z.number()]).optional(),
  id: z.union([z.string(), z.number()]).optional(),
  link: z.string().url().optional(),
  url: z.string().url().optional(),
  title: z.string().optional(),
  excerpt: z.string().optional(),
  note: z.string().optional(),
  created: z.string().optional(),
  createdAt: z.string().optional()
})

const raindropEnvelopeSchema = z.union([
  z.object({ items: z.array(raindropItemSchema) }),
  z.object({ raindrops: z.array(raindropItemSchema) }),
  z.array(raindropItemSchema)
])

function parseCreatedIso(raw: string | undefined): string | undefined {
  if (!raw?.trim()) {
    return undefined
  }
  const date = new Date(raw.trim())
  if (Number.isNaN(date.getTime())) {
    return undefined
  }
  return date.toISOString()
}

/** 解析 Raindrop JSON 导出（数组或 { items } 包装）。 */
export function parseRaindropJson(content: string): ParsedThirdPartyBookmark[] {
  let parsed: unknown
  try {
    parsed = JSON.parse(content)
  } catch {
    return []
  }

  const envelope = raindropEnvelopeSchema.safeParse(parsed)
  if (!envelope.success) {
    return []
  }

  const items = Array.isArray(envelope.data)
    ? envelope.data
    : 'items' in envelope.data
      ? envelope.data.items
      : envelope.data.raindrops

  const results: ParsedThirdPartyBookmark[] = []
  const seen = new Set<string>()

  for (const item of items) {
    const urlRaw = item.link ?? item.url
    if (!urlRaw) {
      continue
    }
    let url: string
    try {
      const parsedUrl = new URL(urlRaw)
      if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
        continue
      }
      url = parsedUrl.toString()
    } catch {
      continue
    }

    const remoteIdRaw = item._id ?? item.id
    const remoteId = remoteIdRaw !== undefined && remoteIdRaw !== null ? String(remoteIdRaw) : url
    if (seen.has(remoteId)) {
      continue
    }
    seen.add(remoteId)

    const createdAt = parseCreatedIso(item.created ?? item.createdAt)
    const note = item.note?.trim() || item.excerpt?.trim() || undefined
    const title = item.title?.trim() || url

    results.push({
      remoteId,
      title,
      url,
      ...(createdAt ? { createdAt } : {}),
      ...(note ? { note } : {})
    })
  }

  return results
}
