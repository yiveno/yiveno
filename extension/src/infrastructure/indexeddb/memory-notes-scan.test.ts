/**
 * Dreaming Phase 4 · 查询侧 note 扫描上限（注入 fake scan，不依赖真 IDB）。
 */

import { describe, expect, it } from 'vitest'

import {
  buildDreamingDn1Note,
  DREAMING_EVAL_IDS,
  DREAMING_EVAL_OWNER_ID,
  makeDreamingEvalNote
} from '../../../tests/eval/dreaming-eval-corpus'
import {
  DREAMING_NOTE_MAX_ATTACHED_SOURCES,
  DREAMING_NOTE_SCAN_LIMIT,
  findNoteMatchesForQuery
} from '@/core/recall/note-match'
import type { MemoryNoteRecord } from '@/infrastructure/indexeddb/memory-notes-types'

describe('memory-notes-scan', () => {
  it('listByOwnerUpdated 按 limit 截断（经 findNoteMatchesForQuery 的 scan 注入）', async () => {
    const base = buildDreamingDn1Note()
    const rows: MemoryNoteRecord[] = Array.from({ length: 5 }, (_, index) => ({
      ...base,
      id: `${DREAMING_EVAL_OWNER_ID}\0${DREAMING_EVAL_IDS.dreamingRottnestExcerpt}\0${index}`,
      text: `${base.text} #${index}`
    }))
    let seenLimit = 0
    const candidates = await findNoteMatchesForQuery({
      ownerId: DREAMING_EVAL_OWNER_ID,
      contentTerms: ['rottnest'],
      scan: async ({ limit }) => {
        seenLimit = limit
        return rows.slice(0, limit)
      }
    })
    expect(seenLimit).toBe(DREAMING_NOTE_SCAN_LIMIT)
    // 同 source 取最优 → 候选按源去重后 ≤1
    expect(candidates.length).toBe(1)
  })

  it('findNoteMatchesForQuery 每查询最多附加 100 个源', async () => {
    const rows: MemoryNoteRecord[] = Array.from({ length: 150 }, (_, index) => {
      const sourceId = `11111111-1111-4111-8111-${String(111111111200 + index).padStart(12, '0')}`
      return makeDreamingEvalNote({
        sourceId,
        index: 0,
        text: 'Rottnest quokka dusk sighting.',
        sourceQuote: 'quote',
        sourceUpdatedAt: '2026-07-10T08:00:00.000Z',
        sourceType: 'text_excerpt'
      })
    })
    const candidates = await findNoteMatchesForQuery({
      ownerId: DREAMING_EVAL_OWNER_ID,
      contentTerms: ['rottnest'],
      scan: async () => rows
    })
    expect(candidates.length).toBe(DREAMING_NOTE_MAX_ATTACHED_SOURCES)
  })
})
