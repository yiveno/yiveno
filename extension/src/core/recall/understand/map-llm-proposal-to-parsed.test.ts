/**
 * R7：objectTypeOther 出口（只进 contentTerms，永不进 objectTypes 硬筛）。
 * 放在 understand/ 而非 eval/，避免抬高 test:must（eval 目录地板）。
 */
import { describe, expect, it } from 'vitest'

import { PARSE_GOLD_NOW_MS } from '@/core/recall/eval/parse-gold-now'
import { normalizeRecallText } from '@/core/recall/keyword-filter'
import { parseRecallClue } from '@/core/recall/parse-recall-clue'
import { buildLlmParseClueMessages } from '@/core/recall/understand/build-llm-parse-prompt'
import { LlmParsedClueProposalSchema } from '@/core/recall/understand/llm-parsed-clue-proposal'
import { mapLlmProposalToParsedClue } from '@/core/recall/understand/map-llm-proposal-to-parsed'

describe('mapLlmProposalToParsedClue · R7 objectTypeOther', () => {
  it.each([
    {
      clue: '昨天听的那个播客',
      other: '播客',
      expectedTerm: '播客'
    },
    {
      clue: '上周保存的菜谱',
      other: '菜谱',
      expectedTerm: '菜谱'
    },
    {
      clue: '前几天看的地图',
      other: '地图',
      expectedTerm: '地图'
    },
    {
      clue: '那段聊天记录',
      other: '聊天记录',
      expectedTerm: '聊天记录'
    },
    {
      clue: 'the podcast I saved yesterday',
      other: 'podcast',
      expectedTerm: 'podcast'
    },
    {
      clue: 'the recipe from last week',
      other: 'recipe',
      expectedTerm: 'recipe'
    }
  ] as const)(
    '未知类型出口：$clue → objectTypeOther 进 contentTerms、objectTypes 空',
    ({ clue, other, expectedTerm }) => {
      const parsed = mapLlmProposalToParsedClue(
        clue,
        {
          timeLabel: null,
          objectTypes: null,
          objectTypeOther: other,
          contentTerms: [],
          confidence: 'low'
        },
        PARSE_GOLD_NOW_MS
      )
      expect(parsed.objectTypes).toBeUndefined()
      expect(parsed.objectTypeOther).toBe(other)
      expect(parsed.contentTerms).toContain(expectedTerm)
    }
  )

  it('已知类型不受影响：昨天的诗 / yesterday poem → objectTypes 正常、other 空', () => {
    const zh = mapLlmProposalToParsedClue(
      '昨天的诗',
      {
        timeLabel: 'yesterday',
        objectTypes: ['poem'],
        contentTerms: [],
        confidence: 'low'
      },
      PARSE_GOLD_NOW_MS
    )
    expect(zh.objectTypes).toEqual(['poem'])
    expect(zh.objectTypeOther).toBeUndefined()
    expect(zh.timeRange?.label).toBe('yesterday')

    const en = mapLlmProposalToParsedClue(
      'yesterday poem',
      {
        timeLabel: 'yesterday',
        objectTypes: ['poem'],
        contentTerms: [],
        confidence: 'low'
      },
      PARSE_GOLD_NOW_MS
    )
    expect(en.objectTypes).toEqual(['poem'])
    expect(en.objectTypeOther).toBeUndefined()
    expect(en.timeRange?.label).toBe('yesterday')
  })

  it.each([
    {
      clue: '去年夏天看到的那篇文章',
      timeTerms: ['去年夏天']
    },
    {
      clue: '2024年3月存的页面',
      timeTerms: ['2024年3月']
    },
    {
      clue: '世界杯期间看的视频',
      timeTerms: ['世界杯']
    }
  ])(
    '时间不硬套：$clue → timeLabel 留空时 timeRange 空、时间表达在 contentTerms',
    ({ clue, timeTerms }) => {
      // 时间出口 = prompt-only：模型按指示留空 timeLabel 时，不得捏造硬筛窗
      const honest = mapLlmProposalToParsedClue(
        clue,
        {
          timeLabel: null,
          objectTypes: null,
          contentTerms: [...timeTerms],
          confidence: 'low'
        },
        PARSE_GOLD_NOW_MS
      )
      expect(honest.timeRange).toBeUndefined()
      for (const term of timeTerms) {
        expect(honest.contentTerms).toContain(normalizeRecallText(term))
      }
    }
  )

  it('独立公历年份 token：模型瞎猜 long_ago 仍被 grounding 拒绝', () => {
    // 既有年份门只认独立四位数字 token；中文粘连「2024年…」不在本批修补范围
    const parsed = mapLlmProposalToParsedClue(
      'the page I saved in March 2024',
      {
        timeLabel: 'long_ago',
        objectTypes: null,
        contentTerms: ['march', '2024'],
        confidence: 'low'
      },
      PARSE_GOLD_NOW_MS
    )
    expect(parsed.timeRange).toBeUndefined()
    expect(parsed.contentTerms).toContain('2024')
  })

  it('组合：昨天听的播客 → yesterday + objectTypeOther=播客 共存', () => {
    const parsed = mapLlmProposalToParsedClue(
      '昨天听的播客',
      {
        timeLabel: 'yesterday',
        objectTypes: null,
        objectTypeOther: '播客',
        contentTerms: [],
        confidence: 'low'
      },
      PARSE_GOLD_NOW_MS
    )
    expect(parsed.timeRange?.label).toBe('yesterday')
    expect(parsed.objectTypes).toBeUndefined()
    expect(parsed.objectTypeOther).toBe('播客')
    expect(parsed.contentTerms).toContain('播客')
  })

  it('边界：objectTypeOther 超长 → 置空本字段不丢整单；与 objectTypes 可并存', () => {
    const overlong = '播客'.repeat(30) // >40
    const dropped = mapLlmProposalToParsedClue(
      '昨天听的那个播客',
      {
        timeLabel: 'yesterday',
        objectTypes: null,
        objectTypeOther: overlong,
        contentTerms: ['记忆'],
        confidence: 'low'
      },
      PARSE_GOLD_NOW_MS
    )
    expect(dropped.objectTypeOther).toBeUndefined()
    expect(dropped.timeRange?.label).toBe('yesterday')
    expect(dropped.contentTerms).toContain('记忆')
    expect(dropped.contentTerms.some(term => term.includes('播客'.repeat(2)))).toBe(false)

    // 模型既猜了枚举又填了 other：grounding 按词面取舍；other 仍进 contentTerms
    const both = mapLlmProposalToParsedClue(
      '昨天听的那个播客',
      {
        timeLabel: 'yesterday',
        objectTypes: ['video'],
        objectTypeOther: '播客',
        contentTerms: [],
        confidence: 'low'
      },
      PARSE_GOLD_NOW_MS
    )
    // 「播客」无 video 词面 → objectTypes 被 grounding 剥掉
    expect(both.objectTypes).toBeUndefined()
    expect(both.objectTypeOther).toBe('播客')
    expect(both.contentTerms).toContain('播客')
    expect(both.timeRange?.label).toBe('yesterday')
  })

  it('规则路径不产 objectTypeOther', () => {
    const rules = parseRecallClue('昨天听的那个播客', { nowMs: PARSE_GOLD_NOW_MS })
    expect(rules.objectTypeOther).toBeUndefined()
  })
})

