/**
 * Evidence pack：多选 MemoryItem → JSON + Markdown（§5.10.4 · R4）。
 * 纯函数 + Zod；禁止整库 dump。
 */

import { z } from 'zod'

import type { MemoryItem } from '@/core/memory/memory-item'

/** 可选条目数下限（Normative · §5.10.4）。 */
export const EVIDENCE_PACK_MIN_ITEMS = 2

/** 可选条目数上限（Normative · §5.10.4）。 */
export const EVIDENCE_PACK_MAX_ITEMS = 5

const evidencePackExcerptItemSchema = z.object({
  id: z.string().uuid(),
  type: z.literal('text_excerpt'),
  createdAt: z.string().datetime(),
  sourceUrl: z.string().url(),
  selectedText: z.string().min(1),
  pageTitle: z.string(),
  domain: z.string().min(1),
  note: z.string().optional()
})

const evidencePackBookmarkItemSchema = z.object({
  id: z.string().uuid(),
  type: z.literal('bookmark'),
  createdAt: z.string().datetime(),
  url: z.string().url(),
  title: z.string().min(1),
  domain: z.string().min(1),
  note: z.string().optional()
})

export const EvidencePackItemSchema = z.discriminatedUnion('type', [
  evidencePackExcerptItemSchema,
  evidencePackBookmarkItemSchema
])

export type EvidencePackItem = z.infer<typeof EvidencePackItemSchema>

export const EvidencePackSchema = z.object({
  version: z.literal(1),
  exportedAt: z.string().datetime(),
  items: z.array(EvidencePackItemSchema).min(EVIDENCE_PACK_MIN_ITEMS).max(EVIDENCE_PACK_MAX_ITEMS)
})

export type EvidencePack = z.infer<typeof EvidencePackSchema>

/** 校验条目 id 数量是否合法。 */
export function validateEvidencePackSelectionCount(count: number): boolean {
  return count >= EVIDENCE_PACK_MIN_ITEMS && count <= EVIDENCE_PACK_MAX_ITEMS
}

/** 单条 MemoryItem → evidence pack 条目。 */
export function mapMemoryItemToEvidencePackItem(item: MemoryItem): EvidencePackItem {
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

/** 由已选 MemoryItem 构建 evidence pack（调用方须保证 2–5 条且未软删）。 */
export function buildEvidencePack(
  items: MemoryItem[],
  exportedAt: string = new Date().toISOString()
): EvidencePack {
  const mapped = items.map(mapMemoryItemToEvidencePackItem)
  return EvidencePackSchema.parse({
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
  item: EvidencePackItem & { type: 'text_excerpt' },
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
  item: EvidencePackItem & { type: 'bookmark' },
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
export function renderEvidencePackMarkdown(pack: EvidencePack): string {
  const header = [
    '# Yiveno Evidence Pack',
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

/** 解析并校验 evidence pack JSON。 */
export function parseEvidencePack(value: unknown): EvidencePack {
  return EvidencePackSchema.parse(value)
}
