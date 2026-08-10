import { describe, expect, it } from 'vitest'

import { parseRecallClue } from '@/core/recall/parse-recall-clue'
import { mapLlmFollowUpProposal } from '@/core/recall/understand/map-llm-follow-up-proposal'

const NOW_MS = Date.parse('2026-08-08T12:00:00.000Z')

describe('mapLlmFollowUpProposal', () => {
  it('通过门禁的追问保留 reply 与英文 chip value', () => {
    const parsed = parseRecallClue('the movie I watched yesterday', { nowMs: NOW_MS })
    const mapped = mapLlmFollowUpProposal(
      {
        reply: '记忆库里没有昨天存的影视频道。若日期可能记错，可以换个时间再试。',
        chips: [
          { label: '上周', value: 'last week' },
          { label: '最近', value: 'recently' }
        ]
      },
      { parsed, outcome: 'no_match', emptyKind: 'constrained_none' }
    )
    expect(mapped?.text).toContain('记忆库')
    expect(mapped?.suggestions.map(item => item.value)).toEqual(['last week', 'recently'])
  })

  it('已有 objectTypes 时拒收类型问卷回复', () => {
    const parsed = parseRecallClue('the movie I watched yesterday', { nowMs: NOW_MS })
    const mapped = mapLlmFollowUpProposal(
      {
        reply: '我还没对上。你记得是文章、诗、代码，还是歌？',
        chips: [{ label: '文章', value: 'article' }]
      },
      { parsed, outcome: 'no_match' }
    )
    expect(mapped).toBeNull()
  })

  it('已有 objectTypes 时过滤类型芯片但仍可保留合法回复', () => {
    const parsed = parseRecallClue('the movie I watched yesterday', { nowMs: NOW_MS })
    const mapped = mapLlmFollowUpProposal(
      {
        reply: '还记得标题里的某个词吗？',
        chips: [
          { label: '文章', value: 'article' },
          { label: '刚存的', value: 'just saved' }
        ]
      },
      { parsed, outcome: 'need_a_clue' }
    )
    expect(mapped?.suggestions.map(item => item.value)).toEqual(['just saved'])
  })

  it('约束空时丢弃非时间芯片', () => {
    const parsed = parseRecallClue('the movie I watched yesterday', { nowMs: NOW_MS })
    const mapped = mapLlmFollowUpProposal(
      {
        reply: '库里没有符合该时间与类型的痕迹。',
        chips: [
          { label: '网站', value: 'from this site' },
          { label: '前天', value: 'day before yesterday' }
        ]
      },
      { parsed, outcome: 'no_match', emptyKind: 'constrained_none' }
    )
    expect(mapped?.suggestions.map(item => item.value)).toEqual(['day before yesterday'])
  })

  it('非法 chip.value 丢弃', () => {
    const parsed = parseRecallClue('Li Bai poem', { nowMs: NOW_MS })
    const mapped = mapLlmFollowUpProposal(
      {
        reply: '大概是哪天存的？',
        chips: [{ label: '中文整句', value: '是不是昨天存的那篇' }]
      },
      { parsed, outcome: 'need_a_clue' }
    )
    expect(mapped?.suggestions).toEqual([])
  })
})
