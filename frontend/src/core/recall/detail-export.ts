/**
 * Detail export（详情导出）：多选 MemoryItem → JSON + Markdown（§5.10.4 · ADR-008）。
 */

import { z } from 'zod'

import type { MemoryItem } from '@/core/memory/memory-item'

/** Detail export 至少 1 条（Normative · §5.10.4）。 */
export const DETAIL_EXPORT_MIN_ITEMS = 1

/** MCP 单次 clue 响应条数上限（§5.10.5；与 UI 分轨）。 */
export const MCP_DETAIL_EXPORT_MAX_ITEMS = 5

const detailExportExcerptItemSchema = z.object({
  id: z.string().uuid(),
  type: z.literal('text_excerpt'),
  createdAt: z.string().datetime(),
  sourceUrl: z.string().url(),
  selectedText: z.string().min(1),
  pageTitle: z.string(),
  domain: z.string().min(1),
  note: z.string().optional()
})

const detailExportBookmarkItemSchema = z.object({
  id: z.string().uuid(),
  type: z.literal('bookmark'),
  createdAt: z.string().datetime(),
  url: z.string().url(),
  title: z.string().min(1),
  domain: z.string().min(1),
  note: z.string().optional()
})

export const DetailExportItemSchema = z.discriminatedUnion('type', [
  detailExportExcerptItemSchema,
  detailExportBookmarkItemSchema
])

export type DetailExportItem = z.infer<typeof DetailExportItemSchema>

export const DetailExportSchema = z.object({
  version: z.literal(1),
  exportedAt: z.string().datetime(),
  items: z.array(DetailExportItemSchema).min(DETAIL_EXPORT_MIN_ITEMS)
})

export type DetailExport = z.infer<typeof DetailExportSchema>

/** 校验导出条数是否合法（≥1）。 */
export function validateDetailExportSelectionCount(count: number): boolean {
  return count >= DETAIL_EXPORT_MIN_ITEMS
}

/** 单条 MemoryItem → Detail export 条目。 */
export function mapMemoryItemToDetailExportItem(item: MemoryItem): DetailExportItem {
  const note = item.clues.note?.trim() || undefined
  if (item.type === 'text_excerpt') {
    return {
      id: item.id,
      type: 'text_excerpt',
      createdAt: item.createdAt,
      sourceUrl: item.payload.sourceUrl,
      selectedText: item.payload.selectedText,
      pageTitle: item.payload.pageTitle,
      domain: item.payload.domain,
      ...(note ? { note } : {})
    }
  }
  return {
    id: item.id,
    type: 'bookmark',
    createdAt: item.createdAt,
    url: item.payload.url,
    title: item.payload.title,
    domain: item.payload.domain,
    ...(note ? { note } : {})
  }
}

/** 由已选 MemoryItem 构建 Detail export（调用方须保证 ≥1 条且未软删）。 */
export function buildDetailExport(
  items: MemoryItem[],
  exportedAt: string = new Date().toISOString()
): DetailExport {
  const mapped = items.map(mapMemoryItemToDetailExportItem)
  return DetailExportSchema.parse({
    version: 1,
    exportedAt,
    items: mapped
  })
}

function formatIsoForMarkdown(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) {
    return iso
  }
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short'
  })
}

function renderExcerptMarkdown(
  item: DetailExportItem & { type: 'text_excerpt' },
  index: number
): string {
  const lines = [
    `## ${index}. Text excerpt`,
    '',
    `- **ID:** \`${item.id}\``,
    `- **Saved:** ${formatIsoForMarkdown(item.createdAt)}`,
    `- **Source:** [${item.pageTitle}](${item.sourceUrl})`,
    `- **Domain:** ${item.domain}`
  ]
  if (item.note) {
    lines.push(`- **Note:** ${item.note}`)
  }
  lines.push('', '> ' + item.selectedText.replace(/\n/g, '\n> '), '')
  return lines.join('\n')
}

function renderBookmarkMarkdown(
  item: DetailExportItem & { type: 'bookmark' },
  index: number
): string {
  const lines = [
    `## ${index}. Bookmark`,
    '',
    `- **ID:** \`${item.id}\``,
    `- **Saved:** ${formatIsoForMarkdown(item.createdAt)}`,
    `- **Title:** ${item.title}`,
    `- **URL:** ${item.url}`,
    `- **Domain:** ${item.domain}`
  ]
  if (item.note) {
    lines.push(`- **Note:** ${item.note}`)
  }
  lines.push('')
  return lines.join('\n')
}

/** 与 JSON 同源的 Markdown 视图（美式英语固定文案）。 */
export function renderDetailExportMarkdown(pack: DetailExport): string {
  const header = [
    '# Yiveno detail export',
    '',
    `Exported: ${formatIsoForMarkdown(pack.exportedAt)}`,
    '',
    'Selected traces only — not a full library export.',
    ''
  ]
  const body = pack.items.map((item, index) => {
    if (item.type === 'text_excerpt') {
      return renderExcerptMarkdown(item, index + 1)
    }
    return renderBookmarkMarkdown(item, index + 1)
  })
  return [...header, ...body].join('\n').trimEnd() + '\n'
}

/** 解析并校验 Detail export JSON。 */
export function parseDetailExport(value: unknown): DetailExport {
  return DetailExportSchema.parse(value)
}
