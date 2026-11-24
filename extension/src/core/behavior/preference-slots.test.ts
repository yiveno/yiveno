/**
 * 偏好算子：proposal 坏值、mapper 透传、merge 继承/覆盖。
 */

import { describe, expect, it } from 'vitest'

import { mergeParsedRecallClues } from '@/core/recall/merge-recall-dialog-turn'
import type { ParsedRecallClue } from '@/core/recall/parse-recall-clue-types'
import { LlmParsedClueProposalSchema } from '@/core/recall/understand/llm-parsed-clue-proposal'
import { mapLlmProposalToParsedClue } from '@/core/recall/understand/map-llm-proposal-to-parsed'

const NOW = Date.UTC(2026, 10, 24)

function baseParsed(overrides: Partial<ParsedRecallClue> = {}): ParsedRecallClue {
  return {
    raw: 'base',
    contentTerms: [],
    confidence: 'low',
    ...overrides
  }
}

describe('偏好算子 · proposal / mapper / merge', () => {
  it('proposal 坏值置空本字段，不丢整单', () => {
    const parsed = LlmParsedClueProposalSchema.parse({
      contentTerms: ['rag'],
      preferenceOperator: 'not_a_real_op',
      preferenceTarget: 'galaxy'
    })
    expect(parsed.preferenceOperator).toBeUndefined()
    expect(parsed.preferenceTarget).toBeUndefined()
    expect(parsed.contentTerms).toEqual(['rag'])
  })

  it('mapper 透传算子与 target，不做词面 grounding', () => {
    const mapped = mapLlmProposalToParsedClue(
      '我最喜欢的那个网站',
      {
        contentTerms: [],
        preferenceOperator: 'favorite',
        preferenceTarget: 'site',
        intent: 'recall'
      },
      NOW
    )
    expect(mapped.preferenceOperator).toBe('favorite')
    expect(mapped.preferenceTarget).toBe('site')
  })

  it('mapper：有算子无 target → 默认 site', () => {
    const mapped = mapLlmProposalToParsedClue(
      '我最常看的',
      {
        contentTerms: [],
        preferenceOperator: 'most_frequent',
        intent: 'recall'
      },
      NOW
    )
    expect(mapped.preferenceOperator).toBe('most_frequent')
    expect(mapped.preferenceTarget).toBe('site')
  })

  it('merge：本轮有算子则覆盖；无则继承', () => {
    const accumulated = baseParsed({
      preferenceOperator: 'favorite',
      preferenceTarget: 'site',
      raw: '我最喜欢的那个网站'
    })
    const inherited = mergeParsedRecallClues(
      accumulated,
      baseParsed({ raw: '换一个', contentTerms: [] }),
      '我最喜欢的那个网站 换一个'
    )
    expect(inherited.preferenceOperator).toBe('favorite')
    expect(inherited.preferenceTarget).toBe('site')

    const overridden = mergeParsedRecallClues(
      accumulated,
      baseParsed({
        raw: '最近总看的网站',
        preferenceOperator: 'recent_frequent',
        preferenceTarget: 'site'
      }),
      '最近总看的网站'
    )
    expect(overridden.preferenceOperator).toBe('recent_frequent')
  })
})
