/**
 * Dreaming Phase 4 · D-N1–D-N6 must（命题命中进 Recall）。
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  buildDreamingDn1NoteMatches,
  buildDreamingDn2NoteMatches,
  buildDreamingDn3NoteMatches,
  buildDreamingDn5NoteMatches,
  buildDreamingDn6DirtyNote,
  buildDreamingDn6OrphanNote,
  buildDreamingEvalCorpus,
  DREAMING_EVAL_IDS,
  noteMatchSetFromCandidates
} from '@/core/recall/eval/dreaming-eval-corpus'
import { DREAMING_NOTE_EVAL_CASES } from '@/core/recall/eval/dreaming-eval-cases'
import {
  HYBRID_FAKE_EMBEDDING_DIM,
  makeFakeEmbedding
} from '@/core/recall/eval/hybrid-fake-embedding'
import { RECALL_EVAL_NOW_MS } from '@/core/recall/eval/recall-eval-now'
import { parseDialogTurnsToMerged, runRecallEval } from '@/core/recall/eval/run-recall-eval'
import {
  buildFilterClueFromParsed,
  recallByKeywordWithParsedClue
} from '@/core/recall/orchestrate-keyword-recall'

const { requestWorkerEmbeddingsMock, listForKeywordRecallMock, understandRecallClueMock } =
  vi.hoisted(() => ({
    requestWorkerEmbeddingsMock: vi.fn(),
    listForKeywordRecallMock: vi.fn(),
    understandRecallClueMock: vi.fn()
  }))

vi.mock('@/infrastructure/ai/embed-api-client', () => ({
  WORKER_EMBEDDING_MODEL: '@cf/baai/bge-m3',
  requestWorkerEmbeddings: requestWorkerEmbeddingsMock
}))

vi.mock('@/infrastructure/identity/auth-session-service', () => ({
  getAuthSession: vi.fn(async () => ({
    accessToken: 'dreaming-eval-token',
    ownerId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    email: 'eval@yiveno.local',
    provider: 'clerk'
  })),
  setAuthSession: vi.fn(async () => {}),
  clearAuthSession: vi.fn(async () => {})
}))

vi.mock('@/infrastructure/storage/recall-outcome-pairs-storage', () => ({
  listRecallOutcomePairs: vi.fn(async () => [])
}))

vi.mock('@/application/memory/memory-item-service', () => ({
  memoryItemService: {
    list: vi.fn(async () => []),
    listForKeywordRecall: listForKeywordRecallMock
  }
}))

vi.mock('@/core/recall/understand/understand-recall-clue', () => ({
  understandRecallClue: understandRecallClueMock
}))

vi.mock('@/application/recall/clue-llm-completer-registry', () => ({
  getClueLlmCompleter: vi.fn(() => undefined)
}))

vi.mock('@/infrastructure/browser/browser-online', async importOriginal => {
  const actual = await importOriginal<typeof import('@/infrastructure/browser/browser-online')>()
  return {
    ...actual,
    readBrowserOnline: vi.fn(() => true)
  }
})

vi.mock('@/application/recall/apply-recall-context', () => ({
  applyPageContextToMatches: vi.fn((matches: unknown[]) => matches),
  applyStoredOutcomePairsToMatches: vi.fn(async (matches: unknown[]) => matches)
}))

import {
  fuseHybridMatches,
  HybridRecallBackend
} from '@/application/recall/backends/hybrid-recall-backend'

describe('dreaming-note-recall · D-N1–D-N6', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    requestWorkerEmbeddingsMock.mockImplementation(async (_token: string, texts: string[]) => ({
      model: '@cf/baai/bge-m3',
      dim: HYBRID_FAKE_EMBEDDING_DIM,
      embeddings: texts.map(text => makeFakeEmbedding(text, HYBRID_FAKE_EMBEDDING_DIM))
    }))
  })

  it('D-N1 命题命中进 Top1（score 24）+ Hybrid 同 top1', async () => {
    // 仅保留 D-N1 源摘录：全库含 ferry 书签时 title 字面「Rottnest」会抢走 Top1。
    const fullCorpus = buildDreamingEvalCorpus()
    const corpus = fullCorpus.filter(item => item.id === DREAMING_EVAL_IDS.dreamingRottnestExcerpt)
    const noteMatches = buildDreamingDn1NoteMatches(corpus)
    const dn1Case = DREAMING_NOTE_EVAL_CASES.find(item => item.id === 'dreaming-dn1-note-top1')
    expect(dn1Case).toBeTruthy()

    const report = runRecallEval([dn1Case!], corpus, {
      noteMatchesByCase: new Map([[dn1Case!.id, noteMatches]])
    })
    expect(report.must.failed).toEqual([])
    const top = report.cases[0]?.result.topPick
    expect(top?.item.id).toBe(DREAMING_EVAL_IDS.dreamingRottnestExcerpt)
    expect(top?.score).toBe(24)
    expect(top?.matchedFields).toContain('memory_note')
    expect(top?.noteProvenance?.soleCorroboration).toBe(true)

    const { merged } = parseDialogTurnsToMerged(['rottnest quokka'], RECALL_EVAL_NOW_MS)
    const filterClue = buildFilterClueFromParsed(merged)
    const fused = await fuseHybridMatches({
      displayClue: 'rottnest quokka',
      pairClue: 'rottnest quokka',
      items: corpus,
      filterClue,
      parsed: merged,
      clueEmbeddingText: 'rottnest quokka wildlife',
      noteMatches,
      trace: () => {}
    })
    expect(fused).not.toBeNull()
    expect(fused!.result.topPick?.item.id).toBe(DREAMING_EVAL_IDS.dreamingRottnestExcerpt)
  })

  it('D-N2 单 bigram 命题命中不独占 Top Pick（score 10 → need_a_clue）', () => {
    const fullCorpus = buildDreamingEvalCorpus()
    const corpus = fullCorpus.filter(item => item.id === DREAMING_EVAL_IDS.dreamingRottnestExcerpt)
    const noteMatches = buildDreamingDn2NoteMatches(corpus)
    const { merged } = parseDialogTurnsToMerged(['rottnest island'], RECALL_EVAL_NOW_MS)
    const parsed = { ...merged, contentTerms: ['rottnest island'] }

    const result = recallByKeywordWithParsedClue(corpus, 'rottnest island', {
      nowMs: RECALL_EVAL_NOW_MS,
      parsed,
      noteMatches
    })

    expect(result.outcome).toBe('need_a_clue')
    expect(result.topPick).toBeNull()
    const hit = result.alsoPossible.find(
      match => match.item.id === DREAMING_EVAL_IDS.dreamingRottnestExcerpt
    )
    expect(hit).toBeTruthy()
    expect(hit!.score).toBe(10)
    expect(result.alsoPossible.slice(0, 3).some(m => m.item.id === hit!.item.id)).toBe(true)
  })

  it('D-N3 命题命中不 double-count（折叠 1 组 + 最优出处）', () => {
    const corpus = buildDreamingEvalCorpus()
    const noteMatches = buildDreamingDn3NoteMatches(corpus)
    const dn3Case = DREAMING_NOTE_EVAL_CASES.find(
      item => item.id === 'dreaming-dn3-no-double-count'
    )
    expect(dn3Case).toBeTruthy()

    const report = runRecallEval([dn3Case!], corpus, {
      noteMatchesByCase: new Map([[dn3Case!.id, noteMatches]])
    })
    expect(report.must.failed).toEqual([])
    const result = report.cases[0]!.result
    expect(result.topPick?.item.id).toBe(DREAMING_EVAL_IDS.dreamingRottnestBookmark)
    expect(result.totalRankedCount).toBe(1)
    expect(result.alsoPossible.map(match => match.item.id)).not.toContain(
      DREAMING_EVAL_IDS.dreamingRottnestBookmark
    )
    expect(result.alsoPossible.map(match => match.item.id)).not.toContain(
      DREAMING_EVAL_IDS.dreamingRottnestBookmarkDup
    )
    expect(result.topPick?.duplicateGroup?.totalCount).toBe(2)
    expect(result.topPick?.noteProvenance?.matchedTerms).toEqual(['rottnest', 'ferry'])
    expect(result.topPick?.noteProvenance?.propositionIndex).toBe(0)
  })

  it('D-N4 命题命中不绕过 Topic 门（missing_topic 且未 list）', async () => {
    const clue = 'A word that was learned before'
    const { merged } = parseDialogTurnsToMerged([clue], RECALL_EVAL_NOW_MS)
    understandRecallClueMock.mockResolvedValue({
      disposition: 'proceed',
      rejectReason: null,
      mode: 'lexical',
      source: 'rules',
      clueTruncated: false,
      parsed: merged,
      filterClue: merged.contentTerms.join(' ')
    })
    listForKeywordRecallMock.mockResolvedValue({ items: [], source: 'scan' as const })

    const backend = new HybridRecallBackend()
    const result = await backend.recallWithClue(clue, { entry: 'sidepanel' })

    expect(result.outcome).toBe('no_match')
    expect(result.emptyKind).toBe('missing_topic')
    expect(listForKeywordRecallMock).not.toHaveBeenCalled()
  })

  it('D-N5 exclude 仍硬切', () => {
    const corpus = buildDreamingEvalCorpus()
    const noteMatches = buildDreamingDn5NoteMatches(corpus)
    const { merged } = parseDialogTurnsToMerged(['quokka habitat'], RECALL_EVAL_NOW_MS)
    const parsed = {
      ...merged,
      contentTerms: ['quokka', 'habitat'],
      excludeContentTerms: ['settlement']
    }

    const result = recallByKeywordWithParsedClue(corpus, 'quokka habitat', {
      nowMs: RECALL_EVAL_NOW_MS,
      parsed,
      noteMatches
    })

    const ids = [
      ...(result.topPick ? [result.topPick.item.id] : []),
      ...result.alsoPossible.map(match => match.item.id)
    ]
    expect(ids).not.toContain(DREAMING_EVAL_IDS.dreamingExcludeExcerpt)
  })

  it('D-N6 脏命题 / 孤儿命题不参与', () => {
    const corpus = buildDreamingEvalCorpus()
    const { merged } = parseDialogTurnsToMerged(['aurora borealis'], RECALL_EVAL_NOW_MS)
    // 单 bigram：源摘录含 aurora 但不含「aurora borealis」整词面；命题含 bigram。
    // 脏/孤儿被滤掉后，不得靠命题锚进池（亦无字面 bigram 命中）。
    const terms = ['aurora borealis'] as const
    const parsed = { ...merged, contentTerms: [...terms] }

    // (a) 孤儿：源不在 itemsById
    const orphanSet = noteMatchSetFromCandidates(
      [{ note: buildDreamingDn6OrphanNote(), matchedTerms: [...terms] }],
      corpus,
      terms
    )
    expect(orphanSet.has(DREAMING_EVAL_IDS.dreamingDeletedExcerpt)).toBe(false)
    const orphanResult = recallByKeywordWithParsedClue(corpus, 'aurora borealis', {
      nowMs: RECALL_EVAL_NOW_MS,
      parsed,
      noteMatches: orphanSet
    })
    const orphanIds = [
      ...(orphanResult.topPick ? [orphanResult.topPick.item.id] : []),
      ...orphanResult.alsoPossible.map(match => match.item.id)
    ]
    expect(orphanIds).not.toContain(DREAMING_EVAL_IDS.dreamingDeletedExcerpt)

    // (b) 脏：sourceUpdatedAt < 源 updatedAt
    const dirtySet = noteMatchSetFromCandidates(
      [{ note: buildDreamingDn6DirtyNote(), matchedTerms: [...terms] }],
      corpus,
      terms
    )
    expect(dirtySet.has(DREAMING_EVAL_IDS.dreamingDirtyExcerpt)).toBe(false)
    const dirtyResult = recallByKeywordWithParsedClue(corpus, 'aurora borealis', {
      nowMs: RECALL_EVAL_NOW_MS,
      parsed,
      noteMatches: dirtySet
    })
    const dirtyIds = [
      ...(dirtyResult.topPick ? [dirtyResult.topPick.item.id] : []),
      ...dirtyResult.alsoPossible.map(match => match.item.id)
    ]
    expect(dirtyIds).not.toContain(DREAMING_EVAL_IDS.dreamingDirtyExcerpt)
  })
})
