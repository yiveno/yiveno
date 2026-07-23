import type { CaptureEntry } from '@/core/memory/capture-entry'
import type { MemoryCluesInput } from '@/core/memory/clues'
import { type BookmarkMemoryItem, type TextExcerptMemoryItem } from '@/core/memory/memory-item'
import {
  BookmarkPayloadSchema,
  TextExcerptPayloadSchema,
  extractDomainFromUrl,
  type BookmarkPayload,
  type TextExcerptPayload
} from '@/core/memory/payload'

type TimestampProvider = () => string

interface MemoryItemBuildContext {
  ownerId: string
  sourceLocalProfileId: string
  clues?: MemoryCluesInput
  captureEntry?: CaptureEntry
  now?: TimestampProvider
}

interface BookmarkBuildInput extends MemoryItemBuildContext {
  payload: Omit<BookmarkPayload, 'domain'> & { domain?: string }
}

interface TextExcerptBuildInput extends MemoryItemBuildContext {
  payload: Omit<TextExcerptPayload, 'domain'> & { domain?: string }
}

function resolveNow(now?: TimestampProvider): string {
  return now?.() ?? new Date().toISOString()
}

function buildClues(
  base: MemoryCluesInput | undefined,
  defaults: MemoryCluesInput,
  captureEntry?: CaptureEntry
) {
  return {
    keywords: base?.keywords ?? defaults.keywords ?? [],
    entities: base?.entities ?? defaults.entities ?? [],
    tags: base?.tags ?? defaults.tags ?? [],
    openCount: 0,
    title: base?.title ?? defaults.title,
    textExcerpt: base?.textExcerpt ?? defaults.textExcerpt,
    summary: base?.summary ?? defaults.summary,
    embedding: base?.embedding ?? defaults.embedding,
    sourceUrl: base?.sourceUrl ?? defaults.sourceUrl,
    domain: base?.domain ?? defaults.domain,
    captureEntry: base?.captureEntry ?? captureEntry ?? defaults.captureEntry,
    lastOpenedAt: base?.lastOpenedAt ?? defaults.lastOpenedAt,
    note: base?.note ?? defaults.note
  }
}

/** 创建 Bookmark MemoryItem（纯函数，不含持久化）。 */
export function createBookmarkMemoryItem(input: BookmarkBuildInput): BookmarkMemoryItem {
  const now = resolveNow(input.now)
  const domain = input.payload.domain ?? extractDomainFromUrl(input.payload.url)
  const payload = BookmarkPayloadSchema.parse({ ...input.payload, domain })

  return {
    id: crypto.randomUUID(),
    ownerId: input.ownerId,
    sourceLocalProfileId: input.sourceLocalProfileId,
    type: 'bookmark',
    payload,
    clues: buildClues(
      input.clues,
      {
        title: payload.title,
        sourceUrl: payload.url,
        domain: payload.domain
      },
      input.captureEntry
    ),
    createdAt: now,
    updatedAt: now,
    deletedAt: null
  }
}

/** 创建 Text Excerpt MemoryItem（纯函数，不含持久化）。 */
export function createTextExcerptMemoryItem(input: TextExcerptBuildInput): TextExcerptMemoryItem {
  const now = resolveNow(input.now)
  const domain = input.payload.domain ?? extractDomainFromUrl(input.payload.sourceUrl)
  const payload = TextExcerptPayloadSchema.parse({ ...input.payload, domain })

  return {
    id: crypto.randomUUID(),
    ownerId: input.ownerId,
    sourceLocalProfileId: input.sourceLocalProfileId,
    type: 'text_excerpt',
    payload,
    clues: buildClues(
      input.clues,
      {
        title: payload.pageTitle,
        textExcerpt: payload.selectedText,
        sourceUrl: payload.sourceUrl,
        domain: payload.domain
      },
      input.captureEntry
    ),
    createdAt: now,
    updatedAt: now,
    deletedAt: null
  }
}

export type CreateBookmarkInput = Omit<BookmarkBuildInput, 'ownerId' | 'sourceLocalProfileId'>
export type CreateTextExcerptInput = Omit<TextExcerptBuildInput, 'ownerId' | 'sourceLocalProfileId'>
