import { describe, expect, it } from 'vitest'

import {
  RECALL_CONVERSATION_MAX_DOM_TURNS,
  RECALL_CONVERSATION_TURN_PAGE_SIZE,
  recallConversationVisibleStartIndex,
  recallHiddenEarlierTurnCount,
  resolveNextEarlierTurnReveal,
  sliceVisibleConversationTurns
} from '@/pages/sidepanel/recall-conversation-turn-window'

describe('recall-conversation-turn-window', () => {
  it('短会话全量展示', () => {
    const turns = ['a', 'b', 'c']
    expect(sliceVisibleConversationTurns(turns, 0)).toEqual(['a', 'b', 'c'])
    expect(recallHiddenEarlierTurnCount(turns.length, 0)).toBe(0)
  })

  it('长会话默认只保留尾部软顶', () => {
    const turns = Array.from({ length: 20 }, (_, index) => `t${index}`)
    expect(sliceVisibleConversationTurns(turns, 0)).toHaveLength(RECALL_CONVERSATION_MAX_DOM_TURNS)
    expect(sliceVisibleConversationTurns(turns, 0)[0]).toBe('t6')
    expect(recallHiddenEarlierTurnCount(turns.length, 0)).toBe(6)
  })

  it('page 模式按页展开 earlier', () => {
    const total = 20
    const next = resolveNextEarlierTurnReveal(0, total, 'page')
    expect(next).toBe(RECALL_CONVERSATION_TURN_PAGE_SIZE)
    expect(recallConversationVisibleStartIndex(total, next)).toBe(0)
  })

  it('all 模式一次展开全部 earlier', () => {
    const total = 20
    const next = resolveNextEarlierTurnReveal(0, total, 'all')
    expect(next).toBe(6)
    expect(recallHiddenEarlierTurnCount(total, next)).toBe(0)
    expect(sliceVisibleConversationTurns(Array.from({ length: total }), next)).toHaveLength(total)
  })
})
