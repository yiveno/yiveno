import { describe, expect, it } from 'vitest'

import { parseRecallWithCluePayload } from '@/core/messaging/recall-messages'
import { parseRecallClue } from '@/core/recall/parse-recall-clue'

describe('parseRecallWithCluePayload', () => {
  it('接受单句 clue', () => {
    expect(parseRecallWithCluePayload({ clue: 'retention' })).toEqual({ clue: 'retention' })
  })

  it('接受多轮 context', () => {
    const accumulated = parseRecallClue('poem Li Bai', {
      nowMs: Date.parse('2026-08-05T12:00:00.000Z')
    })
    const payload = parseRecallWithCluePayload({
      clue: 'yesterday',
      context: {
        priorUserUtterances: ['poem Li Bai'],
        accumulated,
        dismissedIds: ['11111111-1111-4111-8111-111111111101']
      }
    })
    expect(payload.clue).toBe('yesterday')
    expect(payload.context?.priorUserUtterances).toEqual(['poem Li Bai'])
    expect(payload.context?.dismissedIds).toHaveLength(1)
    expect(payload.context?.accumulated?.objectTypes).toContain('poem')
  })

  it('拒绝非法 dismissedIds', () => {
    expect(() =>
      parseRecallWithCluePayload({
        clue: 'x',
        context: { dismissedIds: ['not-a-uuid'] }
      })
    ).toThrow()
  })
})
