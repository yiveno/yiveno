import { describe, expect, it, vi } from 'vitest'

import { parseRecallClue } from '@/core/recall/parse-recall-clue'
import type { RecallFramingCandidateFacts } from '@/core/recall/recall-framing-facts'
import { completeRecallFramingNlgWithLlm } from '@/core/recall/understand/complete-recall-framing-nlg'

const NOW_MS = Date.parse('2026-08-08T12:00:00.000Z')

const baseFacts: RecallFramingCandidateFacts = {
  kind: 'candidates',
  understood: {
    objectTypes: ['video'],
    contentTerms: [],
    behaviorHints: [],
    noteHint: false
  },
  retrievalPath: 'constraint_neighborhood',
  buckets: [],
  stance: 'weak_candidates',
  counts: { total: 8, shown: 5 },
  isWideNeighborhood: true
}

describe('completeRecallFramingNlgWithLlm', () => {
  it('need_a_clue 解析 JSON 并保留芯片', async () => {
    const parsed = parseRecallClue('that video about design', { nowMs: NOW_MS })
    const complete = vi.fn(async () =>
      JSON.stringify({
        reply: 'These clips are all design-related. Which site or title word rings a bell?',
        chips: [{ label: 'Figma', value: 'Figma' }]
      })
    )

    const mapped = await completeRecallFramingNlgWithLlm({
      clue: parsed.raw,
      parsed,
      outcome: 'need_a_clue',
      facts: baseFacts,
      rulesBaseline: 'Looking for video in your library.',
      weakCandidateTitles: ['Design systems talk', 'Figma tips'],
      complete
    })

    expect(mapped.text).toContain('design')
    expect(mapped.suggestions[0]?.value).toBe('Figma')
    expect(complete).toHaveBeenCalledOnce()
  })

  it('top_pick 宽邻域清空芯片', async () => {
    const parsed = parseRecallClue('video', { nowMs: NOW_MS })
    const mapped = await completeRecallFramingNlgWithLlm({
      clue: parsed.raw,
      parsed,
      outcome: 'top_pick',
      facts: baseFacts,
      rulesBaseline: 'Looking for video in your library.',
      complete: async () =>
        JSON.stringify({
          reply: 'These are video-related saves from your library.',
          chips: [{ label: 'YouTube', value: 'YouTube' }]
        })
    })

    expect(mapped.text).toContain('video')
    expect(mapped.suggestions).toHaveLength(0)
  })

  it('门禁拒收时抛错供上层降级', async () => {
    const parsed = parseRecallClue('the movie I watched yesterday', { nowMs: NOW_MS })
    await expect(
      completeRecallFramingNlgWithLlm({
        clue: parsed.raw,
        parsed,
        outcome: 'need_a_clue',
        facts: baseFacts,
        rulesBaseline: 'baseline',
        complete: async () =>
          JSON.stringify({
            reply: 'Was it an article, poem, code, or a song?',
            chips: []
          })
      })
    ).rejects.toThrow('framing_nlg_gate_rejected')
  })
})
