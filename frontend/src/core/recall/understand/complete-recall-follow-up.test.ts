import { describe, expect, it, vi } from 'vitest'

import { parseRecallClue } from '@/core/recall/parse-recall-clue'
import { completeRecallFollowUpWithLlm } from '@/core/recall/understand/complete-recall-follow-up'

const NOW_MS = Date.parse('2026-08-08T12:00:00.000Z')

describe('completeRecallFollowUpWithLlm', () => {
  it('解析 JSON 提议并映射成功', async () => {
    const parsed = parseRecallClue('the movie I watched yesterday', { nowMs: NOW_MS })
    const complete = vi.fn(async () =>
      JSON.stringify({
        reply: 'Nothing in your library matches that day and type. Try another time?',
        chips: [{ label: 'last week', value: 'last week' }]
      })
    )
    const mapped = await completeRecallFollowUpWithLlm({
      clue: parsed.raw,
      parsed,
      outcome: 'no_match',
      emptyKind: 'constrained_none',
      complete
    })
    expect(mapped.text).toContain('library')
    expect(mapped.suggestions[0]?.value).toBe('last week')
    expect(complete).toHaveBeenCalledOnce()
  })

  it('门禁拒收时抛错供上层降级', async () => {
    const parsed = parseRecallClue('the movie I watched yesterday', { nowMs: NOW_MS })
    await expect(
      completeRecallFollowUpWithLlm({
        clue: parsed.raw,
        parsed,
        outcome: 'no_match',
        complete: async () =>
          JSON.stringify({
            reply: 'Was it an article, poem, code, or a song?',
            chips: []
          })
      })
    ).rejects.toThrow('follow_up_gate_rejected')
  })
})
