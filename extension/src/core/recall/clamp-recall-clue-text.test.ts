import { describe, expect, it } from 'vitest'

import { RECALL_CLUE_MAX_CHARS } from '@/core/messaging/recall-messages'
import {
  clampRecallClueText,
  remainingRecallClueInsertCapacity
} from '@/core/recall/clamp-recall-clue-text'

describe('clampRecallClueText', () => {
  it('未超上限原样', () => {
    expect(clampRecallClueText('short')).toEqual({ text: 'short', truncated: false })
  })

  it('超上限截断', () => {
    const raw = 'a'.repeat(RECALL_CLUE_MAX_CHARS + 50)
    const result = clampRecallClueText(raw)
    expect(result.truncated).toBe(true)
    expect(result.text.length).toBe(RECALL_CLUE_MAX_CHARS)
  })
})

describe('remainingRecallClueInsertCapacity', () => {
  it('无选区：剩余 = 上限 − 当前', () => {
    expect(remainingRecallClueInsertCapacity(100)).toBe(RECALL_CLUE_MAX_CHARS - 100)
    expect(remainingRecallClueInsertCapacity(RECALL_CLUE_MAX_CHARS)).toBe(0)
  })

  it('有选区：先扣选区再算剩余', () => {
    expect(remainingRecallClueInsertCapacity(100, 40)).toBe(RECALL_CLUE_MAX_CHARS - 60)
  })
})
