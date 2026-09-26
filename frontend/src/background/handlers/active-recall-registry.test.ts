import { afterEach, describe, expect, it } from 'vitest'

import {
  clearActiveRecall,
  forceClearActiveRecall,
  getActiveRecall,
  getActiveRecallCount,
  setActiveRecall
} from '@/background/handlers/active-recall-registry'

describe('active-recall-registry', () => {
  afterEach(() => {
    forceClearActiveRecall('sidepanel')
    forceClearActiveRecall('omnibox')
    forceClearActiveRecall('extension-page')
  })

  it('setActiveRecall + getActiveRecall', () => {
    setActiveRecall('sidepanel', 'r1')
    expect(getActiveRecall('sidepanel')).toBe('r1')
  })

  it('同 source 多次 set：后覆盖前，返回旧值', () => {
    const previous = setActiveRecall('sidepanel', 'r1')
    expect(previous).toBeUndefined()
    const previous2 = setActiveRecall('sidepanel', 'r2')
    expect(previous2).toBe('r1')
    expect(getActiveRecall('sidepanel')).toBe('r2')
  })

  it('不同 source 互不影响', () => {
    setActiveRecall('sidepanel', 'sp-r1')
    setActiveRecall('omnibox', 'om-r1')
    expect(getActiveRecall('sidepanel')).toBe('sp-r1')
    expect(getActiveRecall('omnibox')).toBe('om-r1')
    expect(getActiveRecallCount()).toBe(2)
  })

  it('clearActiveRecall：仅匹配时清除', () => {
    setActiveRecall('sidepanel', 'r1')
    // 错误的 recallId → 不清除
    expect(clearActiveRecall('sidepanel', 'r2')).toBe(false)
    expect(getActiveRecall('sidepanel')).toBe('r1')
    // 正确的 recallId → 清除
    expect(clearActiveRecall('sidepanel', 'r1')).toBe(true)
    expect(getActiveRecall('sidepanel')).toBeUndefined()
  })

  it('forceClearActiveRecall：无校验', () => {
    setActiveRecall('sidepanel', 'r1')
    forceClearActiveRecall('sidepanel')
    expect(getActiveRecall('sidepanel')).toBeUndefined()
  })
})
