import { describe, expect, it } from 'vitest'

import { understandRecallClue } from '@/core/recall/understand/understand-recall-clue'
import type { LlmChatCompleter } from '@/core/recall/understand/parse-recall-clue-with-llm'

describe('understandRecallClue', () => {
  it('lexical 不调 LLM', async () => {
    let called = 0
    const complete: LlmChatCompleter = async () => {
      called += 1
      return '{}'
    }
    const result = await understandRecallClue('Cloudflare Workers', { complete })
    expect(result.disposition).toBe('proceed')
    expect(result.mode).toBe('lexical')
    expect(result.source).toBe('rules')
    expect(called).toBe(0)
    expect(result.searchClue.toLowerCase()).toContain('cloudflare')
  })

  it('semantic + LLM → 精确 contentTerms', async () => {
    const complete: LlmChatCompleter = async () =>
      JSON.stringify({
        timeLabel: 'recent',
        objectTypes: ['article'],
        contentTerms: ['news', 'legal', 'case'],
        confidence: 'medium'
      })

    const result = await understandRecallClue(
      "I recently came across a news article about a legal case. I've forgotten the details.",
      { complete }
    )
    expect(result.disposition).toBe('proceed')
    expect(result.mode).toBe('semantic')
    expect(result.source).toBe('llm')
    expect(result.parsed.objectTypes).toEqual(['article'])
    expect(result.parsed.contentTerms).toEqual(expect.arrayContaining(['news', 'legal', 'case']))
    expect(result.searchClue.split(/\s+/)).toEqual(
      expect.arrayContaining(['news', 'legal', 'case'])
    )
  })

  it('semantic 无 completer → 规则', async () => {
    const result = await understandRecallClue('The movie that I watched yesterday')
    expect(result.disposition).toBe('proceed')
    expect(result.mode).toBe('semantic')
    expect(result.source).toBe('rules')
  })

  it('中文短口语 → semantic 并调用 LLM', async () => {
    let called = 0
    const complete: LlmChatCompleter = async () => {
      called += 1
      return JSON.stringify({
        timeLabel: 'day_before_yesterday',
        objectTypes: null,
        contentTerms: ['movie'],
        confidence: 'medium'
      })
    }
    const result = await understandRecallClue('前天的电影', { complete })
    expect(result.disposition).toBe('proceed')
    expect(result.mode).toBe('semantic')
    expect(result.source).toBe('llm')
    expect(called).toBe(1)
    expect(result.parsed.timeRange?.label).toBe('day_before_yesterday')
  })

  it('网关拒绝噪音：不调 LLM，空 searchClue', async () => {
    let called = 0
    const complete: LlmChatCompleter = async () => {
      called += 1
      return '{}'
    }
    const result = await understandRecallClue('alsjdlkasjdweq;lkaskdl;aksd;lasd;hasjldhaksd', {
      complete
    })
    expect(result.disposition).toBe('reject_noise')
    expect(result.rejectReason).toBe('keyboard_mash')
    expect(result.source).toBe('rejected_noise')
    expect(result.searchClue).toBe('')
    expect(result.parsed.contentTerms).toEqual([])
    expect(called).toBe(0)
  })
})
