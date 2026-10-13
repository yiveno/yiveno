import { describe, expect, it } from 'vitest'

import { renderRecallFraming } from '@/core/recall/render-recall-framing'
import type { RecallFramingCandidateFacts } from '@/core/recall/recall-framing-facts'

const translate = (key: string, subs?: string | string[]) => {
  const table: Record<string, string> = {
    framing_list_sep: ', ',
    framing_p1_object_types: 'Looking for $1 in your library.',
    framing_p1_time: 'Within $1,',
    framing_p1_time_soft: 'Around $1,',
    framing_time_few_months_ago: 'a few months ago',
    framing_time_last_week: 'last week',
    framing_time_a_while_ago: 'a while ago',
    framing_p2_constraint: 'These match the kind you pointed at.',
    framing_p4_weak: 'Nothing here is strong enough to pin down yet.',
    framing_p6_partial: '$1 related · showing $2–$3:',
    framing_object_video: 'video',
    framing_guess_missing_topic: 'Tell me what topic it is about, and I will look.',
    framing_guess_disclaimer: 'The item below is only a guess — not the answer.'
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
    expect(text).toContain('12 related')
    expect(text).toContain('showing 1–5')
  })

  it('timeLabel 用日常英语，不露出 snake_case', () => {
    const facts: RecallFramingCandidateFacts = {
      kind: 'candidates',
      understood: {
        objectTypes: [],
        contentTerms: ['libraries'],
        behaviorHints: [],
        noteHint: false,
        timeLabel: 'few_months_ago',
        timeConfidence: 'low'
      },
      retrievalPath: 'hybrid',
      buckets: [],
      stance: 'confident_neighborhood',
      counts: { total: 6, shown: 5 },
      isWideNeighborhood: false
    }

    const text = renderRecallFraming(facts, translate)
    expect(text).toContain('Around a few months ago,')
    expect(text).not.toContain('Within a few months ago,')
    expect(text).not.toContain('few_months_ago')
  })

  it('high 置信时间 Framing 仍用 Within', () => {
    const facts: RecallFramingCandidateFacts = {
      kind: 'candidates',
      understood: {
        objectTypes: [],
        contentTerms: [],
        behaviorHints: [],
        noteHint: false,
        timeLabel: 'last_week',
        timeConfidence: 'high'
      },
      retrievalPath: 'constraint_neighborhood',
      buckets: [],
      stance: 'confident_neighborhood',
      counts: { total: 4, shown: 4 },
      isWideNeighborhood: false
    }

    expect(renderRecallFraming(facts, translate)).toContain('Within last week,')
  })

  it('omitUnderstood 时跳过 P1，仍保留路径与计数', () => {
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

    const text = renderRecallFraming(facts, translate, { omitUnderstood: true })
    expect(text).not.toContain('Looking for')
    expect(text).toContain('These match the kind you pointed at.')
    expect(text).toContain('12 related')
  })

  it('missing_topic 只问一问缺主题，不带猜测免责句', () => {
    const text = renderRecallFraming({ kind: 'missing_topic' }, translate)
    expect(text).toBe('Tell me what topic it is about, and I will look.')
    expect(text).not.toContain('only a guess')
  })
})
