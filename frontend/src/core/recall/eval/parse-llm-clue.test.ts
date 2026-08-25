import { describe, expect, it } from 'vitest'

import { compareParseGoldWithLlm } from '@/core/recall/eval/compare-parse-gold'
import {
  extractJsonObjectText,
  parseJsonObjectFromLlmText
} from '@/core/recall/understand/extract-llm-json'
import { mapLlmProposalToParsedClue } from '@/core/recall/understand/map-llm-proposal-to-parsed'
import { PARSE_GOLD_NOW_MS } from '@/core/recall/eval/parse-gold-now'
import { parseRecallClueWithLlm } from '@/core/recall/understand/parse-recall-clue-with-llm'
import type { LlmChatCompleter } from '@/core/recall/understand/parse-recall-clue-with-llm'

describe('extract-llm-json', () => {
  it('剥 markdown 围栏', () => {
    expect(extractJsonObjectText('```json\n{"a":1}\n```')).toBe('{"a":1}')
  })

  it('从前后废话中取对象', () => {
    expect(
      parseJsonObjectFromLlmText('Here you go:\n{"contentTerms":[],"confidence":"low"}\n')
    ).toEqual({
      contentTerms: [],
      confidence: 'low'
    })
  })
})

describe('mapLlmProposalToParsedClue', () => {
  it('timeLabel → 确定性 timeRange；短语 contentTerms 拆 token', () => {
    const parsed = mapLlmProposalToParsedClue(
      'yesterday poem',
      {
        timeLabel: 'yesterday',
        objectTypes: ['poem'],
        contentTerms: ['Li Bai'],
        confidence: 'low'
      },
      PARSE_GOLD_NOW_MS
    )
    expect(parsed.timeRange?.label).toBe('yesterday')
    expect(parsed.objectTypes).toEqual(['poem'])
    expect(parsed.contentTerms).toEqual(['li', 'bai'])
    // 忽略模型 confidence：time+type+content → high
    expect(parsed.confidence).toBe('high')
  })

  it('刚存书签：模型漏槽+虚词残留仍落到约束邻域槽位', () => {
    const parsed = mapLlmProposalToParsedClue(
      'just saved bookmark',
      {
        timeLabel: null,
        objectTypes: null,
        behaviorHints: null,
        contentTerms: ['just', 'saved', 'bookmark'],
        confidence: 'low'
      },
      PARSE_GOLD_NOW_MS
    )
    expect(parsed.objectTypes).toEqual(['bookmark'])
    expect(parsed.behaviorHints).toEqual(['recently_saved'])
    expect(parsed.contentTerms).toEqual([])
  })

  it('无内容词时 confidence 与规则一致为 medium', () => {
    const parsed = mapLlmProposalToParsedClue(
      'the song I played on repeat yesterday',
      {
        timeLabel: 'yesterday',
        objectTypes: ['song'],
        behaviorHints: ['often_opened'],
        contentTerms: [],
        confidence: 'high'
      },
      PARSE_GOLD_NOW_MS
    )
    expect(parsed.confidence).toBe('medium')
  })

  it('无词面支撑的 recently_saved / 臆造类型会被剥掉', () => {
    const onlyTime = mapLlmProposalToParsedClue(
      'yesterday saved that',
      {
        timeLabel: 'yesterday',
        behaviorHints: ['recently_saved'],
        contentTerms: [],
        confidence: 'high'
      },
      PARSE_GOLD_NOW_MS
    )
    expect(onlyTime.behaviorHints).toBeUndefined()
    expect(onlyTime.confidence).toBe('low')

    const bareProduct = mapLlmProposalToParsedClue(
      'Cloudflare Workers',
      {
        objectTypes: ['code'],
        contentTerms: ['cloudflare workers'],
        confidence: 'medium'
      },
      PARSE_GOLD_NOW_MS
    )
    expect(bareProduct.objectTypes).toBeUndefined()
    expect(bareProduct.contentTerms).toEqual(['cloudflare', 'workers'])
    expect(bareProduct.confidence).toBe('low')
  })

  it('公历年份（1954）不得被 LLM 误采纳为 long_ago timeLabel', () => {
    const parsed = mapLlmProposalToParsedClue(
      'Gregory Peck million pound note 1954',
      {
        timeLabel: 'long_ago',
        objectTypes: null,
        behaviorHints: null,
        contentTerms: ['gregory', 'peck', 'million', 'pound', 'note', '1954'],
        confidence: 'medium'
      },
      PARSE_GOLD_NOW_MS
    )
    expect(parsed.timeRange).toBeUndefined()
    expect(parsed.contentTerms).toEqual(
      expect.arrayContaining(['gregory', 'peck', 'million', 'pound', '1954'])
    )
    expect(parsed.contentTerms).not.toContain('note')
  })

  it('verse 别名可支撑 poem，并从 contentTerms 剥离', () => {
    const parsed = mapLlmProposalToParsedClue(
      'that Li Bai verse from the other day',
      {
        timeLabel: 'a_while_ago',
        objectTypes: ['poem'],
        contentTerms: ['li', 'bai', 'verse', 'from'],
        confidence: 'low'
      },
      PARSE_GOLD_NOW_MS
    )
    expect(parsed.objectTypes).toEqual(['poem'])
    expect(parsed.contentTerms).toEqual(['li', 'bai'])
    expect(parsed.confidence).toBe('high')
  })
})

