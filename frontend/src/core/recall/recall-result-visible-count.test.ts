import { describe, expect, it } from 'vitest'

import { RECALL_RESULT_PAGE_SIZE } from '@/core/recall/build-recall-result'
import {
  recallRemainingVisibleCount,
  recallVisibleDomCap,
  resolveNextRecallVisibleCount
} from '@/core/recall/recall-result-visible-count'

describe('recall-result-visible-count', () => {
  it('recallVisibleDomCap 不超过软顶', () => {
    expect(recallVisibleDomCap(50)).toBe(20)
    expect(recallVisibleDomCap(8)).toBe(8)
  })

  it('page 模式按页递增且受软顶约束', () => {
    expect(resolveNextRecallVisibleCount(5, 50, 'page')).toBe(10)
    expect(resolveNextRecallVisibleCount(18, 50, 'page')).toBe(20)
  })

  it('all 模式一次到软顶而非全量 total', () => {
    expect(resolveNextRecallVisibleCount(5, 50, 'all')).toBe(20)
    expect(resolveNextRecallVisibleCount(5, 12, 'all')).toBe(12)
  })

  it('recallRemainingVisibleCount 在软顶内计算剩余', () => {
    expect(recallRemainingVisibleCount(5, 50)).toBe(15)
    expect(recallRemainingVisibleCount(20, 50)).toBe(0)
    expect(recallRemainingVisibleCount(5, 8)).toBe(3)
  })

  it('page 步长与 RECALL_RESULT_PAGE_SIZE 一致', () => {
    expect(resolveNextRecallVisibleCount(0, 50, 'page')).toBe(RECALL_RESULT_PAGE_SIZE)
  })
})
