import { describe, expect, it, vi } from 'vitest'

import { parseRecallClue } from '@/core/recall/parse-recall-clue'
import { completeRecallFollowUpWithLlm } from '@/core/recall/understand/complete-recall-follow-up'

const NOW_MS = Date.parse('2026-08-08T12:00:00.000Z')

describe('completeRecallFollowUpWithLlm', () => {
  it('解析 JSON 提议并映射成功', async () => {
    const parsed = parseRecallClue('the article about RAG', { nowMs: NOW_MS })
    const complete = vi.fn(async () =>
      JSON.stringify({
        reply: 'These are close. Which title word do you remember?',
        chips: [{ label: 'RAG', value: 'RAG' }]
      })
    )
    const mapped = await completeRecallFollowUpWithLlm({
      clue: parsed.raw,
      parsed,
      outcome: 'need_a_clue',
      weakCandidateTitles: ['Deploy checklist', 'RAG notes'],
      complete
    })
    expect(mapped.text).toContain('close')
    expect(mapped.suggestions[0]?.value).toBe('RAG')
    expect(complete).toHaveBeenCalledOnce()
  })

  it('门禁拒收时抛错供上层降级', async () => {
    const parsed = parseRecallClue('the movie I watched yesterday', { nowMs: NOW_MS })
    await expect(
      completeRecallFollowUpWithLlm({
        clue: parsed.raw,
        parsed,
        outcome: 'need_a_clue',
        complete: async () =>
          JSON.stringify({
            reply: 'Was it an article, poem, code, or a song?',
            chips: []
          })
      })
    ).rejects.toThrow('follow_up_gate_rejected')
  })
})
