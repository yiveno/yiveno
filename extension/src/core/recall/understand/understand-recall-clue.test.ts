import { describe, expect, it } from 'vitest'

import type { LlmChatCompleter } from '@/core/recall/understand/parse-recall-clue-with-llm'
import {
  MAX_RECALL_CLUE_LENGTH,
  understandRecallClue
} from '@/core/recall/understand/understand-recall-clue'

describe('understandRecallClue', () => {
  it('纯 URL + completer → 仍走规则（省配额）', async () => {
    let called = 0
    const complete: LlmChatCompleter = async () => {
      called += 1
      return '{}'
    }
    const result = await understandRecallClue('https://example.com/a', { complete })
    expect(result.disposition).toBe('proceed')
    expect(result.mode).toBe('lexical')
    expect(result.source).toBe('rules')
    expect(called).toBe(0)
  })

  it('有 completer：短专名也走 LLM（默认听懂主路径）', async () => {
    let called = 0
    const complete: LlmChatCompleter = async () => {
      called += 1
      return JSON.stringify({
        timeLabel: null,
        objectTypes: null,
        contentTerms: ['cloudflare', 'workers'],
        confidence: 'high'
      })
    }
    const result = await understandRecallClue('Cloudflare Workers', { complete })
    expect(result.disposition).toBe('proceed')
    expect(result.mode).toBe('semantic')
    expect(result.source).toBe('llm')
    expect(called).toBe(1)
    expect(result.filterClue.toLowerCase()).toContain('cloudflare')
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
    expect(result.filterClue.split(/\s+/)).toEqual(
      expect.arrayContaining(['news', 'legal', 'case'])
    )
  })

  it('无 completer → 规则垫片（口语也 lexical，禁止伪 semantic）', async () => {
    const result = await understandRecallClue('The movie that I watched yesterday')
    expect(result.disposition).toBe('proceed')
    expect(result.mode).toBe('lexical')
    expect(result.source).toBe('rules')
  })

  it('short oral clue still goes semantic and calls LLM', async () => {
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
    const result = await understandRecallClue('the movie from day before yesterday', {
      complete
    })
    expect(result.disposition).toBe('proceed')
    expect(result.mode).toBe('semantic')
    expect(result.source).toBe('llm')
    expect(called).toBe(1)
    expect(result.parsed.timeRange?.label).toBe('day_before_yesterday')
  })

  it('网关拒绝噪音：不调 LLM，空 filterClue', async () => {
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
    expect(result.filterClue).toBe('')
    expect(result.parsed.contentTerms).toEqual([])
    expect(called).toBe(0)
  })

  it('completer AbortError → rules_fallback 仍 proceed', async () => {
    const complete: LlmChatCompleter = async () => {
      const err = new Error('The operation was aborted due to timeout')
      err.name = 'TimeoutError'
      throw err
    }
    const result = await understandRecallClue('that famous writer I saved', { complete })
    expect(result.disposition).toBe('proceed')
    expect(result.source).toBe('rules_fallback')
    expect(result.filterClue.length).toBeGreaterThan(0)
  })

  it('超长线索截断到 2000 字符并标记（规则路径）', async () => {
    // 前 2000 字符内放一个 Marker，2000 字符后放另一个；截断后只应见到前者
    const head = 'yesterday I read an article about memory. '.repeat(45) // 约 1980 字符
    const headMarker = 'headmarkerword'
    const tailMarker = 'tailmarkerword'
    const clue = `${head}${headMarker} ${'filler '.repeat(400)}${tailMarker}`
    expect(clue.length).toBeGreaterThan(MAX_RECALL_CLUE_LENGTH)

    const result = await understandRecallClue(clue)
    expect(result.clueTruncated).toBe(true)
    expect(result.parsed.raw.length).toBe(2000)
    expect(result.parsed.contentTerms).toContain(headMarker)
    expect(result.parsed.contentTerms).not.toContain(tailMarker)
  })

  it('正常长度线索不截断', async () => {
    const result = await understandRecallClue('昨天的诗')
    expect(result.clueTruncated).toBe(false)
    expect(result.parsed.raw).toBe('昨天的诗')
  })

  it('超长线索进 LLM 时 prompt 只含前 2000 字符', async () => {
    const seenMessages: Array<{ role: string; content: string }> = []
    const complete: LlmChatCompleter = async messages => {
      seenMessages.push(...messages)
      return JSON.stringify({
        timeLabel: null,
        objectTypes: null,
        contentTerms: ['article'],
        confidence: 'high'
      })
    }
    const headMarker = 'headmarkerword'
    const tailMarker = 'tailmarkerword'
    const clue = `${'yesterday article '.repeat(110)}${headMarker} ${'filler '.repeat(400)}${tailMarker}`
    expect(clue.length).toBeGreaterThan(MAX_RECALL_CLUE_LENGTH)

    // forceMode: 'semantic' 强制走 LLM（不依赖 mode 判定对超长文本的分类）
    const result = await understandRecallClue(clue, { complete, forceMode: 'semantic' })
    expect(result.clueTruncated).toBe(true)
    expect(result.source).toBe('llm')
    const promptText = seenMessages.map(m => m.content).join('\n')
    expect(promptText).toContain(headMarker)
    expect(promptText).not.toContain(tailMarker)
  })
})
