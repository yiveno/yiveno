/**
 * 云端只读 MCP：对已同步 Memory 做关键词扫描 → evidence 形态（非 Hybrid）。
 * 扫描上限与 sync 批量对齐，禁止全库 dump 响应。
 */

import { z } from 'zod'

import { pullMemoryItems } from '../../data-access/memory-items'
import type { MemoryItem } from '../../schemas/memory-item'
import type { Env } from '../../types/env'
import { info } from '../../utils/logger'

/** 单次云端 MCP 扫描条数硬顶。 */
export const MCP_CLOUD_SCAN_LIMIT = 2000 as const

const EvidenceTextExcerptSchema = z.object({
  id: z.string().uuid(),
  type: z.literal('text_excerpt'),
  createdAt: z.string().datetime(),
  sourceUrl: z.string().url(),
  selectedText: z.string(),
  pageTitle: z.string(),
  domain: z.string(),
  note: z.string().optional()
})

const EvidenceBookmarkSchema = z.object({
  id: z.string().uuid(),
  type: z.literal('bookmark'),
  createdAt: z.string().datetime(),
  url: z.string().url(),
  title: z.string(),
  domain: z.string(),
  note: z.string().optional()
})

export const McpEvidenceItemSchema = z.discriminatedUnion('type', [
  EvidenceTextExcerptSchema,
  EvidenceBookmarkSchema
])

export type McpEvidenceItem = z.infer<typeof McpEvidenceItemSchema>

export const McpCloudDetailExportSchema = z.object({
  version: z.literal(1),
  exportedAt: z.string().datetime(),
  items: z.array(McpEvidenceItemSchema).min(1).max(5)
})

export type McpCloudDetailExport = z.infer<typeof McpCloudDetailExportSchema>

export const McpRecallArgsSchema = z.object({
  clue: z.string().trim().min(1).max(500),
  limit: z.number().int().min(1).max(5).optional()
})

/** 从口语线索拆出 ≥2 字符 token（无内容别名表）。 */
export function tokenizeMcpClue(clue: string): string[] {
  const tokens = clue
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map(t => t.trim())
    .filter(t => t.length >= 2)
  return [...new Set(tokens)]
}

function itemHaystack(item: MemoryItem): string {
  const parts: string[] = [
    item.clues.note ?? '',
    ...(item.clues.keywords ?? []),
    ...(item.clues.tags ?? []),
    ...(item.clues.entities ?? []),
    item.clues.domain ?? '',
    item.clues.title ?? ''
  ]
  if (item.type === 'bookmark') {
    parts.push(item.payload.title, item.payload.url, item.payload.domain)
  } else {
    parts.push(
      item.payload.selectedText,
      item.payload.pageTitle,
      item.payload.sourceUrl,
      item.payload.domain
    )
  }
  return parts.join(' ').toLowerCase()
}

function scoreItem(item: MemoryItem, tokens: string[]): number {
  if (tokens.length === 0) {
    return 0
  }
  const hay = itemHaystack(item)
  let score = 0
  for (const token of tokens) {
    if (hay.includes(token)) {
      score += 1
    }
  }
  return score
}

function toEvidenceItem(item: MemoryItem): McpEvidenceItem {
  const note = item.clues.note?.trim() || undefined
  if (item.type === 'text_excerpt') {
    return EvidenceTextExcerptSchema.parse({
      id: item.id,
      type: 'text_excerpt',
      createdAt: item.createdAt,
      sourceUrl: item.payload.sourceUrl,
      selectedText: item.payload.selectedText,
      pageTitle: item.payload.pageTitle,
      domain: item.payload.domain,
      ...(note ? { note } : {})
    })
  }
  return EvidenceBookmarkSchema.parse({
    id: item.id,
    type: 'bookmark',
    createdAt: item.createdAt,
    url: item.payload.url,
    title: item.payload.title,
    domain: item.payload.domain,
    ...(note ? { note } : {})
  })
}

/** 渲染 Markdown（与扩展 detail export 语气一致）。 */
export function renderMcpDetailExportMarkdown(pack: McpCloudDetailExport): string {
  const lines = ['# Yiveno detail export', '', `Exported: ${pack.exportedAt}`, '']
  pack.items.forEach((item, index) => {
    const n = index + 1
    if (item.type === 'text_excerpt') {
      lines.push(
        `## ${n}. Text excerpt`,
        '',
        `- **ID:** \`${item.id}\``,
        `- **Source:** [${item.pageTitle}](${item.sourceUrl})`,
        ''
      )
      if (item.note) {
        lines.push(`- **Note:** ${item.note}`, '')
      }
      lines.push(`> ${item.selectedText}`, '')
      return
    }
    lines.push(
      `## ${n}. Bookmark`,
      '',
      `- **ID:** \`${item.id}\``,
      `- **Title:** ${item.title}`,
      `- **URL:** ${item.url}`,
      ''
    )
    if (item.note) {
      lines.push(`- **Note:** ${item.note}`, '')
    }
  })
  return lines.join('\n')
}

/**
 * 拉取云端未软删 Memory，关键词打分，返回 top limit。
 * @returns null 表示无线索命中
 */
export async function recallCloudKeywordEvidence(
  env: Env,
  ownerId: string,
  clue: string,
  limit: number
): Promise<McpCloudDetailExport | null> {
  const tokens = tokenizeMcpClue(clue)
  const items = await pullMemoryItems(env, ownerId, MCP_CLOUD_SCAN_LIMIT)
  const active = items.filter(item => !item.deletedAt)

  const ranked = active
    .map(item => ({ item, score: scoreItem(item, tokens) }))
    .filter(row => row.score > 0)
    .sort((a, b) => b.score - a.score || b.item.updatedAt.localeCompare(a.item.updatedAt))
    .slice(0, Math.min(limit, 5))

  info('[Mcp] 云端关键词召回', {
    ownerId,
    tokenCount: tokens.length,
    scanned: active.length,
    hitCount: ranked.length
  })

  if (ranked.length === 0) {
    return null
  }

  return McpCloudDetailExportSchema.parse({
    version: 1,
    exportedAt: new Date().toISOString(),
    items: ranked.map(row => toEvidenceItem(row.item))
  })
}
