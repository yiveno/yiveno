import { beforeEach, describe, expect, it, vi } from 'vitest'

const ensureBackgroundBootstrappedMock = vi.hoisted(() => vi.fn(async () => undefined))
const compileMemoryNotesTickMock = vi.hoisted(() =>
  vi.fn(async () => ({ processed: 0, written: 0, deferred: false }))
)
const backfillPropositionEmbeddingsTickMock = vi.hoisted(() =>
  vi.fn(async () => ({
    skipped: false,
    scanned: 0,
    written: 0,
    reused: 0,
    failed: 0
  }))
)
const sweepOrphanMemoryNotesMock = vi.hoisted(() => vi.fn(async () => ({ removed: 0 })))
const compilePortraitFactsTickMock = vi.hoisted(() =>
  vi.fn(async () => ({ ok: true, ownerId: null, written: 0, stats: null }))
)
const ensureDreamingAlarmMock = vi.hoisted(() => vi.fn(async () => undefined))

vi.mock('@/background/bootstrap-ready', () => ({
  ensureBackgroundBootstrapped: ensureBackgroundBootstrappedMock
}))

vi.mock('@/application/dreaming/compile-memory-notes', () => ({
  compileMemoryNotesTick: compileMemoryNotesTickMock
}))

vi.mock('@/application/dreaming/schedule-proposition-embeddings', () => ({
  backfillPropositionEmbeddingsTick: backfillPropositionEmbeddingsTickMock
}))

vi.mock('@/application/dreaming/sweep-orphan-memory-notes', () => ({
  sweepOrphanMemoryNotes: sweepOrphanMemoryNotesMock
}))

vi.mock('@/application/portrait/compile-portrait-facts', () => ({
  compilePortraitFactsTick: compilePortraitFactsTickMock
}))

vi.mock('@/infrastructure/sync/dreaming-alarm', async importOriginal => {
  const actual = await importOriginal<typeof import('@/infrastructure/sync/dreaming-alarm')>()
  return {
    ...actual,
    ensureDreamingAlarm: ensureDreamingAlarmMock
  }
})

vi.mock('@/infrastructure/logging/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}))

import { DREAMING_ALARM_NAME } from '@/infrastructure/sync/dreaming-alarm'
import {
  isDreamingAlarmListenerRegistered,
  registerDreamingAlarmListener,
  resetDreamingAlarmListenerForTests
} from '@/background/listeners/dreaming-alarm'

describe('dreaming-alarm listener', () => {
  beforeEach(() => {
    resetDreamingAlarmListenerForTests()
    vi.clearAllMocks()
    vi.stubGlobal('chrome', {
      alarms: {
        onAlarm: { addListener: vi.fn() },
        create: vi.fn(async () => undefined),
        clear: vi.fn(async () => undefined)
      }
    })
  })

  it('registerDreamingAlarmListener 幂等注册 onAlarm', () => {
    registerDreamingAlarmListener()
    registerDreamingAlarmListener()

    expect(chrome.alarms.onAlarm.addListener).toHaveBeenCalledTimes(1)
    expect(isDreamingAlarmListenerRegistered()).toBe(true)
  })

  it('注册时挂载每日周期闹钟', async () => {
    registerDreamingAlarmListener()

    await vi.waitFor(() => {
      expect(ensureDreamingAlarmMock).toHaveBeenCalledWith(true)
    })
  })

  it('onAlarm 匹配名前先 await bootstrap 再编译与孤儿扫', async () => {
    registerDreamingAlarmListener()

    const onAlarm = (chrome.alarms.onAlarm.addListener as ReturnType<typeof vi.fn>).mock
      .calls[0]?.[0] as (alarm: chrome.alarms.Alarm) => void

    onAlarm({
      name: DREAMING_ALARM_NAME,
      scheduledTime: Date.now(),
      periodInMinutes: 1440,
      persistAcrossSessions: true
    })

    await vi.waitFor(() => {
      expect(ensureBackgroundBootstrappedMock).toHaveBeenCalled()
      expect(compileMemoryNotesTickMock).toHaveBeenCalled()
      expect(sweepOrphanMemoryNotesMock).toHaveBeenCalled()
    })
  })

  it('onAlarm tick 在编译后调用命题向量回填一次', async () => {
    registerDreamingAlarmListener()

    const onAlarm = (chrome.alarms.onAlarm.addListener as ReturnType<typeof vi.fn>).mock
      .calls[0]?.[0] as (alarm: chrome.alarms.Alarm) => void

    onAlarm({
      name: DREAMING_ALARM_NAME,
      scheduledTime: Date.now(),
      periodInMinutes: 1440,
      persistAcrossSessions: true
    })

    await vi.waitFor(() => {
      expect(compileMemoryNotesTickMock).toHaveBeenCalledTimes(1)
      expect(backfillPropositionEmbeddingsTickMock).toHaveBeenCalledTimes(1)
      expect(compilePortraitFactsTickMock).toHaveBeenCalledTimes(1)
      expect(sweepOrphanMemoryNotesMock).toHaveBeenCalledTimes(1)
    })
    // 顺序：编译 → 回填 → 孤儿扫
    const compileOrder = compileMemoryNotesTickMock.mock.invocationCallOrder[0]!
    const backfillOrder = backfillPropositionEmbeddingsTickMock.mock.invocationCallOrder[0]!
    const orphanOrder = sweepOrphanMemoryNotesMock.mock.invocationCallOrder[0]!
    expect(compileOrder).toBeLessThan(backfillOrder)
    expect(backfillOrder).toBeLessThan(orphanOrder)
  })
})
