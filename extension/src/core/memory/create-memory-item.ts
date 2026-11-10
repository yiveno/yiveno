import { buildCaptureDreamingPreprocess } from '@/core/dreaming/capture-dreaming-preprocess'
import type { CaptureEntry } from '@/core/memory/capture-entry'
import type { MemoryCluesInput } from '@/core/memory/clues'
import {
  enrichMemoryClues,
  mergeUniqueStrings,
  type EnrichMemoryCluesInput
} from '@/core/memory/enrich-memory-clues'
import { mergeMemoryClueEnrichment } from '@/core/memory/merge-memory-clue-enrichment'
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
    openCount: base?.openCount ?? defaults.openCount ?? 0,
    title: base?.title ?? defaults.title,
    textExcerpt: base?.textExcerpt ?? defaults.textExcerpt,
    summary: base?.summary ?? defaults.summary,
    embedding: base?.embedding ?? defaults.embedding,
    embeddingModel: base?.embeddingModel ?? defaults.embeddingModel,
    embeddingDim: base?.embeddingDim ?? defaults.embeddingDim,
    sourceUrl: base?.sourceUrl ?? defaults.sourceUrl,
    domain: base?.domain ?? defaults.domain,
    captureEntry: base?.captureEntry ?? captureEntry ?? defaults.captureEntry,
    lastOpenedAt: base?.lastOpenedAt ?? defaults.lastOpenedAt,
    settledCount: base?.settledCount ?? defaults.settledCount ?? 0,
    lastSettledAt: base?.lastSettledAt ?? defaults.lastSettledAt,
    dismissCount: base?.dismissCount ?? defaults.dismissCount ?? 0,
    lastDismissedAt: base?.lastDismissedAt ?? defaults.lastDismissedAt,
    note: base?.note ?? defaults.note
  }
}

/** 将规则 enrichment 并入调用方 clues（调用方优先）。 */
function withEnrichment(
  base: MemoryCluesInput | undefined,
  enrichmentSource: {
    title?: string
    text?: string
    note?: string
    url?: string
    domain?: string
  }
): MemoryCluesInput | undefined {
  const enrichmentInput: EnrichMemoryCluesInput = {}
  if (enrichmentSource.title !== undefined) {
    enrichmentInput.title = enrichmentSource.title
  }
  if (enrichmentSource.text !== undefined) {
    enrichmentInput.text = enrichmentSource.text
  }
  if (enrichmentSource.url !== undefined) {
    enrichmentInput.url = enrichmentSource.url
  }
  if (enrichmentSource.domain !== undefined) {
    enrichmentInput.domain = enrichmentSource.domain
  }
  const note = base?.note ?? enrichmentSource.note
  if (note !== undefined) {
    enrichmentInput.note = note
  }

  const enrichment = enrichMemoryClues(enrichmentInput)
  const merged = mergeMemoryClueEnrichment({
    existing: {
      tags: base?.tags,
      keywords: base?.keywords,
      entities: base?.entities,
      ...(base?.summary !== undefined ? { summary: base.summary } : {})
    },
    rule: enrichment
  })
  const tags = merged.tags
  const keywords = merged.keywords
  const entities = merged.entities

  if (!base && tags.length === 0 && keywords.length === 0 && entities.length === 0) {
    return undefined
  }

  return {
    ...base,
    tags,
    keywords,
    entities,
    ...(merged.summary !== undefined ? { summary: merged.summary } : {})
  }
}

/** 创建 Bookmark MemoryItem（纯函数，不含持久化）。 */
export function createBookmarkMemoryItem(input: BookmarkBuildInput): BookmarkMemoryItem {
  const now = resolveNow(input.now)
  const id = crypto.randomUUID()
  const domain = input.payload.domain ?? extractDomainFromUrl(input.payload.url)
  const payload = BookmarkPayloadSchema.parse({ ...input.payload, domain })

  // Dreaming 预处理：withEnrichment 之前算去重/折叠键（零网络；不写 clues）
  const draftBeforeEnrichment: BookmarkMemoryItem = {
    id,
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
    createdAt: payload.chromeCreatedAt ?? now,
    updatedAt: now,
    deletedAt: null
  }
  buildCaptureDreamingPreprocess(draftBeforeEnrichment)

  const clues = withEnrichment(input.clues, {
    title: payload.title,
    url: payload.url,
    domain: payload.domain,
    ...(input.clues?.note !== undefined ? { note: input.clues.note } : {})
  })
  // 书签语料始终带 bookmark tag（与 mergeEnrichmentIntoMemoryItem / 约束邻域对齐）
  const cluesWithBookmarkType = {
    ...clues,
    tags: mergeUniqueStrings(clues?.tags, ['bookmark'])
  }

  return {
    ...draftBeforeEnrichment,
    clues: buildClues(
      cluesWithBookmarkType,
      {
        title: payload.title,
        sourceUrl: payload.url,
        domain: payload.domain
      },
      input.captureEntry
    )
  }
}

/** 创建 Text Excerpt MemoryItem（纯函数，不含持久化）。 */
export function createTextExcerptMemoryItem(input: TextExcerptBuildInput): TextExcerptMemoryItem {
  const now = resolveNow(input.now)
  const id = crypto.randomUUID()
  const domain = input.payload.domain ?? extractDomainFromUrl(input.payload.sourceUrl)
  const payload = TextExcerptPayloadSchema.parse({ ...input.payload, domain })

  // Dreaming 预处理：withEnrichment 之前算去重/折叠键（零网络；不写 clues）
  const draftBeforeEnrichment: TextExcerptMemoryItem = {
    id,
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
  buildCaptureDreamingPreprocess(draftBeforeEnrichment)

  const clues = withEnrichment(input.clues, {
    title: payload.pageTitle,
    text: payload.selectedText,
    url: payload.sourceUrl,
    domain: payload.domain,
    ...(input.clues?.note !== undefined ? { note: input.clues.note } : {})
  })

  return {
    ...draftBeforeEnrichment,
    clues: buildClues(
      clues,
      {
        title: payload.pageTitle,
        textExcerpt: payload.selectedText,
        sourceUrl: payload.sourceUrl,
        domain: payload.domain
      },
      input.captureEntry
    )
  }
}

export type CreateBookmarkInput = Omit<BookmarkBuildInput, 'ownerId' | 'sourceLocalProfileId'>
export type CreateTextExcerptInput = Omit<TextExcerptBuildInput, 'ownerId' | 'sourceLocalProfileId'>
