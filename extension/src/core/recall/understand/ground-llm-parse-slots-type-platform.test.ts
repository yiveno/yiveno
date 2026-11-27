/**
 * 对象类型过抽收敛 + 平台/渠道 terms 保留（Stage 1 夜跑 follow-up）。
 */
import { describe, expect, it } from 'vitest'

import { PARSE_GOLD_NOW_MS } from '../../../../tests/eval/parse-gold-now'
import {
  clueHasObjectTypeFormUncertainty,
  groundObjectTypes,
  preservePlatformChannelTerms
} from '@/core/recall/understand/ground-llm-parse-slots'
import { mapLlmProposalToParsedClue } from '@/core/recall/understand/map-llm-proposal-to-parsed'

describe('groundObjectTypes · 形式证据强弱', () => {
  it('弱证据：前端「页面」/「网页里的内容」不标 page', () => {
    expect(
      groundObjectTypes('之前看过一个解决前端页面性能问题的方案，让页面先显示大概的东西', ['page'])
    ).toBeUndefined()
    expect(
      groundObjectTypes('可以把网页里面重要的内容直接保存下来，不是简单的收藏网址', ['page'])
    ).toBeUndefined()
  })

  it('形式不确定：可能是视频也可能是文章 → 整槽留空，不堆叠', () => {
    const clue =
      '我之前看过一个东西，可能是视频也可能是文章，讲一个人每天只工作几个小时，背景音乐有点像电影配乐'
    expect(clueHasObjectTypeFormUncertainty(clue)).toBe(true)
    expect(groundObjectTypes(clue, ['video', 'article', 'song'])).toBeUndefined()
  })

  it('强证据：明确形式词仍正常标型', () => {
    expect(groundObjectTypes('之前那个鸡胸肉视频', ['video'])).toEqual(['video'])
    expect(groundObjectTypes('昨天存的那篇文章', undefined)).toEqual(['article'])
    expect(groundObjectTypes('上周听的那首歌曲', ['song'])).toEqual(['song'])
  })

  it('强 page：网站 / website 可标 page', () => {
    expect(groundObjectTypes('我常去的那个网站', ['page'])).toEqual(['page'])
    expect(groundObjectTypes('that website about caching', ['page'])).toEqual(['page'])
  })
})

describe('preservePlatformChannelTerms · 平台/渠道表面', () => {
  it.each([
    { clue: '我之前在公众号看到一个观点', term: '公众号' },
    { clue: '可能是在抖音也可能是小红书', terms: ['抖音', '小红书'] },
    { clue: 'B站上看的那个讲解', term: 'b站' },
    { clue: '知乎收藏的回答', term: '知乎' },
    { clue: 'saw it on YouTube last week', term: 'youtube' },
    { clue: 'douyin and xiaohongshu both had it', terms: ['douyin', 'xiaohongshu'] }
  ] as const)('clue 出现平台名 → 补进 terms：$clue', row => {
    const preserved = preservePlatformChannelTerms(row.clue, ['主题词'])
    expect(preserved).toContain('主题词')
    if ('term' in row) {
      expect(preserved).toContain(row.term)
    } else {
      for (const term of row.terms) {
        expect(preserved).toContain(term)
      }
    }
  })

  it('线索未出现的平台名不发明', () => {
    expect(preservePlatformChannelTerms('讲时间价值的观点', [])).toEqual([])
  })
})

describe('mapLlmProposalToParsedClue · 平台补回与类型收敛', () => {
  it('模型漏抽公众号 → 仍进 contentTerms', () => {
    const parsed = mapLlmProposalToParsedClue(
      '我之前在公众号看到一个观点，意思是不要把自己的时间卖得太便宜',
      {
        timeLabel: 'a_while_ago',
        objectTypes: null,
        contentTerms: ['时间', '不可再生', '观点'],
        confidence: 'medium'
      },
      PARSE_GOLD_NOW_MS
    )
    expect(parsed.contentTerms).toContain('公众号')
  })

  it('抖音/小红书漏抽 → 补回；形式不明不标 type', () => {
    const clue = '可能是在抖音也可能是小红书，讲人为什么晚上总是想很多事情，具体形式不明'
    const parsed = mapLlmProposalToParsedClue(
      clue,
      {
        timeLabel: null,
        objectTypes: ['video', 'article'],
        contentTerms: ['晚上', '想', '事情'],
        confidence: 'low'
      },
      PARSE_GOLD_NOW_MS
    )
    expect(parsed.contentTerms).toEqual(expect.arrayContaining(['抖音', '小红书']))
    expect(parsed.objectTypes).toBeUndefined()
  })

  it('弱 page 提议被剥掉；强视频保留', () => {
    const weak = mapLlmProposalToParsedClue(
      '解决前端页面性能的那个方案',
      {
        timeLabel: null,
        objectTypes: ['page'],
        contentTerms: ['前端', '性能'],
        confidence: 'low'
      },
      PARSE_GOLD_NOW_MS
    )
    expect(weak.objectTypes).toBeUndefined()

    const strong = mapLlmProposalToParsedClue(
      '之前那个鸡胸肉视频',
      {
        timeLabel: 'a_while_ago',
        objectTypes: ['video'],
        contentTerms: ['鸡胸肉'],
        confidence: 'high'
      },
      PARSE_GOLD_NOW_MS
    )
    expect(strong.objectTypes).toEqual(['video'])
  })
})
