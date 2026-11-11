/**
 * Dreaming Phase 4 · 命题命中 eval 固定库（与主 RECALL_EVAL corpus 独立）。
 * 用例直接构造 NoteMatchSet，不读 IndexedDB。
 */

import {
  createBookmarkMemoryItem,
  createTextExcerptMemoryItem
} from '@/core/memory/create-memory-item'
import type { MemoryItem } from '@/core/memory/memory-item'
import type { SupportedMemoryItemType } from '@/core/memory/memory-item-type'
import { DREAMING_SCHEMA_VERSION } from '@/core/dreaming/dreaming-constants'
import {
  HYBRID_FAKE_EMBEDDING_DIM,
  makeFakeEmbedding
} from '@/core/recall/eval/hybrid-fake-embedding'
import {
  buildNoteMatchSet,
  type NoteMatchCandidate,
  type NoteMatchSet
} from '@/core/recall/note-match'
import {
  buildMemoryNoteId,
  type MemoryNoteRecord
} from '@/infrastructure/indexeddb/memory-notes-types'

/** Dreaming eval 固定条目 id（接在 RECALL_EVAL_IDS …128 之后，自 …129 起）。 */
export const DREAMING_EVAL_IDS = {
  /** D-N1/D-N2：Rottnest 摘录（selectedText 不含线索词） */
  dreamingRottnestExcerpt: '11111111-1111-4111-8111-111111111129',
  /** D-N3：Rottnest 书签 */
  dreamingRottnestBookmark: '11111111-1111-4111-8111-111111111130',
  /** D-N3：同键重复 sibling */
  dreamingRottnestBookmarkDup: '11111111-1111-4111-8111-111111111131',
  /** D-N5：含 exclude 词的摘录 */
  dreamingExcludeExcerpt: '11111111-1111-4111-8111-111111111132',
  /** D-N6(b)：脏命题的源 */
  dreamingDirtyExcerpt: '11111111-1111-4111-8111-111111111133',
  /** D-N6(a)：已软删源（只被命题引用，不在 corpus 内） */
  dreamingDeletedExcerpt: '11111111-1111-4111-8111-111111111134'
} as const

export const DREAMING_EVAL_OWNER_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const sourceLocalProfileId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'

/** D-N1/D-N2 摘录正文（不含 rottnest / quokka / island）。 */
export const DREAMING_ROTTNEST_SELECTED_TEXT =
  'The small marsupial was seen near the settlement at dusk, foraging quietly.' as const

const ROTTNEST_UPDATED_AT = '2026-07-10T08:00:00.000Z'
const BOOKMARK_UPDATED_AT = '2026-07-09T08:00:00.000Z'
const EXCLUDE_UPDATED_AT = '2026-07-08T08:00:00.000Z'
const DIRTY_UPDATED_AT = '2026-06-01T00:00:00.000Z'
const DIRTY_NOTE_SOURCE_UPDATED_AT = '2026-01-01T00:00:00.000Z'

/** 为工厂产物覆写稳定 ID 与时间戳。 */
function withStableIdentity(item: MemoryItem, id: string, updatedAt: string): MemoryItem {
  return {
    ...item,
    id,
    createdAt: updatedAt,
    updatedAt
  }
}

/**
 * 构造一条命题行（普通对象；id = owner\\0source\\0index）。
 * topicAnchor 默认 []。
 */
export function makeDreamingEvalNote(input: {
  sourceId: string
  index: number
  text: string
  sourceQuote: string
  sourceUpdatedAt: string
  sourceType: SupportedMemoryItemType
  topicAnchor?: string[]
}): MemoryNoteRecord {
  const createdAt = input.sourceUpdatedAt
  return {
    id: buildMemoryNoteId(DREAMING_EVAL_OWNER_ID, input.sourceId, input.index),
    ownerId: DREAMING_EVAL_OWNER_ID,
    sourceMemoryItemId: input.sourceId,
    sourceType: input.sourceType,
    text: input.text,
    sourceQuote: input.sourceQuote,
    topicAnchor: input.topicAnchor ? [...input.topicAnchor] : [],
    dreamRunId: 'dreaming-eval-run',
    version: 1,
    schemaVersion: DREAMING_SCHEMA_VERSION,
    sourceUpdatedAt: input.sourceUpdatedAt,
    createdAt,
    updatedAt: createdAt
  }
}

