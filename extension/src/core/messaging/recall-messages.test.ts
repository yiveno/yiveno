import { describe, expect, it } from 'vitest'

import { parseRecallWithCluePayload } from '@/core/messaging/recall-messages'
import { parseRecallClue } from '@/core/recall/parse-recall-clue'

describe('parseRecallWithCluePayload', () => {
  it('接受单句 clue', () => {
    expect(
      parseRecallWithCluePayload({
        clue: 'retention',
        source: 'sidepanel',
        recallId: 't1'
      })
    ).toEqual({ clue: 'retention', source: 'sidepanel', recallId: 't1' })
  })

  it('接受多轮 context', () => {
    const accumulated = parseRecallClue('poem Li Bai', {
      nowMs: Date.parse('2026-08-05T12:00:00.000Z')
    })
    const payload = parseRecallWithCluePayload({
      clue: 'yesterday',
      source: 'sidepanel',
      recallId: 't2',
      context: {
        priorUserUtterances: ['poem Li Bai'],
        accumulated,
        dismissedIds: ['11111111-1111-4111-8111-111111111101']
      }
    })
    expect(payload.clue).toBe('yesterday')
    expect(payload.context?.priorUserUtterances).toEqual(['poem Li Bai'])
    expect(payload.context?.dismissedIds).toHaveLength(1)
    expect(payload.context?.accumulated?.objectTypes).toContain('poem')
  })

  it('多轮 accumulated 带 topic.embedding 时剥掉后再校验（消息边界）', () => {
    const accumulated = parseRecallClue('poem Li Bai', {
      nowMs: Date.parse('2026-08-05T12:00:00.000Z')
    })
    const withEmbedding = {
      ...accumulated,
      topic: {
        terms: accumulated.topic?.terms ?? accumulated.contentTerms,
        source: 'content' as const,
        strength: 'strong' as const,
        // 模拟跨页面后 instanceof 已不可靠的向量；预处理应剥掉
        embedding: { 0: 0.1, length: 1 }
      }
    }
    const payload = parseRecallWithCluePayload({
      clue: 'yesterday',
      source: 'sidepanel',
      recallId: 't2-emb',
      context: {
        priorUserUtterances: ['poem Li Bai'],
        accumulated: withEmbedding
      }
    })
    expect(payload.context?.accumulated?.topic?.embedding).toBeUndefined()
    expect(payload.context?.accumulated?.contentTerms?.length).toBeGreaterThan(0)
  })

  it('拒绝非法 dismissedIds', () => {
    expect(() =>
      parseRecallWithCluePayload({
        clue: 'x',
        source: 'sidepanel',
        recallId: 't3',
        context: { dismissedIds: ['not-a-uuid'] }
      })
    ).toThrow()
  })

  it('拒绝缺 recallId 或 source', () => {
    expect(() => parseRecallWithCluePayload({ clue: 'x', source: 'sidepanel' })).toThrow()
    expect(() => parseRecallWithCluePayload({ clue: 'x', recallId: 'r1' })).toThrow()
  })
})
