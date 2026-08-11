import { describe, expect, it } from 'vitest'

import { parseRecallClue } from '@/core/recall/parse-recall-clue'
import { mapLlmFollowUpProposal } from '@/core/recall/understand/map-llm-follow-up-proposal'

const NOW_MS = Date.parse('2026-08-08T12:00:00.000Z')

describe('mapLlmFollowUpProposal', () => {
  it('通过门禁的追问保留 reply 与英文 chip value', () => {
    const parsed = parseRecallClue('the article about RAG', { nowMs: NOW_MS })
    const mapped = mapLlmFollowUpProposal(
      {
        reply: '这些最接近。还记得标题里哪个词吗？',
        chips: [
          { label: 'RAG', value: 'RAG' },
          { label: 'deploy', value: 'deploy' }
        ]
      },
      { parsed, outcome: 'need_a_clue' }
    )
    expect(mapped?.text).toContain('最接近')
    expect(mapped?.suggestions.map(item => item.value)).toEqual(['RAG', 'deploy'])
  })

  it('已有 objectTypes 时拒收类型问卷回复', () => {
    const parsed = parseRecallClue('the movie I watched yesterday', { nowMs: NOW_MS })
    const mapped = mapLlmFollowUpProposal(
      {
        reply: '我还没对上。你记得是文章、诗、代码，还是歌？',
        chips: [{ label: '文章', value: 'article' }]
      },
      { parsed, outcome: 'need_a_clue' }
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

  it('非法 chip.value 丢弃', () => {
    const parsed = parseRecallClue('Li Bai poem', { nowMs: NOW_MS })
    const mapped = mapLlmFollowUpProposal(
      {
        reply: '哪条标题更像？',
        chips: [{ label: '中文整句', value: '是不是昨天存的那篇' }]
      },
      { parsed, outcome: 'need_a_clue' }
    )
    expect(mapped?.suggestions).toEqual([])
  })

  it('拒收偏好建档 / 助理人设话术', () => {
    const parsed = parseRecallClue('我以前最喜欢听的歌', { nowMs: NOW_MS })
    expect(
      mapLlmFollowUpProposal(
        {
          reply: '不好意思，我还不了解你。你可以告诉我喜欢什么类型，我会记住的。',
          chips: []
        },
        { parsed, outcome: 'need_a_clue' }
      )
    ).toBeNull()
  })
})
