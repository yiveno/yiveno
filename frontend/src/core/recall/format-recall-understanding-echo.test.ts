import { describe, expect, it } from 'vitest'

import {
  formatRecallUnderstandingEchoChips,
  recallUnderstandingEchoSourceFromParsed
} from '@/core/recall/format-recall-understanding-echo'
import type { ParsedRecallClue } from '@/core/recall/parse-recall-clue-types'

const translate = (key: string, subs?: string | string[]) => {
  const table: Record<string, string> = {
    framing_object_video: 'video',
    framing_object_article: 'article',
    framing_time_yesterday: 'yesterday',
    framing_time_a_while_ago: 'a while ago',
    popup_recall_echo_time_soft: '~$1',
    popup_recall_echo_behavior_recently_saved: 'just saved',
    popup_recall_echo_note: 'note',
    popup_recall_echo_term: '“$1”'
  }
  let text = table[key] ?? key
  const values = subs === undefined ? [] : Array.isArray(subs) ? subs : [subs]
  values.forEach((value, index) => {
    text = text.split(`$${index + 1}`).join(value)
  })
  return text
}

describe('formatRecallUnderstandingEchoChips', () => {
  it('无槽位则空', () => {
    expect(
      formatRecallUnderstandingEchoChips(
        {
          objectTypes: [],
          contentTerms: [],
          behaviorHints: [],
          noteHint: false
        },
        translate
      )
    ).toEqual([])
  })

  it('按类型→时间→行为→附注→内容词排序；low 时间加 ~', () => {
    const chips = formatRecallUnderstandingEchoChips(
      {
        objectTypes: ['video'],
        timeLabel: 'a_while_ago',
        timeConfidence: 'low',
        behaviorHints: ['recently_saved'],
        noteHint: true,
        contentTerms: ['retention', 'deploy', 'extra', 'dropped']
      },
      translate
    )
    expect(chips).toEqual([
      'video',
      '~a while ago',
      'just saved',
      'note',
      '“retention”',
      '“deploy”',
      '“extra”'
    ])
    expect(chips.join(' ')).not.toContain('a_while_ago')
  })

  it('high 时间不加 ~', () => {
    expect(
      formatRecallUnderstandingEchoChips(
        {
          objectTypes: ['article'],
          timeLabel: 'yesterday',
          timeConfidence: 'high',
          contentTerms: [],
          behaviorHints: [],
          noteHint: false
        },
        translate
      )
    ).toEqual(['article', 'yesterday'])
  })
})

describe('recallUnderstandingEchoSourceFromParsed', () => {
  it('从 Parsed 抽槽；空 parsed 返回 null', () => {
    expect(recallUnderstandingEchoSourceFromParsed(null)).toBeNull()
    const parsed: ParsedRecallClue = {
      raw: 'that video yesterday',
      objectTypes: ['video'],
      timeRange: {
        label: 'yesterday',
        from: '2026-01-01T00:00:00.000Z',
        to: '2026-01-02T00:00:00.000Z'
      },
      timeConfidence: 'high',
      contentTerms: [],
      confidence: 'high'
    }
    expect(recallUnderstandingEchoSourceFromParsed(parsed)).toEqual({
      objectTypes: ['video'],
      contentTerms: [],
      behaviorHints: [],
      noteHint: false,
      timeLabel: 'yesterday',
      timeConfidence: 'high'
    })
  })
})
