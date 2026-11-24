import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  buildOpenConfirmOutcomePair,
  recordOpenConfirmOutcomePair
} from '@/application/recall/record-open-confirm-outcome'
import { fingerprintRecallClue } from '@/core/recall/recall-outcome-pairs'
import * as pairsStorage from '@/infrastructure/storage/recall-outcome-pairs-storage'

describe('buildOpenConfirmOutcomePair', () => {
  it('空线索返回 null；否则 fingerprint + open_confirm', () => {
    expect(
      buildOpenConfirmOutcomePair({
        effectiveClue: '   ',
        targetId: '11111111-1111-4111-8111-111111111111'
      })
    ).toBeNull()

    const pair = buildOpenConfirmOutcomePair({
      effectiveClue: '  Peck  Fable ',
      targetId: '11111111-1111-4111-8111-111111111111',
      createdAt: '2026-11-24T00:00:00.000Z'
    })
    expect(pair).toMatchObject({
      fingerprint: fingerprintRecallClue('Peck Fable'),
      label: 'target',
      targetId: '11111111-1111-4111-8111-111111111111',
      source: 'open_confirm',
      confidence: 'medium_high'
    })
  })
})

describe('recordOpenConfirmOutcomePair', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('写入 appendRecallOutcomePair', async () => {
    const append = vi.spyOn(pairsStorage, 'appendRecallOutcomePair').mockResolvedValue(undefined)
    const ok = await recordOpenConfirmOutcomePair({
      effectiveClue: 'checklist page',
      targetId: '22222222-2222-4222-8222-222222222222'
    })
    expect(ok).toBe(true)
    expect(append).toHaveBeenCalledTimes(1)
    expect(append.mock.calls[0]?.[0]).toMatchObject({
      source: 'open_confirm',
      targetId: '22222222-2222-4222-8222-222222222222'
    })
  })
})