/** 从候选 + corpus 建 NoteMatchSet（eval 直构，不扫 IDB）。 */
export function noteMatchSetFromCandidates(
  candidates: readonly NoteMatchCandidate[],
  items: readonly MemoryItem[],
  contentTerms: readonly string[]
): NoteMatchSet {
  return buildNoteMatchSet(candidates, new Map(items.map(item => [item.id, item])), contentTerms)
}

/** D-N1 命题（双 exact term → 虚拟字段分 24）。 */
export function buildDreamingDn1Note(): MemoryNoteRecord {
  return makeDreamingEvalNote({
    sourceId: DREAMING_EVAL_IDS.dreamingRottnestExcerpt,
    index: 0,
    text: 'Quokka sightings on Rottnest Island are common at dusk.',
    sourceQuote: DREAMING_ROTTNEST_SELECTED_TEXT,
    sourceUpdatedAt: ROTTNEST_UPDATED_AT,
    sourceType: 'text_excerpt'
  })
}

/** D-N2 命题（单 bigram → 虚拟字段分 10）。 */
export function buildDreamingDn2Note(): MemoryNoteRecord {
  return makeDreamingEvalNote({
    sourceId: DREAMING_EVAL_IDS.dreamingRottnestExcerpt,
    index: 0,
    text: 'Rottnest Island quokkas gather near the settlement.',
    sourceQuote: DREAMING_ROTTNEST_SELECTED_TEXT,
    sourceUpdatedAt: ROTTNEST_UPDATED_AT,
    sourceType: 'text_excerpt'
  })
}

/** D-N3：同一源上 3 条命题（最优 = index 0，命中 2 词）。 */
export function buildDreamingDn3Notes(): MemoryNoteRecord[] {
  const sourceId = DREAMING_EVAL_IDS.dreamingRottnestBookmark
  const quote = 'Rottnest ferry timetable'
  return [
    makeDreamingEvalNote({
      sourceId,
      index: 0,
      text: 'Rottnest ferry departs from Fremantle every hour.',
      sourceQuote: quote,
      sourceUpdatedAt: BOOKMARK_UPDATED_AT,
      sourceType: 'bookmark'
    }),
    makeDreamingEvalNote({
      sourceId,
      index: 1,
      text: 'Ferry tickets can be booked online.',
      sourceQuote: quote,
      sourceUpdatedAt: BOOKMARK_UPDATED_AT,
      sourceType: 'bookmark'
    }),
    makeDreamingEvalNote({
      sourceId,
      index: 2,
      text: 'Quokka sightings near the ferry terminal.',
      sourceQuote: quote,
      sourceUpdatedAt: BOOKMARK_UPDATED_AT,
      sourceType: 'bookmark'
    })
  ]
}

/** D-N5 命题（源正文含 exclude 词 settlement）。 */
export function buildDreamingDn5Note(): MemoryNoteRecord {
  return makeDreamingEvalNote({
    sourceId: DREAMING_EVAL_IDS.dreamingExcludeExcerpt,
    index: 0,
    text: 'Quokka habitat survey results for the coastal settlement area.',
    sourceQuote: 'The quokka habitat survey near the settlement recorded twelve sightings.',
    sourceUpdatedAt: EXCLUDE_UPDATED_AT,
    sourceType: 'text_excerpt'
  })
}

/** D-N6(b) 脏命题：sourceUpdatedAt 早于源 updatedAt。 */
export function buildDreamingDn6DirtyNote(): MemoryNoteRecord {
  return makeDreamingEvalNote({
    sourceId: DREAMING_EVAL_IDS.dreamingDirtyExcerpt,
    index: 0,
    text: 'Aurora borealis may appear after midnight.',
    sourceQuote: 'The aurora forecast for tonight looks promising.',
    sourceUpdatedAt: DIRTY_NOTE_SOURCE_UPDATED_AT,
    sourceType: 'text_excerpt'
  })
}

/** D-N6(a) 孤儿命题：源 id 不在 corpus。 */
export function buildDreamingDn6OrphanNote(): MemoryNoteRecord {
  return makeDreamingEvalNote({
    sourceId: DREAMING_EVAL_IDS.dreamingDeletedExcerpt,
    index: 0,
    text: 'Aurora borealis may appear after midnight.',
    sourceQuote: 'The aurora forecast for tonight looks promising.',
    sourceUpdatedAt: DIRTY_UPDATED_AT,
    sourceType: 'text_excerpt'
  })
}

