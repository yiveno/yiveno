import { describe, expect, it } from 'vitest'

import { renderRecallFraming } from '@/core/recall/render-recall-framing'
import type { RecallFramingCandidateFacts } from '@/core/recall/recall-framing-facts'

const translate = (key: string, subs?: string | string[]) => {
  const table: Record<string, string> = {
    framing_list_sep: ', ',
    framing_p1_object_types: 'Looking for $1 traces in your library.',
    framing_p2_constraint: 'These match the type you pointed at in your library.',
    framing_p4_weak: 'Nothing here is strong enough to pin down yet.',
    framing_p6_partial: '$1 related matches · showing $2–$3:',
    framing_object_video: 'video'
  }
  let text = table[key] ?? key
  const values = subs === undefined ? [] : Array.isArray(subs) ? subs : [subs]
  values.forEach((value, index) => {
    text = text.split(`$${index + 1}`).join(value)
  })
  return text
}

describe('renderRecallFraming', () => {
  it('按 P1→P6 拼接候选列表说明', () => {
    const facts: RecallFramingCandidateFacts = {
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
      counts: { total: 12, shown: 5 },
      isWideNeighborhood: true
    }

    const text = renderRecallFraming(facts, translate)
    expect(text).toContain('video')
    expect(text).toContain('12 related matches')
    expect(text).toContain('showing 1–5')
  })
})
