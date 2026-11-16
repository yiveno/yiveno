/**
 * Phase 5：巡检状态迁移 + 不写 dismiss/updatedAt。
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { LINK_STATUS_STALE_FAILURE_THRESHOLD } from '@/core/dreaming/dreaming-constants'
import { createBookmarkMemoryItem } from '@/core/memory/create-memory-item'
import {
  __testOnlyNextLinkStatusRecord,
  sweepMemoryLinkStatusTick
} from '@/application/dreaming/sweep-memory-link-status'
import { checkMemoryLinkUrl } from '@/application/dreaming/check-memory-link-url'

const { putRecordMock, listByOwnerMock, listItemsMock } = vi.hoisted(() => ({
  putRecordMock: vi.fn(),
  listByOwnerMock: vi.fn(),
  listItemsMock: vi.fn()
}))

vi.mock('@/infrastructure/settings/user-settings-service', () => ({
  getUserSettings: vi.fn(async () => ({ linkStatusSweepEnabled: true }))
}))

vi.mock('@/infrastructure/identity/local-profile-service', () => ({
  getCurrentOwnerId: vi.fn(async () => '11111111-1111-4111-8111-111111111111')
}))

vi.mock('@/infrastructure/indexeddb/memory-link-status-repository', () => ({
  memoryLinkStatusRepository: {
    putRecord: putRecordMock,
    listByOwner: listByOwnerMock
  }
}))

vi.mock('@/infrastructure/indexeddb/memory-item-repository', () => ({
  memoryItemRepository: {
    listByOwner: listItemsMock
  }
}))

vi.mock('@/application/dreaming/check-memory-link-url', () => ({
  checkMemoryLinkUrl: vi.fn()
}))

const baseContext = {
  ownerId: '11111111-1111-4111-8111-111111111111',
  sourceLocalProfileId: '22222222-2222-4222-8222-222222222222',
  now: () => '2026-07-22T06:00:00.000Z'
}

describe('nextLinkStatusRecord', () => {
  const item = createBookmarkMemoryItem({
    ...baseContext,
    payload: { title: 'Dead page', url: 'https://example.com/gone' }
  })

  it('probe_failed → unknown，不得升 stale', () => {
    const record = __testOnlyNextLinkStatusRecord({
      ownerId: baseContext.ownerId,
      item,
      previous: null,
      outcome: 'probe_failed',
      nowIso: '2026-11-12T00:00:00.000Z'
    })
    expect(record.linkStatus).toBe('unknown')
    expect(record.consecutiveFailures).toBe(0)
  })

  it('连续 dead 达阈值才 stale', () => {
    let previous = null as ReturnType<typeof __testOnlyNextLinkStatusRecord> | null
    for (let i = 0; i < LINK_STATUS_STALE_FAILURE_THRESHOLD; i += 1) {
      previous = __testOnlyNextLinkStatusRecord({
        ownerId: baseContext.ownerId,
        item,
        previous,
        outcome: 'dead',
        nowIso: `2026-11-12T00:0${i}:00.000Z`
      })
    }
    expect(previous!.linkStatus).toBe('stale')
    expect(previous!.consecutiveFailures).toBe(LINK_STATUS_STALE_FAILURE_THRESHOLD)
    expect(previous!.firstStaleAt).toBeTruthy()
  })
})

describe('sweepMemoryLinkStatusTick 副作用边界', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    putRecordMock.mockResolvedValue(undefined)
    listByOwnerMock.mockResolvedValue([])
    listItemsMock.mockResolvedValue([])
    vi.mocked(checkMemoryLinkUrl).mockResolvedValue('dead')
  })

  it('巡检写入不碰 dismissCount / updatedAt（只写 link_status store）', async () => {
    const item = createBookmarkMemoryItem({
      ...baseContext,
      payload: { title: 'Page', url: 'https://example.com/a' },
      clues: { dismissCount: 3 }
    })
    const frozenUpdatedAt = item.updatedAt
    const frozenDismiss = item.clues.dismissCount
    listItemsMock.mockResolvedValue([item])

    await sweepMemoryLinkStatusTick()

    expect(putRecordMock).toHaveBeenCalled()
    expect(item.updatedAt).toBe(frozenUpdatedAt)
    expect(item.clues.dismissCount).toBe(frozenDismiss)
    const written = putRecordMock.mock.calls[0]?.[0] as { sourceMemoryItemId: string }
    expect(written.sourceMemoryItemId).toBe(item.id)
  })
})
