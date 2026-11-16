/**
 * Dreaming Phase 4 · dreaming_note_hit 遥测。
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { buildMemoryNoteId } from '@/infrastructure/indexeddb/memory-notes-types'

const appendMock = vi.hoisted(() => vi.fn(async (_event: Record<string, unknown>) => {}))

vi.mock('@/infrastructure/analytics/recall-telemetry-store', () => ({
  appendRecallTelemetryEvent: appendMock,
  listRecallTelemetryEvents: vi.fn(async () => []),
  clearRecallTelemetryEvents: vi.fn(async () => {})
}))

import { createRecallTelemetryRecorder } from '@/infrastructure/analytics/recall-telemetry-recorder'
import { parseRecallTelemetryEvent } from '@/core/recall/recall-telemetry'

const OWNER_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const SOURCE_ID = '11111111-1111-4111-8111-111111111129'
const NOTE_ID = buildMemoryNoteId(OWNER_ID, SOURCE_ID, 0)

describe('recall-telemetry-note', () => {
  beforeEach(() => {
    appendMock.mockClear()
  })

  it('parseRecallTelemetryEvent 接受 dreaming_note_hit', () => {
    const parsed = parseRecallTelemetryEvent({
      type: 'dreaming_note_hit',
      taskId: '11111111-1111-4111-8111-111111111111',
      traceId: '22222222-2222-4222-8222-222222222222',
      noteId: NOTE_ID,
      sourceMemoryItemId: SOURCE_ID,
      rank: 0,
      matchedTermsCount: 2,
      soleCorroboration: true,
      at: '2026-11-10T12:00:00.000Z'
    })
    expect(parsed?.type).toBe('dreaming_note_hit')
    if (parsed?.type === 'dreaming_note_hit') {
      expect(parsed.matchedTermsCount).toBe(2)
      expect(parsed.soleCorroboration).toBe(true)
      expect(JSON.stringify(parsed)).not.toMatch(/Quokka|Rottnest/)
    }
  })

  it('recordDreamingNoteHit 在有 active task 时写出正确载荷且不含命题文本', async () => {
    const recorder = createRecallTelemetryRecorder()
    recorder.beginClue({ clue: 'rottnest quokka' })
    recorder.recordDreamingNoteHit({
      noteId: NOTE_ID,
      sourceMemoryItemId: SOURCE_ID,
      rank: 0,
      matchedTermsCount: 2,
      soleCorroboration: true
    })
    // emit 经模块级 Promise 链异步落盘，等 microtask 冲刷后再断言。
    await vi.waitFor(() => {
      expect(appendMock).toHaveBeenCalled()
    })
    const dreamingCall = appendMock.mock.calls
      .map(call => call[0])
      .find(event => event?.type === 'dreaming_note_hit')
    expect(dreamingCall).toBeTruthy()
    expect(dreamingCall!.matchedTermsCount).toBe(2)
    expect(dreamingCall!.soleCorroboration).toBe(true)
    expect(JSON.stringify(dreamingCall)).not.toMatch(/Quokka|sightings|proposition/)
  })

  it('dreaming_note_hit 接受 matchKind + semanticScoreBucket（按 kind 区分）', () => {
    const parsed = parseRecallTelemetryEvent({
      type: 'dreaming_note_hit',
      taskId: '11111111-1111-4111-8111-111111111111',
      traceId: '22222222-2222-4222-8222-222222222222',
      noteId: NOTE_ID,
      sourceMemoryItemId: SOURCE_ID,
      rank: 0,
      matchedTermsCount: 0,
      soleCorroboration: true,
      matchKind: 'semantic',
      semanticScoreBucket: '0.65_0.70',
      at: '2026-11-16T12:00:00.000Z'
    })
    expect(parsed?.type).toBe('dreaming_note_hit')
    if (parsed?.type === 'dreaming_note_hit') {
      expect(parsed.matchKind).toBe('semantic')
      expect(parsed.semanticScoreBucket).toBe('0.65_0.70')
    }
  })
})