describe('parseRecallClueWithLlm + compare（mock）', () => {
  it('mock 补全能抬升 stretch verse 用例且不回归 must 子集', async () => {
    const complete: LlmChatCompleter = async messages => {
      const user = messages.find(item => item.role === 'user')?.content ?? ''
      const clue = user.replace(/^Clue:\n/, '')

      if (clue.includes('verse')) {
        return JSON.stringify({
          timeLabel: 'a_while_ago',
          objectTypes: ['poem'],
          behaviorHints: null,
          noteHint: false,
          contentTerms: ['li', 'bai'],
          confidence: 'high'
        })
      }

      // 其余：尽量贴合规则已会的槽位（测 harness，非真模型能力）
      if (clue === 'yesterday saved a poem about Li Bai') {
        return JSON.stringify({
          timeLabel: 'yesterday',
          objectTypes: ['poem'],
          contentTerms: ['li', 'bai'],
          confidence: 'high'
        })
      }

      return JSON.stringify({
        timeLabel: null,
        objectTypes: null,
        contentTerms: [],
        confidence: 'low'
      })
    }

    const subset = [
      {
        id: 'p0-time-type-entity-li-bai',
        clue: 'yesterday saved a poem about Li Bai',
        gate: 'must' as const,
        expect: {
          timeLabel: 'yesterday' as const,
          objectTypes: ['poem' as const],
          contentTermsMustInclude: ['li', 'bai'],
          contentTermsExact: true,
          confidence: 'high' as const
        },
        note: 'subset must'
      },
      {
        id: 'stretch-verse-as-poem',
        clue: 'that Li Bai verse from the other day',
        gate: 'stretch' as const,
        expect: {
          timeLabel: 'a_while_ago' as const,
          objectTypes: ['poem' as const],
          contentTermsMustInclude: ['li', 'bai'],
          contentTermsMustExclude: ['verse'],
          confidence: 'high' as const
        },
        note: 'subset stretch'
      }
    ]

    const parsed = await parseRecallClueWithLlm(subset[1]!.clue, { complete })
    expect(parsed.objectTypes).toEqual(['poem'])
    expect(parsed.contentTerms).toEqual(['li', 'bai'])

    const report = await compareParseGoldWithLlm({ cases: subset, complete })
    expect(report.stretchLiftedByLlm).toContain('stretch-verse-as-poem')
    expect(report.mustRegressedByLlm).toEqual([])
    expect(report.llm.must.passed).toBe(1)
  })
})
