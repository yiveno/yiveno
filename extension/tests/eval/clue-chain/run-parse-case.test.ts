import { describe, expect, it, vi } from 'vitest'

import { runClueChainParseBatch, runClueChainParseCase } from './run-parse-case'
import type { ClueChainCase } from './types'
import type { UnderstandRecallClueResult } from '@/core/recall/understand/understand-recall-clue'

const sampleCase: ClueChainCase = {
  id: 'T1',
  category: 'A',
  clue: '那个鸡胸肉视频',
  difficulty: 'easy',
  note: 'fixture',
  expected: {
    intent: 'recall',
    topic: '鸡胸肉',
    time: null,
    time_certainty: null,
    type: '视频',
    entities: [],
    behavior: null,
    certainty: 'low'
  }
}

function okResult(): UnderstandRecallClueResult {
  return {
    disposition: 'proceed',
    rejectReason: null,
    mode: 'semantic',
    source: 'llm',
    clueTruncated: false,
    parsed: {
      raw: sampleCase.clue,
      contentTerms: ['鸡胸肉'],
      confidence: 'low',
      intent: 'recall',
      topic: { terms: ['鸡胸肉'], source: 'content', strength: 'strong' },
      objectTypes: ['video']
    },
    filterClue: '鸡胸肉'
  }
}

describe('clue-chain run-parse-case', () => {
  it('成功抓取 parsed 与耗时', async () => {
    const understand = vi.fn(async () => okResult())
    const result = await runClueChainParseCase(sampleCase, {
      understand,
      nowMs: 1,
      maxAttempts: 1,
      timeoutMs: 5_000
    })
    expect(result.error).toBeNull()
    expect(result.parsed?.intent).toBe('recall')
    expect(result.objectTypesActual).toEqual(['video'])
    // 无 parsed.topic 时由 resolveRecallTopic 从 contentTerms 派生
    expect(result.topicTermsActual).toEqual(['鸡胸肉'])
    expect(result.attempts).toBe(1)
    expect(understand).toHaveBeenCalledOnce()
  })

  it('失败重试后仍失败', async () => {
    const understand = vi.fn(async () => {
      throw new Error('boom')
    })
    const result = await runClueChainParseCase(sampleCase, {
      understand,
      nowMs: 1,
      maxAttempts: 2,
      timeoutMs: 5_000
    })
    expect(result.error).toContain('boom')
    expect(result.parsed).toBeNull()
    expect(understand).toHaveBeenCalledTimes(2)
  })

  it('超时标记 timedOut + skipped', async () => {
    const understand = vi.fn(
      () =>
        new Promise<UnderstandRecallClueResult>(resolve => {
          setTimeout(() => resolve(okResult()), 200)
        })
    )
    const result = await runClueChainParseCase(sampleCase, {
      understand,
      nowMs: 1,
      maxAttempts: 1,
      timeoutMs: 30
    })
    expect(result.timedOut).toBe(true)
    expect(result.skipped).toBe(true)
  })

  it('batch 支持 checkpoint 断点续跑', async () => {
    const understand = vi.fn(async () => okResult())
    const cached = await runClueChainParseCase(sampleCase, {
      understand,
      nowMs: 1,
      maxAttempts: 1
    })
    understand.mockClear()
    const second: ClueChainCase = { ...sampleCase, id: 'T2', clue: '另一条' }
    const batch = await runClueChainParseBatch({
      cases: [sampleCase, second],
      understand,
      nowMs: 1,
      maxAttempts: 1,
      checkpoint: new Map([['T1', cached]])
    })
    expect(batch).toHaveLength(2)
    expect(understand).toHaveBeenCalledTimes(1)
    expect(batch[0]?.id).toBe('T1')
    expect(batch[1]?.id).toBe('T2')
  })
})
