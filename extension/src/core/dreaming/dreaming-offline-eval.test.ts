/**
 * Dreaming Phase 4 Stage 3 · 离线评估（6 个 it；不进 test:must）。
 * 每项跑 ON（注入 NoteMatchSet）与 OFF（不注入）对照。
 */

import 'fake-indexeddb/auto'

import { describe, expect, it, vi } from 'vitest'

import { LOCAL_PROFILE_STORAGE_KEY, type LocalProfile } from '@/core/identity/local-profile'
import {
  DREAMING_EVAL_OWNER_ID,
  buildDreamingOfflineEvalCorpus,
  noteMatchSetFromCandidates
} from '@/core/recall/eval/dreaming-eval-corpus'
import {
  DREAMING_OFFLINE_EVAL_BLUEPRINTS,
  dreamingOfflineBlueprintsToCases,
  listDreamingOfflineEvalGroups,
  listDreamingOfflineEvalNotes
} from '@/core/recall/eval/dreaming-offline-eval-cases'
import { RECALL_EVAL_NOW_MS } from '@/core/recall/eval/recall-eval-now'
import { judgeRecallEvalCase } from '@/core/recall/eval/run-recall-eval'
import { findNoteMatchesForQuery } from '@/core/recall/note-match'
import { recallByKeywordWithParsedClue } from '@/core/recall/orchestrate-keyword-recall'
import type { RecallResult } from '@/core/recall/recall-result'
import { hasMemoryNoteSourceCitation } from '@/infrastructure/indexeddb/memory-notes-types'
import { resetMemoryDatabaseInitializationForTests } from '@/infrastructure/indexeddb/memory-db'
import { memoryNotesRepository } from '@/infrastructure/indexeddb/memory-notes-repository'

type StorageMap = Record<string, unknown>

function createChromeStorageMock(initial: StorageMap = {}) {
  const store: StorageMap = { ...initial }
  return {
    storage: {
      local: {
        get: vi.fn(async (keys: string | string[] | Record<string, unknown>) => {
          if (typeof keys === 'string') {
            return { [keys]: store[keys] }
          }
          if (Array.isArray(keys)) {
            return Object.fromEntries(keys.map(key => [key, store[key]]))
          }
          return { ...store, ...keys }
        }),
        set: vi.fn(async (items: StorageMap) => {
          Object.assign(store, items)
        }),
        remove: vi.fn(async (keys: string | string[]) => {
          for (const key of Array.isArray(keys) ? keys : [keys]) {
            delete store[key]
          }
        })
      }
    }
  }
}

const localProfile: LocalProfile = {
  localProfileId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  createdAt: '2026-07-22T05:00:00.000Z',
  schemaVersion: 1
}

const corpus = buildDreamingOfflineEvalCorpus(listDreamingOfflineEvalGroups())

function runOfflinePass(mode: 'on' | 'off'): {
  results: Array<{
    id: string
    category: string
    passed: boolean
    result: RecallResult
  }>
  top1HitRate: number
  inTop3Rate: number
  inTop5Rate: number
  noMatchRate: number
  emptyKindCounts: Record<string, number>
  soleCorroborationAmongNoteTop1: number
  noteTop1Count: number
} {
  const cases = dreamingOfflineBlueprintsToCases(mode)
  const results = DREAMING_OFFLINE_EVAL_BLUEPRINTS.map((bp, index) => {
    const evalCase = cases[index]!
    const noteMatches =
      mode === 'on'
        ? noteMatchSetFromCandidates(
            [{ note: bp.note, matchedTerms: [...bp.contentTerms] }],
            corpus,
            bp.contentTerms
          )
        : undefined
    const result = recallByKeywordWithParsedClue(corpus, bp.clue, {
      nowMs: RECALL_EVAL_NOW_MS,
      parsed: {
        raw: bp.clue,
        contentTerms: bp.contentTerms,
        confidence: 'medium',
        ...(bp.excludeContentTerms ? { excludeContentTerms: bp.excludeContentTerms } : {})
      },
      ...(noteMatches ? { noteMatches } : {})
    })
    const judged = judgeRecallEvalCase(evalCase, result)
    return {
      id: bp.id,
      category: bp.category,
      passed: judged.passed,
      result
    }
  })

  const total = results.length
  let top1Hits = 0
  let inTop3 = 0
  let inTop5 = 0
  let noMatch = 0
  const emptyKindCounts: Record<string, number> = {}
  let noteTop1Count = 0
  let soleCorroborationAmongNoteTop1 = 0

  for (const row of results) {
    const ids = [
      ...(row.result.topPick ? [row.result.topPick.item.id] : []),
      ...row.result.alsoPossible.map(match => match.item.id)
    ]
    const bp = DREAMING_OFFLINE_EVAL_BLUEPRINTS.find(item => item.id === row.id)!
    const expectedId =
      mode === 'on'
        ? bp.expectationOn.kind !== 'no_match' && 'expectedId' in bp.expectationOn
          ? bp.expectationOn.expectedId
          : null
        : bp.expectationOff.kind !== 'no_match' && 'expectedId' in bp.expectationOff
          ? bp.expectationOff.expectedId
          : null

    if (
      row.result.outcome === 'top_pick' &&
      expectedId &&
      row.result.topPick?.item.id === expectedId
    ) {
      top1Hits += 1
    }
    if (expectedId && ids.slice(0, 3).includes(expectedId)) {
      inTop3 += 1
    }
    if (expectedId && ids.slice(0, 5).includes(expectedId)) {
      inTop5 += 1
    }
    if (row.result.outcome === 'no_match') {
      noMatch += 1
      const kind = row.result.emptyKind ?? 'unspecified'
      emptyKindCounts[kind] = (emptyKindCounts[kind] ?? 0) + 1
    }
    if (row.result.topPick?.matchedFields.includes('memory_note')) {
      noteTop1Count += 1
      if (row.result.topPick.noteProvenance?.soleCorroboration) {
        soleCorroborationAmongNoteTop1 += 1
      }
    }
  }

  return {
    results,
    top1HitRate: top1Hits / total,
    inTop3Rate: inTop3 / total,
    inTop5Rate: inTop5 / total,
    noMatchRate: noMatch / total,
    emptyKindCounts,
    soleCorroborationAmongNoteTop1,
    noteTop1Count
  }
}

