import { beforeEach, describe, expect, it } from 'vitest'

import {
  formatRankedReplyText,
  resolveListReplyText
} from '@/pages/sidepanel/recall-result-card-helpers'
import { setUiLocaleCatalogForTests } from '@/infrastructure/i18n/t'
import type { RecallFramingCandidateFacts } from '@/core/recall/recall-framing-facts'
import type { RecallResult } from '@/core/recall/recall-result'
import type { BehaviorPreferenceRankingMeta } from '@/core/behavior/build-behavior-preference-result'

describe('formatRankedReplyText', () => {
  beforeEach(() => {
    setUiLocaleCatalogForTests('en', {
      popup_reply_confident: { message: 'Here’s what fits best in your library:' },
      popup_reply_ranked_all: {
        message: '$total$ related items:',
        placeholders: { total: { content: '$1' } }
      },
      popup_reply_ranked_partial: {
        message: '$total$ related · showing $from$–$to$:',
        placeholders: {
          total: { content: '$1' },
          from: { content: '$2' },
          to: { content: '$3' }
        }
      },
      popup_reply_ranked_weak_all: {
        message: '$total$ weak matches:',
        placeholders: { total: { content: '$1' } }
      },
      popup_reply_ranked_weak_partial: {
        message: '$total$ weak matches · showing $from$–$to$:',
        placeholders: {
          total: { content: '$1' },
          from: { content: '$2' },
          to: { content: '$3' }
        }
      }
    })
  })

  it('need_a_clue 走弱版 partial / all', () => {
    expect(formatRankedReplyText(12, 5, 'need_a_clue')).toBe('12 weak matches · showing 1–5:')
    expect(formatRankedReplyText(4, 4, 'need_a_clue')).toBe('4 weak matches:')
  })

  it('top_pick / 默认仍走普通版', () => {
    expect(formatRankedReplyText(12, 5, 'top_pick')).toBe('12 related · showing 1–5:')
    expect(formatRankedReplyText(12, 5)).toBe('12 related · showing 1–5:')
    expect(formatRankedReplyText(4, 4, 'top_pick')).toBe('4 related items:')
  })
})

describe('resolveListReplyText', () => {
  const genericP2 = 'Ranked by the wording in what you saved.'
  const genericP4 = 'This looks like a good place to start.'
  const behaviorBaseline = 'I’d look at github.com. Visited 42 times; last visit yesterday.'

  const candidateFacts: RecallFramingCandidateFacts = {
    kind: 'candidates',
    understood: {
      objectTypes: ['page'],
      contentTerms: [],
      behaviorHints: [],
      noteHint: false
    },
    retrievalPath: 'literal',
    buckets: [],
    stance: 'confident_neighborhood',
    counts: { total: 3, shown: 3 },
    isWideNeighborhood: false
  }

  const behaviorMeta: BehaviorPreferenceRankingMeta = {
    operator: 'most_frequent',
    target: 'site',
    candidates: [
      {
        domain: 'github.com',
        url: 'https://github.com/',
        visitCount: 42,
        lastVisitTime: Date.now() - 86_400_000
      }
    ],
    shownOffset: 0
  }

  beforeEach(() => {
    setUiLocaleCatalogForTests('en', {
      framing_list_sep: { message: ', ' },
      framing_p1_object_types: {
        message: 'Looking for $1 in your library.',
        placeholders: { types: { content: '$1' } }
      },
      framing_object_page: { message: 'page' },
      framing_p2_literal: { message: genericP2 },
      framing_p4_confident: { message: genericP4 },
      framing_p6_all: {
        message: '$1 related items:',
        placeholders: { total: { content: '$1' } }
      },
      popup_reply_ranked_all: {
        message: '$total$ related items:',
        placeholders: { total: { content: '$1' } }
      }
    })
  })

  it('行为 top_pick：优先用 recallFraming.text（含 top1 域名与访问次数），不从 facts 重渲通用 P2+P4', () => {
    const result: RecallResult = {
      outcome: 'top_pick',
      topPick: null,
      alsoPossible: [],
      totalRankedCount: 3,
      clue: 'sites I visit most',
      behaviorPreference: behaviorMeta,
      recallFraming: {
        source: 'rules',
        text: behaviorBaseline,
        facts: candidateFacts
      }
    }

    const { text } = resolveListReplyText(result, 3, 3, 'fallback', {
      omitUnderstood: true,
      omitCounts: true
    })

    expect(text).toContain('github.com')
    expect(text).toContain('42')
    expect(text).not.toBe(`${genericP2} ${genericP4}`)
    expect(text).toContain(behaviorBaseline)
  })

  it('非行为 top_pick：仍从 facts 渲染（回归）', () => {
    const result: RecallResult = {
      outcome: 'top_pick',
      topPick: null,
      alsoPossible: [],
      totalRankedCount: 3,
      clue: 'that page',
      recallFraming: {
        source: 'rules',
        text: 'should-not-win-when-facts-present',
        facts: candidateFacts
      }
    }

    const { text } = resolveListReplyText(result, 3, 3, 'fallback', {
      omitUnderstood: true,
      omitCounts: true
    })

    expect(text).toContain(genericP2)
    expect(text).toContain(genericP4)
    expect(text).not.toContain('should-not-win-when-facts-present')
  })
})
