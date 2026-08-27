/**
 * Raindrop CSV 导出解析（首行表头；link/title/created/excerpt/tags）。
 */

import type { ParsedThirdPartyBookmark } from '@/core/memory/third-party-corpus-source'

function splitCsvLine(line: string): string[] {
  const cells: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i]
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i += 1
      } else {
        inQuotes = !inQuotes
      }
      continue
    }
    if (char === ',' && !inQuotes) {
      cells.push(current)
      current = ''
      continue
    }
    current += char
  }
  cells.push(current)
  return cells.map(cell => cell.trim())
}

function headerIndex(headers: string[], candidates: string[]): number {
  const normalized = headers.map(h => h.trim().toLowerCase())
  for (const candidate of candidates) {
    const index = normalized.indexOf(candidate)
    if (index >= 0) {
      return index
    }
  }
  return -1
}

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

/** 解析 Raindrop CSV 导出文本。 */
export function parseRaindropCsv(content: string): ParsedThirdPartyBookmark[] {
  const lines = content
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
  if (lines.length < 2) {
    return []
  }

  const headers = splitCsvLine(lines[0] ?? '')
  const linkIndex = headerIndex(headers, ['link', 'url'])
  const titleIndex = headerIndex(headers, ['title', 'name'])
  const createdIndex = headerIndex(headers, ['created', 'created at', 'date'])
  const excerptIndex = headerIndex(headers, ['excerpt', 'note', 'description'])
  const tagsIndex = headerIndex(headers, ['tags', 'tag'])
  const idIndex = headerIndex(headers, ['id', '_id'])

  if (linkIndex < 0) {
    return []
  }

  const results: ParsedThirdPartyBookmark[] = []
  const seen = new Set<string>()

  for (const line of lines.slice(1)) {
    const cells = splitCsvLine(line)
    const urlRaw = cells[linkIndex]?.trim()
    if (!urlRaw) {
      continue
    }
    let url: string
    try {
      const parsed = new URL(urlRaw)
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        continue
      }
      url = parsed.toString()
    } catch {
      continue
    }

    const title = (titleIndex >= 0 ? cells[titleIndex]?.trim() : '') || url
    const createdAt = parseCreatedIso(createdIndex >= 0 ? cells[createdIndex] : undefined)
    const remoteIdRaw = idIndex >= 0 ? cells[idIndex]?.trim() : ''
    const remoteId = remoteIdRaw || (createdAt ? `${url}#${createdAt}` : url)
    if (seen.has(remoteId)) {
      continue
    }
    seen.add(remoteId)

    const noteParts: string[] = []
    const excerpt = excerptIndex >= 0 ? cells[excerptIndex]?.trim() : ''
    const tags = tagsIndex >= 0 ? cells[tagsIndex]?.trim() : ''
    if (excerpt) {
      noteParts.push(excerpt)
    }
    if (tags) {
      noteParts.push(tags)
    }

    results.push({
      remoteId,
      title,
      url,
      ...(createdAt ? { createdAt } : {}),
      ...(noteParts.length > 0 ? { note: noteParts.join(' · ') } : {})
    })
  }

  return results
}