/**
 * Dreaming must 库。
 * D-N1/D-N2 的 pageTitle/URL 故意不含线索词：否则 url/pageTitle 抬分，破坏 score===24 / sole 形态。
 * selectedText / 命题 / clue 字面仍按设计稿。
 */
export function buildDreamingEvalCorpus(): MemoryItem[] {
  const rottnestEmbedding = makeFakeEmbedding('rottnest quokka wildlife', HYBRID_FAKE_EMBEDDING_DIM)

  return [
    withStableIdentity(
      createTextExcerptMemoryItem({
        ownerId: DREAMING_EVAL_OWNER_ID,
        sourceLocalProfileId,
        payload: {
          selectedText: DREAMING_ROTTNEST_SELECTED_TEXT,
          // 索引字段不含 rottnest/quokka/island，保证命题独占字面命中
          sourceUrl: 'https://example.com/wildlife-notes',
          pageTitle: 'Wildlife field notes',
          domain: 'example.com'
        },
        clues: {
          embedding: rottnestEmbedding,
          embeddingModel: '@cf/baai/bge-m3',
          embeddingDim: HYBRID_FAKE_EMBEDDING_DIM
        },
        now: () => ROTTNEST_UPDATED_AT
      }),
      DREAMING_EVAL_IDS.dreamingRottnestExcerpt,
      ROTTNEST_UPDATED_AT
    ),
    withStableIdentity(
      createBookmarkMemoryItem({
        ownerId: DREAMING_EVAL_OWNER_ID,
        sourceLocalProfileId,
        payload: {
          title: 'Rottnest ferry timetable',
          url: 'https://rottnest.example.com/ferry'
        },
        now: () => BOOKMARK_UPDATED_AT
      }),
      DREAMING_EVAL_IDS.dreamingRottnestBookmark,
      BOOKMARK_UPDATED_AT
    ),
    withStableIdentity(
      createBookmarkMemoryItem({
        ownerId: DREAMING_EVAL_OWNER_ID,
        sourceLocalProfileId,
        payload: {
          title: 'Rottnest ferry timetable',
          url: 'https://rottnest.example.com/ferry'
        },
        now: () => BOOKMARK_UPDATED_AT
      }),
      DREAMING_EVAL_IDS.dreamingRottnestBookmarkDup,
      BOOKMARK_UPDATED_AT
    ),
    withStableIdentity(
      createTextExcerptMemoryItem({
        ownerId: DREAMING_EVAL_OWNER_ID,
        sourceLocalProfileId,
        payload: {
          selectedText: 'The quokka habitat survey near the settlement recorded twelve sightings.',
          sourceUrl: 'https://example.com/habitat-survey',
          pageTitle: 'Habitat survey',
          domain: 'example.com'
        },
        now: () => EXCLUDE_UPDATED_AT
      }),
      DREAMING_EVAL_IDS.dreamingExcludeExcerpt,
      EXCLUDE_UPDATED_AT
    ),
    withStableIdentity(
      createTextExcerptMemoryItem({
        ownerId: DREAMING_EVAL_OWNER_ID,
        sourceLocalProfileId,
        payload: {
          selectedText: 'The aurora forecast for tonight looks promising.',
          sourceUrl: 'https://example.com/aurora-forecast',
          pageTitle: 'Aurora forecast',
          domain: 'example.com'
        },
        now: () => DIRTY_UPDATED_AT
      }),
      DREAMING_EVAL_IDS.dreamingDirtyExcerpt,
      DIRTY_UPDATED_AT
    )
  ]
}

/** D-N1 用例对应的 noteMatches（双 term）。 */
export function buildDreamingDn1NoteMatches(
  corpus: MemoryItem[] = buildDreamingEvalCorpus()
): NoteMatchSet {
  const note = buildDreamingDn1Note()
  return noteMatchSetFromCandidates([{ note, matchedTerms: ['rottnest', 'quokka'] }], corpus, [
    'rottnest',
    'quokka'
  ])
}

