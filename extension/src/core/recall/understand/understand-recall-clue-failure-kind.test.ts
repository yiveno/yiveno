import { describe, expect, it, vi } from 'vitest'

import { HostedCompleteError } from '@/core/recall/understand/clue-llm-failure-kind'
import { understandRecallClue } from '@/core/recall/understand/understand-recall-clue'

describe('understandRecallClue · rules_fallback 失败 kind 透传', () => {
  it('completer 抛 HostedCompleteError → source=rules_fallback 且 kind 透传', async () => {
    const complete = vi.fn(async () => {
      throw new HostedCompleteError('network', 'hosted_complete_network')
    })
    const result = await understandRecallClue('that poem about libraries', {
      complete,
      skipNoiseGateway: true
    })
    expect(result.source).toBe('rules_fallback')
    expect(result.understandErrorKind).toBe('network')
    expect(result.understandQuota).toBeUndefined()
  })

  it('completer 抛配额 typed error → 附带 understandQuota', async () => {
    const complete = vi.fn(async () => {
      throw new HostedCompleteError('quota_daily', 'daily_cap_exceeded', {
        status: 429,
        quota: { used: 10, limit: 30, dailyUsed: 20, dailyLimit: 20 }
      })
    })
    const result = await understandRecallClue('bookmark about coffee', {
      complete,
      skipNoiseGateway: true
    })
    expect(result.source).toBe('rules_fallback')
    expect(result.understandErrorKind).toBe('quota_daily')
    expect(result.understandQuota).toEqual({
      used: 10,
      limit: 30,
      dailyUsed: 20,
      dailyLimit: 20
    })
  })

  it('completer 抛普通 Error → kind=unknown', async () => {
    const complete = vi.fn(async () => {
      throw new Error('unexpected')
    })
    const result = await understandRecallClue('article about caching', {
      complete,
      skipNoiseGateway: true
    })
    expect(result.source).toBe('rules_fallback')
    expect(result.understandErrorKind).toBe('unknown')
  })

  it('无 completer → source=rules，无 understandErrorKind', async () => {
    const result = await understandRecallClue('youtube', { skipNoiseGateway: true })
    expect(result.source).toBe('rules')
    expect(result.understandErrorKind).toBeUndefined()
  })
})
