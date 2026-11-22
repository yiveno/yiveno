import { describe, expect, it } from 'vitest'
import { isProxy, isReactive, reactive, ref } from 'vue'

import { parseRecallWithCluePayload } from '@/core/messaging/recall-messages'
import type { ParsedRecallClue } from '@/core/recall/parse-recall-clue-types'
import {
  markAccumulatedForDialogState,
  toCloneableAccumulated
} from '@/pages/sidepanel/cloneable-recall-dialog-accumulated'

function sampleParsedWithEmbedding(): ParsedRecallClue {
  return {
    raw: 'poem about Li Bai',
    contentTerms: ['poem', 'li', 'bai'],
    confidence: 'high',
    topic: {
      terms: ['poem', 'li', 'bai'],
      source: 'content',
      strength: 'strong',
      embedding: new Float32Array([0.1, 0.2, 0.3, 0.4])
    }
  }
}

describe('cloneable-recall-dialog-accumulated', () => {
  it('Vue deep reactive 的 accumulated 无法 structuredClone（跟进轮次失败根因之一）', () => {
    const dialogState = ref<{ accumulated: ParsedRecallClue | null }>({
      accumulated: sampleParsedWithEmbedding()
    })
    const fromState = dialogState.value.accumulated
    expect(fromState).not.toBeNull()
    expect(isProxy(fromState)).toBe(true)
    expect(() => structuredClone(fromState)).toThrow(/clone|DataCloneError|could not be cloned/i)
    expect(() =>
      structuredClone({
        clue: 'yesterday',
        source: 'sidepanel',
        recallId: 'sp-2',
        context: { accumulated: fromState, priorUserUtterances: ['poem about Li Bai'] }
      })
    ).toThrow(/clone|DataCloneError|could not be cloned/i)
  })

  it('markRaw 写入 + toCloneable 发送 → 剥 embedding 且 Zod payload 通过', () => {
    const marked = markAccumulatedForDialogState(sampleParsedWithEmbedding())
    const dialogState = reactive({
      priorUserUtterances: ['poem about Li Bai'],
      accumulated: marked as ParsedRecallClue | null,
      dismissedIds: [] as string[]
    })

    expect(isReactive(dialogState)).toBe(true)
    expect(isProxy(dialogState.accumulated)).toBe(false)

    const cloneable = toCloneableAccumulated(dialogState.accumulated!)
    expect(cloneable.topic?.embedding).toBeUndefined()
    expect(cloneable.topic?.terms).toEqual(['poem', 'li', 'bai'])

    const wirePayload = {
      clue: 'yesterday',
      source: 'sidepanel' as const,
      recallId: 'sp-2',
      context: {
        priorUserUtterances: [...dialogState.priorUserUtterances],
        accumulated: cloneable
      }
    }

    expect(() => structuredClone(wirePayload)).not.toThrow()
    const parsed = parseRecallWithCluePayload(structuredClone(wirePayload))
    expect(parsed.context?.accumulated?.contentTerms).toEqual(['poem', 'li', 'bai'])
    expect(parsed.context?.accumulated?.topic?.embedding).toBeUndefined()
  })

  it('仅 toCloneable（历史未 markRaw 的 Proxy）也可剥壳并去掉 embedding', () => {
    const dialogState = ref({ accumulated: sampleParsedWithEmbedding() })
    const cloneable = toCloneableAccumulated(dialogState.value.accumulated!)
    expect(isProxy(cloneable)).toBe(false)
    expect(cloneable.topic?.embedding).toBeUndefined()
    expect(() => structuredClone(cloneable)).not.toThrow()
  })

  it('无 topic.embedding 时原样返回（仍 toRaw）', () => {
    const without: ParsedRecallClue = {
      raw: 'bookmark about deploy',
      contentTerms: ['deploy'],
      confidence: 'medium',
      topic: {
        terms: ['deploy'],
        source: 'content',
        strength: 'strong'
      }
    }
    const out = toCloneableAccumulated(markAccumulatedForDialogState(without))
    expect(out.topic?.embedding).toBeUndefined()
    expect(out.contentTerms).toEqual(['deploy'])
  })
})
