/**
 * Phase 4.1：语义命题匹配（rule 0b）+ 字面优先 + 双重门控。
 */

import { describe, expect, it, vi } from 'vitest'

import {
  buildDreamingDn1Note,
  buildDreamingEvalCorpus,
  DREAMING_EVAL_IDS,
  DREAMING_EVAL_OWNER_ID,
  makeDreamingEvalNote
} from '../../../tests/eval/dreaming-eval-corpus'
import { findNoteMatchesForQuery } from '@/core/recall/note-match'
import {
  filterMemoryItemsByKeyword,
  scoreNoteSemanticVirtualField
} from '@/core/recall/keyword-filter'
import { makeFakeEmbedding } from '../../../tests/eval/hybrid-fake-embedding'
import type { NoteMatchSet } from '@/core/recall/note-match'
import { logger } from '@/infrastructure/logging/logger'

describe('note-match semantic · Phase 4.1', () => {
  const note = buildDreamingDn1Note()
  // 与命题文本同 anchor → fake embedding 余弦 ≈ 1
  const noteVec = makeFakeEmbedding(note.text, 32)
  const queryNear = makeFakeEmbedding(note.text, 32)
  const queryFar = makeFakeEmbedding('completely unrelated kayak mangrove noise', 32)

  it('rule 0b：高于阈值命中', async () => {
    const candidates = await findNoteMatchesForQuery({
      ownerId: DREAMING_EVAL_OWNER_ID,
      contentTerms: ['cheap', 'stay', 'beach'],
      scan: async () => [note],
      queryVector: queryNear,
      semanticEnabled: true,
      semanticMinSimilarity: 0.5,
      loadEmbeddings: async () => new Map([[note.id, noteVec]])
    })
    expect(candidates).toHaveLength(1)
    expect(candidates[0]!.matchKind).toBe('semantic')
    expect(candidates[0]!.matchedTerms).toEqual([])
    expect(candidates[0]!.semanticScore).toBeGreaterThanOrEqual(0.5)
  })

  it('rule 0b：低于阈值不命中', async () => {
    const candidates = await findNoteMatchesForQuery({
      ownerId: DREAMING_EVAL_OWNER_ID,
      contentTerms: ['cheap', 'stay', 'beach'],
      scan: async () => [note],
      queryVector: queryFar,
      semanticEnabled: true,
      semanticMinSimilarity: 0.5,
      loadEmbeddings: async () => new Map([[note.id, noteVec]])
    })
    expect(candidates).toEqual([])
  })

  it('字面优先于语义', async () => {
    const literalNote = makeDreamingEvalNote({
      sourceId: DREAMING_EVAL_IDS.dreamingRottnestExcerpt,
      index: 0,
      text: 'Quokka on Rottnest Island.',
      sourceQuote: 'marsupial',
      sourceUpdatedAt: note.sourceUpdatedAt,
      sourceType: 'text_excerpt'
    })
    const semanticOnly = makeDreamingEvalNote({
      sourceId: DREAMING_EVAL_IDS.dreamingRottnestExcerpt,
      index: 1,
      text: 'Small marsupial near dusk settlement.',
      sourceQuote: 'marsupial',
      sourceUpdatedAt: note.sourceUpdatedAt,
      sourceType: 'text_excerpt'
    })
    const semVec = makeFakeEmbedding(semanticOnly.text, 32)
    const candidates = await findNoteMatchesForQuery({
      ownerId: DREAMING_EVAL_OWNER_ID,
      contentTerms: ['rottnest'],
      scan: async () => [literalNote, semanticOnly],
      queryVector: makeFakeEmbedding(semanticOnly.text, 32),
      semanticEnabled: true,
      semanticMinSimilarity: 0.5,
      loadEmbeddings: async () =>
        new Map([
          [literalNote.id, makeFakeEmbedding('unrelated', 32)],
          [semanticOnly.id, semVec]
        ])
    })
    expect(candidates).toHaveLength(1)
    expect(candidates[0]!.matchKind).toBe('literal')
    expect(candidates[0]!.note.id).toBe(literalNote.id)
  })

  it('语义子开关 OFF 时无语义匹配', async () => {
    const candidates = await findNoteMatchesForQuery({
      ownerId: DREAMING_EVAL_OWNER_ID,
      contentTerms: ['cheap', 'stay'],
      scan: async () => [note],
      queryVector: queryNear,
      semanticEnabled: false,
      semanticMinSimilarity: 0.5,
      loadEmbeddings: async () => new Map([[note.id, noteVec]])
    })
    expect(candidates).toEqual([])
  })

  it('无向量命题静默跳过语义匹配', async () => {
    const candidates = await findNoteMatchesForQuery({
      ownerId: DREAMING_EVAL_OWNER_ID,
      contentTerms: ['cheap', 'stay'],
      scan: async () => [note],
      queryVector: queryNear,
      semanticEnabled: true,
      semanticMinSimilarity: 0.5,
      loadEmbeddings: async () => new Map()
    })
    expect(candidates).toEqual([])
  })

  it('语义评分 12×similarity 且上限 12', () => {
    expect(scoreNoteSemanticVirtualField(0.5)).toBeCloseTo(6)
    expect(scoreNoteSemanticVirtualField(1)).toBe(12)
    expect(scoreNoteSemanticVirtualField(1.5)).toBe(12)
    expect(scoreNoteSemanticVirtualField(0)).toBe(0)
  })

  it('语义评分不触发 exactTokenHit fallback warn', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    scoreNoteSemanticVirtualField(0.72)
    expect(warnSpy).not.toHaveBeenCalled()
    warnSpy.mockRestore()
  })

  it('接线级：filterMemoryItemsByKeyword 语义 provenance 走 12×sim 且不 warn', () => {
    const corpus = buildDreamingEvalCorpus()
    const item = corpus.find(row => row.id === DREAMING_EVAL_IDS.dreamingRottnestExcerpt)!
    const similarity = 0.75
    const noteMatches: NoteMatchSet = new Map([
      [
        item.id,
        {
          noteId: note.id,
          sourceMemoryItemId: item.id,
          matchedTerms: [],
          soleCorroboration: true,
          propositionText: note.text,
          topicAnchor: [...note.topicAnchor],
          propositionIndex: 0,
          matchKind: 'semantic',
          semanticScore: similarity
        }
      ]
    ])

    const warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {})
    // 线索无字面命中源正文 → base≈0；得分应纯来自语义虚拟字段
    const matches = filterMemoryItemsByKeyword([item], 'mangrove kayak unrelated', {
      noteMatches,
      minScore: 0
    })
    expect(matches).toHaveLength(1)
    expect(matches[0]!.noteProvenance?.matchKind).toBe('semantic')
    expect(matches[0]!.score).toBeCloseTo(12 * similarity)
    expect(matches[0]!.score).toBeLessThanOrEqual(12)
    expect(warnSpy).not.toHaveBeenCalled()
    warnSpy.mockRestore()
  })
})