/** D-N2：单 bigram。 */
export function buildDreamingDn2NoteMatches(
  corpus: MemoryItem[] = buildDreamingEvalCorpus()
): NoteMatchSet {
  const note = buildDreamingDn2Note()
  return noteMatchSetFromCandidates([{ note, matchedTerms: ['rottnest island'] }], corpus, [
    'rottnest island'
  ])
}

/** D-N3：3 条候选，集内每源最优 1 条。 */
export function buildDreamingDn3NoteMatches(
  corpus: MemoryItem[] = buildDreamingEvalCorpus()
): NoteMatchSet {
  const notes = buildDreamingDn3Notes()
  const candidates: NoteMatchCandidate[] = [
    { note: notes[0]!, matchedTerms: ['rottnest', 'ferry'] },
    { note: notes[1]!, matchedTerms: ['ferry'] },
    { note: notes[2]!, matchedTerms: ['ferry'] }
  ]
  return noteMatchSetFromCandidates(candidates, corpus, ['rottnest', 'ferry'])
}

/** D-N5：exclude 仍硬切。 */
export function buildDreamingDn5NoteMatches(
  corpus: MemoryItem[] = buildDreamingEvalCorpus()
): NoteMatchSet {
  const note = buildDreamingDn5Note()
  return noteMatchSetFromCandidates([{ note, matchedTerms: ['quokka', 'habitat'] }], corpus, [
    'quokka',
    'habitat'
  ])
}

// —— Stage 3 离线评估 corpus（与 must 库独立词面；id 自 …140 起）——

/** 离线评估源条目 id（20 组）。 */
export const DREAMING_OFFLINE_EVAL_IDS = {
  a01: '11111111-1111-4111-8111-111111111140',
  a02: '11111111-1111-4111-8111-111111111141',
  a03: '11111111-1111-4111-8111-111111111142',
  a04: '11111111-1111-4111-8111-111111111143',
  a05: '11111111-1111-4111-8111-111111111144',
  b01: '11111111-1111-4111-8111-111111111145',
  b02: '11111111-1111-4111-8111-111111111146',
  b03: '11111111-1111-4111-8111-111111111147',
  b04: '11111111-1111-4111-8111-111111111148',
  b05: '11111111-1111-4111-8111-111111111149',
  c01: '11111111-1111-4111-8111-111111111150',
  c02: '11111111-1111-4111-8111-111111111151',
  c03: '11111111-1111-4111-8111-111111111152',
  c04: '11111111-1111-4111-8111-111111111153',
  c05: '11111111-1111-4111-8111-111111111154',
  d01: '11111111-1111-4111-8111-111111111155',
  d02: '11111111-1111-4111-8111-111111111156',
  d03: '11111111-1111-4111-8111-111111111157',
  d04: '11111111-1111-4111-8111-111111111158',
  d05: '11111111-1111-4111-8111-111111111159',
  /** 仅被孤儿命题引用、不在 corpus 内 */
  orphanGhost: '11111111-1111-4111-8111-111111111160'
} as const

const OFFLINE_UPDATED_AT = '2026-08-01T12:00:00.000Z'
const OFFLINE_DIRTY_NOTE_AT = '2026-01-01T00:00:00.000Z'

export type DreamingOfflineGroupSpec = {
  id: string
  sourceId: string
  selectedText: string
  pageTitle: string
  sourceUrl: string
  /** 源不进 corpus（孤儿组） */
  omitFromCorpus?: boolean
}

/**
 * 离线评估库：20 个源（d 类孤儿源省略）。
 * 词面互不重叠，避免交叉干扰。
 */
export function buildDreamingOfflineEvalCorpus(
  groups: readonly DreamingOfflineGroupSpec[]
): MemoryItem[] {
  return groups
    .filter(group => !group.omitFromCorpus)
    .map(group =>
      withStableIdentity(
        createTextExcerptMemoryItem({
          ownerId: DREAMING_EVAL_OWNER_ID,
          sourceLocalProfileId,
          payload: {
            selectedText: group.selectedText,
            sourceUrl: group.sourceUrl,
            pageTitle: group.pageTitle,
            domain: 'example.com'
          },
          now: () => OFFLINE_UPDATED_AT
        }),
        group.sourceId,
        OFFLINE_UPDATED_AT
      )
    )
}

export { OFFLINE_UPDATED_AT, OFFLINE_DIRTY_NOTE_AT }