function percentile(sortedAsc: number[], p: number): number {
  if (sortedAsc.length === 0) {
    return 0
  }
  const index = Math.min(
    sortedAsc.length - 1,
    Math.max(0, Math.ceil((p / 100) * sortedAsc.length) - 1)
  )
  return sortedAsc[index]!
}

describe('dreaming-offline-eval · Stage 3', () => {
  it('Recall 命中率：Top1 + in_topk（k=3/5）ON vs OFF；两次运行差值稳定', () => {
    expect(DREAMING_OFFLINE_EVAL_BLUEPRINTS.length).toBeGreaterThanOrEqual(20)
    const cats = new Set(DREAMING_OFFLINE_EVAL_BLUEPRINTS.map(bp => bp.category))
    expect(cats).toEqual(new Set(['note_only', 'note_and_literal', 'note_exclude', 'dirty_orphan']))
    for (const category of cats) {
      expect(
        DREAMING_OFFLINE_EVAL_BLUEPRINTS.filter(bp => bp.category === category).length
      ).toBeGreaterThanOrEqual(5)
    }

    const off1 = runOfflinePass('off')
    const on1 = runOfflinePass('on')
    const off2 = runOfflinePass('off')
    const on2 = runOfflinePass('on')

    console.info('[offline-eval] hit-rate', {
      off: {
        top1: off1.top1HitRate,
        inTop3: off1.inTop3Rate,
        inTop5: off1.inTop5Rate
      },
      on: {
        top1: on1.top1HitRate,
        inTop3: on1.inTop3Rate,
        inTop5: on1.inTop5Rate
      }
    })

    // H1：ON Top1 ≥ OFF；两次运行完全可复现
    expect(on1.top1HitRate).toBeGreaterThanOrEqual(off1.top1HitRate)
    expect(on1.top1HitRate).toBe(on2.top1HitRate)
    expect(off1.top1HitRate).toBe(off2.top1HitRate)
    expect(on1.inTop3Rate).toBe(on2.inTop3Rate)
    expect(on1.inTop5Rate).toBe(on2.inTop5Rate)

    // (a) 类：OFF 期望 no_match；ON 期望 Top1——用 outcome 直接验抬升
    const aOffTop1 = off1.results.filter(
      row => row.category === 'note_only' && row.result.outcome === 'top_pick'
    ).length
    const aOnTop1 = on1.results.filter(
      row => row.category === 'note_only' && row.result.outcome === 'top_pick'
    ).length
    expect(aOnTop1).toBeGreaterThan(aOffTop1)
  })

  it('no_match 率：ON vs OFF；missing_topic / rejected_noise 绝对占比单列', () => {
    const off = runOfflinePass('off')
    const on = runOfflinePass('on')

    console.info('[offline-eval] no_match', {
      offRate: off.noMatchRate,
      onRate: on.noMatchRate,
      offEmptyKinds: off.emptyKindCounts,
      onEmptyKinds: on.emptyKindCounts,
      missing_topic_off: off.emptyKindCounts.missing_topic ?? 0,
      missing_topic_on: on.emptyKindCounts.missing_topic ?? 0,
      rejected_noise_off: off.emptyKindCounts.rejected_noise ?? 0,
      rejected_noise_on: on.emptyKindCounts.rejected_noise ?? 0
    })

    // 命题独占类打开后 no_match 应下降（或持平不升）
    expect(on.noMatchRate).toBeLessThanOrEqual(off.noMatchRate)
    // 本评估集不走 Gate A / Topic 门短路；绝对占比须为 0 并单列
    expect(off.emptyKindCounts.missing_topic ?? 0).toBe(0)
    expect(on.emptyKindCounts.missing_topic ?? 0).toBe(0)
    expect(off.emptyKindCounts.rejected_noise ?? 0).toBe(0)
    expect(on.emptyKindCounts.rejected_noise ?? 0).toBe(0)
  })

  it('命题引用完整率：全部命题行有 sourceMemoryItemId + sourceQuote', () => {
    const notes = listDreamingOfflineEvalNotes()
    expect(notes.length).toBeGreaterThanOrEqual(20)
    let complete = 0
    for (const note of notes) {
      const ok =
        Boolean(note.sourceMemoryItemId?.trim()) &&
        hasMemoryNoteSourceCitation({ sourceQuote: note.sourceQuote })
      if (ok) {
        complete += 1
      }
    }
    const rate = complete / notes.length
    console.info('[offline-eval] citation-complete', { complete, total: notes.length, rate })
    expect(rate).toBe(1)
  })

  it('孤儿率：fake IDB 种入评估命题 + 孤儿行，sweepOrphans 后为 0', async () => {
    resetMemoryDatabaseInitializationForTests()
    vi.stubGlobal(
      'chrome',
      createChromeStorageMock({
        [LOCAL_PROFILE_STORAGE_KEY]: localProfile
      })
    )
    for (const database of await indexedDB.databases()) {
      if (database.name) {
        indexedDB.deleteDatabase(database.name)
      }
    }

    await memoryNotesRepository.ensureReady()
    const notes = listDreamingOfflineEvalNotes()
    for (const note of notes) {
      const written = await memoryNotesRepository.putProposition(
        {
          ownerId: note.ownerId,
          sourceMemoryItemId: note.sourceMemoryItemId,
          sourceType: note.sourceType,
          text: note.text,
          sourceQuote: note.sourceQuote,
          dreamRunId: note.dreamRunId,
          sourceUpdatedAt: note.sourceUpdatedAt,
          propositionIndex: Number(note.id.split('\0')[2] ?? 0)
        },
        RECALL_EVAL_NOW_MS
      )
      expect(written).not.toBeNull()
    }

    const existingSourceIds = new Set(corpus.map(item => item.id))
    const beforeCount = await memoryNotesRepository.countByOwner(DREAMING_EVAL_OWNER_ID)
    expect(beforeCount).toBe(notes.length)

    const orphanBefore = notes.filter(
      note => !existingSourceIds.has(note.sourceMemoryItemId)
    ).length
    expect(orphanBefore).toBeGreaterThan(0)

    const deleted = await memoryNotesRepository.sweepOrphans({
      ownerId: DREAMING_EVAL_OWNER_ID,
      existingSourceIds
    })
    expect(deleted).toBe(orphanBefore)

    const afterCount = await memoryNotesRepository.countByOwner(DREAMING_EVAL_OWNER_ID)
    // 扫后：库内命题的源均在 existingSourceIds
    const remaining = await memoryNotesRepository.listByOwnerUpdated({
      ownerId: DREAMING_EVAL_OWNER_ID,
      limit: 2000
    })
    const orphanRate =
      remaining.length === 0
        ? 0
        : remaining.filter(note => !existingSourceIds.has(note.sourceMemoryItemId)).length /
          remaining.length
    console.info('[offline-eval] orphan-sweep', {
      beforeCount,
      orphanBefore,
      deleted,
      afterCount,
      orphanRate
    })
    expect(orphanRate).toBe(0)
  })

  it('candidateLoadMs：note 扫描延迟（中位数 + p95；ON vs OFF）', async () => {
    const notes = listDreamingOfflineEvalNotes()
    const samples = 21
    const offMs: number[] = []
    const onMs: number[] = []

    for (let i = 0; i < samples; i += 1) {
      const t0 = performance.now()
      await findNoteMatchesForQuery({
        ownerId: DREAMING_EVAL_OWNER_ID,
        contentTerms: ['rottnest', 'quokka'],
        scan: async () => []
      })
      offMs.push(performance.now() - t0)

      const t1 = performance.now()
      await findNoteMatchesForQuery({
        ownerId: DREAMING_EVAL_OWNER_ID,
        contentTerms: ['rottnest', 'quokka'],
        scan: async () => notes
      })
      onMs.push(performance.now() - t1)
    }

    offMs.sort((a, b) => a - b)
    onMs.sort((a, b) => a - b)
    const report = {
      off: { median: percentile(offMs, 50), p95: percentile(offMs, 95) },
      on: { median: percentile(onMs, 50), p95: percentile(onMs, 95) }
    }
    console.info('[offline-eval] candidateLoadMs', report)
    // 仅记录；不设硬失败线（设计稿：同步报告、不设通过线）
    expect(report.on.median).toBeGreaterThanOrEqual(0)
    expect(report.off.median).toBeGreaterThanOrEqual(0)
  })

  it('sole-corroboration 占比：命题命中进 Top1 的条目（ON 轮）', () => {
    const on = runOfflinePass('on')
    const ratio = on.noteTop1Count === 0 ? 0 : on.soleCorroborationAmongNoteTop1 / on.noteTop1Count
    console.info('[offline-eval] sole-corroboration', {
      noteTop1Count: on.noteTop1Count,
      sole: on.soleCorroborationAmongNoteTop1,
      ratio
    })
    // (a) 类应为 sole；占比 > 0
    expect(on.noteTop1Count).toBeGreaterThan(0)
    expect(ratio).toBeGreaterThan(0)
  })
})
