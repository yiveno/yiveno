/**
 * Dreaming Phase 4 · 命题命中集 / 虚拟字段分单元测。
 */

import { describe, expect, it, vi } from 'vitest'

import {
  buildDreamingDn1Note,
  buildDreamingDn2Note,
  buildDreamingDn3Notes,
  buildDreamingDn6DirtyNote,
  buildDreamingEvalCorpus,
  DREAMING_EVAL_IDS,
  DREAMING_EVAL_OWNER_ID,
  makeDreamingEvalNote
} from '@/core/recall/eval/dreaming-eval-corpus'
import {
  buildNoteVirtualFieldText,
  classifyMatchedTermKind,
  scoreNoteVirtualField
} from '@/core/recall/keyword-filter'
import { buildNoteMatchSet, findNoteMatchesForQuery } from '@/core/recall/note-match'
import type { MemoryItem } from '@/core/memory/memory-item'

const buildSet = buildNoteMatchSet
const findMatches = findNoteMatchesForQuery

describe('note-match', () => {
  const corpus = buildDreamingEvalCorpus()
  const rottnest = corpus.find(item => item.id === DREAMING_EVAL_IDS.dreamingRottnestExcerpt)!
  const itemsById = new Map(corpus.map(item => [item.id, item]))

  it('第 0 条：命题 text 字面命中', async () => {
    const note = buildDreamingDn1Note()
    const candidates = await findMatches({
      ownerId: DREAMING_EVAL_OWNER_ID,
      contentTerms: ['rottnest', 'quokka'],
      scan: async () => [note]
    })
    expect(candidates).toHaveLength(1)
    expect(candidates[0]!.matchedTerms.sort()).toEqual(['quokka', 'rottnest'])
  })

  it('第 0 条：topicAnchor 字面命中', async () => {
    const anchored = makeDreamingEvalNote({
      sourceId: DREAMING_EVAL_IDS.dreamingRottnestExcerpt,
      index: 0,
      text: 'Small marsupial near dusk.',
      sourceQuote: 'The small marsupial was seen near the settlement at dusk, foraging quietly.',
      sourceUpdatedAt: rottnest.updatedAt,
      sourceType: 'text_excerpt',
      topicAnchor: ['rottnest', 'quokka']
    })
    const candidates = await findMatches({
      ownerId: DREAMING_EVAL_OWNER_ID,
      contentTerms: ['rottnest', 'quokka'],
      scan: async () => [anchored]
    })
    expect(candidates).toHaveLength(1)
    expect(candidates[0]!.matchedTerms.sort()).toEqual(['quokka', 'rottnest'])
  })

  it('零词面重叠 → 不构成命题命中', async () => {
    const note = buildDreamingDn1Note()
    const candidates = await findMatches({
      ownerId: DREAMING_EVAL_OWNER_ID,
      contentTerms: ['mangrove', 'kayak'],
      scan: async () => [note]
    })
    expect(candidates).toEqual([])
  })

  it('soleCorroboration 为 true（源无字面佐证）', () => {
    const note = buildDreamingDn1Note()
    const set = buildSet([{ note, matchedTerms: ['rottnest', 'quokka'] }], itemsById, [
      'rottnest',
      'quokka'
    ])
    expect(set.get(DREAMING_EVAL_IDS.dreamingRottnestExcerpt)?.soleCorroboration).toBe(true)
  })

  it('soleCorroboration 为 false（源有字面佐证）', () => {
    const bookmark = corpus.find(item => item.id === DREAMING_EVAL_IDS.dreamingRottnestBookmark)!
    const notes = buildDreamingDn3Notes()
    const set = buildSet(
      [{ note: notes[0]!, matchedTerms: ['rottnest', 'ferry'] }],
      new Map([[bookmark.id, bookmark]]),
      ['rottnest', 'ferry']
    )
    expect(set.get(bookmark.id)?.soleCorroboration).toBe(false)
  })

  it('最优命题决胜（匹配词数最多；并列取 propositionIndex 最小）', () => {
    const notes = buildDreamingDn3Notes()
    const bookmark = corpus.find(item => item.id === DREAMING_EVAL_IDS.dreamingRottnestBookmark)!
    const set = buildSet(
      [
        { note: notes[1]!, matchedTerms: ['ferry'] },
        { note: notes[0]!, matchedTerms: ['rottnest', 'ferry'] },
        { note: notes[2]!, matchedTerms: ['ferry'] }
      ],
      new Map([[bookmark.id, bookmark]]),
      ['rottnest', 'ferry']
    )
    expect(set.get(bookmark.id)?.propositionIndex).toBe(0)
    expect(set.get(bookmark.id)?.matchedTerms).toEqual(['rottnest', 'ferry'])
  })

  it('同一源 3 条命题 → 集里只有 1 条出处', () => {
    const notes = buildDreamingDn3Notes()
    const bookmark = corpus.find(item => item.id === DREAMING_EVAL_IDS.dreamingRottnestBookmark)!
    const set = buildSet(
      [
        { note: notes[0]!, matchedTerms: ['rottnest', 'ferry'] },
        { note: notes[1]!, matchedTerms: ['ferry'] },
        { note: notes[2]!, matchedTerms: ['ferry'] }
      ],
      new Map([[bookmark.id, bookmark]]),
      ['rottnest', 'ferry']
    )
    expect(set.size).toBe(1)
  })

  it('脏命题不参与（源 updatedAt > 命题 sourceUpdatedAt）', () => {
    const dirty = corpus.find(item => item.id === DREAMING_EVAL_IDS.dreamingDirtyExcerpt)!
    const set = buildSet(
      [{ note: buildDreamingDn6DirtyNote(), matchedTerms: ['aurora', 'borealis'] }],
      new Map([[dirty.id, dirty]]),
      ['aurora', 'borealis']
    )
    expect(set.size).toBe(0)
  })

  it('源不在池内 / 已软删 → 不参与', () => {
    const note = buildDreamingDn1Note()
    const emptyPool = buildSet([{ note, matchedTerms: ['rottnest', 'quokka'] }], new Map(), [
      'rottnest',
      'quokka'
    ])
    expect(emptyPool.size).toBe(0)

    const deleted: MemoryItem = { ...rottnest, deletedAt: '2026-07-20T00:00:00.000Z' }
    const deletedPool = buildSet(
      [{ note, matchedTerms: ['rottnest', 'quokka'] }],
      new Map([[deleted.id, deleted]]),
      ['rottnest', 'quokka']
    )
    expect(deletedPool.size).toBe(0)
  })

  it('findNoteMatchesForQuery fail-open（scan 抛错 → 空数组）', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const candidates = await findMatches({
      ownerId: DREAMING_EVAL_OWNER_ID,
      contentTerms: ['rottnest'],
      scan: async () => {
        throw new Error('injected scan failure')
      }
    })
    expect(candidates).toEqual([])
    warnSpy.mockRestore()
  })

  it('虚拟字段分：单 bigram → 10', () => {
    const note = buildDreamingDn2Note()
    const virtualText = buildNoteVirtualFieldText({
      propositionText: note.text,
      topicAnchor: note.topicAnchor
    })
    expect(scoreNoteVirtualField(virtualText, ['rottnest island'])).toBe(10)
  })

  it('虚拟字段分：双 exact term → 24', () => {
    const note = buildDreamingDn1Note()
    const virtualText = buildNoteVirtualFieldText({
      propositionText: note.text,
      topicAnchor: note.topicAnchor
    })
    expect(scoreNoteVirtualField(virtualText, ['rottnest', 'quokka'])).toBe(24)
  })
})

describe('classifyMatchedTermKind 契约', () => {
  it('空串兜底 → term', () => {
    expect(classifyMatchedTermKind('')).toBe('term')
  })

  it('含空白多词 → ngram（永不 phrase）', () => {
    expect(classifyMatchedTermKind('rottnest island')).toBe('ngram')
  })

  it('单词 → term', () => {
    expect(classifyMatchedTermKind('rottnest')).toBe('term')
  })
})
