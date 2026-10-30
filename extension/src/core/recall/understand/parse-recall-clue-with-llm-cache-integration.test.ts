import { describe, expect, it } from 'vitest'

import { clearLlmParseCache } from '@/core/recall/understand/llm-parse-cache'
import { parseRecallClueWithLlm } from '@/core/recall/understand/parse-recall-clue-with-llm'
import type { LlmChatCompleter } from '@/core/recall/understand/parse-recall-clue-with-llm'

describe('parseRecallClueWithLlm cache integration', () => {
  it('同 clue 第二次调用跳过 LLM', async () => {
    clearLlmParseCache()
    let calls = 0
    const complete: LlmChatCompleter = async () => {
      calls += 1
      return JSON.stringify({
        timeLabel: null,
        objectTypes: null,
        contentTerms: ['cloudflare', 'workers'],
        confidence: 'high'
      })
    }
    const r1 = await parseRecallClueWithLlm('Cloudflare Workers', { complete })
    const r2 = await parseRecallClueWithLlm('cloudflare workers', { complete })
    expect(calls).toBe(1)
    expect(r2.contentTerms).toEqual(r1.contentTerms)
    expect(r2.confidence).toBe(r1.confidence)
  })

  it('useCache:false 时同 clue 每次都打 LLM', async () => {
    clearLlmParseCache()
    let calls = 0
    const complete: LlmChatCompleter = async () => {
      calls += 1
      return JSON.stringify({
        timeLabel: null,
        objectTypes: null,
        contentTerms: ['cloudflare'],
        confidence: 'low'
      })
    }
    await parseRecallClueWithLlm('same clue', { complete, useCache: false })
    await parseRecallClueWithLlm('same clue', { complete, useCache: false })
    expect(calls).toBe(2)
  })

  it('不同 clue 各调一次 LLM', async () => {
    clearLlmParseCache()
    let calls = 0
    const complete: LlmChatCompleter = async () => {
      calls += 1
      return JSON.stringify({
        timeLabel: null,
        objectTypes: null,
        contentTerms: ['x'],
        confidence: 'low'
      })
    }
    await parseRecallClueWithLlm('aaa', { complete })
    await parseRecallClueWithLlm('bbb', { complete })
    await parseRecallClueWithLlm('ccc', { complete })
    expect(calls).toBe(3)
  })

  it('cache hit 后 timeRange 仍按调用方 nowMs 重算', async () => {
    clearLlmParseCache()
    const complete: LlmChatCompleter = async () =>
      JSON.stringify({
        timeLabel: 'recent',
        objectTypes: null,
        contentTerms: ['cloudflare'],
        confidence: 'medium'
      })
    // 第一次：timeRange 应基于 firstNowMs 计算
    const firstNowMs = 1_700_000_000_000
    const r1 = await parseRecallClueWithLlm('cloudflare', { complete, nowMs: firstNowMs })
    // 第二次：nowMs 不同；LLM 不再调用，但 timeRange 应基于 secondNowMs 计算
    const secondNowMs = firstNowMs + 24 * 60 * 60 * 1000
    const r2 = await parseRecallClueWithLlm('cloudflare', { complete, nowMs: secondNowMs })
    expect(r1.timeRange).toBeDefined()
    expect(r2.timeRange).toBeDefined()
    // 两次 timeRange 的 from 应不同（因为 nowMs 相差 1 天）
    expect(r2.timeRange!.from).not.toBe(r1.timeRange!.from)
  })
})
