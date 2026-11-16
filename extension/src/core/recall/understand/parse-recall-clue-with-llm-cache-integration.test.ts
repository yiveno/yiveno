import { describe, expect, it } from 'vitest'

import { clearLlmParseCache } from '@/core/recall/understand/llm-parse-cache'
import { EMPTY_LLM_CHAT_USAGE } from '@/core/recall/understand/llm-chat-usage'
import { parseRecallClueWithLlm } from '@/core/recall/understand/parse-recall-clue-with-llm'
import type {
  LlmChatCompleter,
  LlmChatCompleterDetailed
} from '@/core/recall/understand/parse-recall-clue-with-llm'

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

  it('换模后 clue1 缓存失效，completer 重新调用', async () => {
    clearLlmParseCache()
    const proposalA = JSON.stringify({
      timeLabel: null,
      objectTypes: null,
      contentTerms: ['from-a'],
      confidence: 'high'
    })
    const proposalB = JSON.stringify({
      timeLabel: null,
      objectTypes: null,
      contentTerms: ['from-b'],
      confidence: 'high'
    })
    let model: string = 'model-a'
    let calls = 0
    const complete: LlmChatCompleter = async () => {
      throw new Error('plain complete 不应被调用')
    }
    const completeDetailed: LlmChatCompleterDetailed = async () => {
      calls += 1
      return {
        text: model === 'model-a' ? proposalA : proposalB,
        usage: EMPTY_LLM_CHAT_USAGE,
        model
      }
    }

    await parseRecallClueWithLlm('clue1', { complete, completeDetailed })
    expect(calls).toBe(1)

    model = 'model-b'
    await parseRecallClueWithLlm('clue2', { complete, completeDetailed })
    expect(calls).toBe(2)

    // clue1 的 A 条目因 lastWrittenModel=B 作废 → 再查重新调 completer
    const r = await parseRecallClueWithLlm('clue1', { complete, completeDetailed })
    expect(calls).toBe(3)
    expect(r.contentTerms).toEqual(['from-b'])
  })

  it('同模型 detailed 连续两次同 clue：第二次命中缓存', async () => {
    clearLlmParseCache()
    let calls = 0
    const complete: LlmChatCompleter = async () => {
      throw new Error('plain complete 不应被调用')
    }
    const completeDetailed: LlmChatCompleterDetailed = async () => {
      calls += 1
      return {
        text: JSON.stringify({
          timeLabel: null,
          objectTypes: null,
          contentTerms: ['stable'],
          confidence: 'high'
        }),
        usage: EMPTY_LLM_CHAT_USAGE,
        model: 'model-a'
      }
    }
    await parseRecallClueWithLlm('same clue', { complete, completeDetailed })
    await parseRecallClueWithLlm('same clue', { complete, completeDetailed })
    expect(calls).toBe(1)
  })
})
