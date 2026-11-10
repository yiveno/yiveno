import { beforeEach, describe, expect, it } from 'vitest'

import { formatRankedReplyText } from '@/pages/sidepanel/recall-result-card-helpers'
import { setUiLocaleCatalogForTests } from '@/infrastructure/i18n/t'

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