describe('R7 · objectTypeOther schema / prompt 出口', () => {
  it('proposal schema：超长 / 非字符串 → 置空本字段，其余保留', () => {
    const overlong = LlmParsedClueProposalSchema.parse({
      timeLabel: 'yesterday',
      objectTypes: null,
      objectTypeOther: 'x'.repeat(41),
      contentTerms: ['keep'],
      confidence: 'low'
    })
    expect(overlong.objectTypeOther).toBeUndefined()
    expect(overlong.timeLabel).toBe('yesterday')
    expect(overlong.contentTerms).toEqual(['keep'])

    const badType = LlmParsedClueProposalSchema.parse({
      timeLabel: null,
      objectTypes: null,
      objectTypeOther: 12 as unknown as string,
      contentTerms: ['ok'],
      confidence: 'low'
    })
    expect(badType.objectTypeOther).toBeUndefined()
    expect(badType.contentTerms).toEqual(['ok'])
  })

  it('prompt 含对象类型与时间出口指示', () => {
    const system = buildLlmParseClueMessages('clue').find(m => m.role === 'system')?.content ?? ''
    expect(system).toContain('objectTypeOther')
    expect(system).toMatch(/do NOT guess the closest enum/i)
    expect(system).toMatch(/absolute date|season|event/i)
    expect(system).toMatch(/leave timeLabel null/i)
  })
})
