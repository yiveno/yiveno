import { describe, expect, it } from 'vitest'
import { isAiAutoBookmarkEnabled, isAiOneClickOrganizeEnabled } from '@/core/ai/ai-feature-settings'

describe('ai-feature-settings', () => {
  it('未设置时默认开启', () => {
    expect(isAiAutoBookmarkEnabled(undefined)).toBe(true)
    expect(isAiOneClickOrganizeEnabled(undefined)).toBe(true)
  })

  it('显式 true 为开启', () => {
    expect(isAiAutoBookmarkEnabled(true)).toBe(true)
    expect(isAiOneClickOrganizeEnabled(true)).toBe(true)
  })

  it('显式 false 为关闭', () => {
    expect(isAiAutoBookmarkEnabled(false)).toBe(false)
    expect(isAiOneClickOrganizeEnabled(false)).toBe(false)
  })
})
