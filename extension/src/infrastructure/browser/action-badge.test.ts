import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  clearActionBadge,
  flashActionBadge,
  resetActionBadgeStateForTests
} from '@/infrastructure/browser/action-badge'

describe('action-badge', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    resetActionBadgeStateForTests()
    vi.stubGlobal('chrome', {
      action: {
        setBadgeText: vi.fn(async () => undefined),
        setBadgeBackgroundColor: vi.fn(async () => undefined)
      }
    })
  })

  afterEach(() => {
    resetActionBadgeStateForTests()
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('flashActionBadge 成功时设置绿色 +1 并按时清除', async () => {
    await flashActionBadge('success')

    expect(chrome.action.setBadgeBackgroundColor).toHaveBeenCalledWith({ color: '#0f766e' })
    expect(chrome.action.setBadgeText).toHaveBeenCalledWith({ text: '+1' })

    await vi.advanceTimersByTimeAsync(1600)
    expect(chrome.action.setBadgeText).toHaveBeenLastCalledWith({ text: '' })
  })

  it('flashActionBadge 失败时设置红色 !', async () => {
    await flashActionBadge('error')

    expect(chrome.action.setBadgeBackgroundColor).toHaveBeenCalledWith({ color: '#b42318' })
    expect(chrome.action.setBadgeText).toHaveBeenCalledWith({ text: '!' })
  })

  it('连续 flash 会取消上一次清除计时', async () => {
    await flashActionBadge('success', { durationMs: 1000 })
    await vi.advanceTimersByTimeAsync(400)
    await flashActionBadge('error', { durationMs: 1000 })

    await vi.advanceTimersByTimeAsync(600)
    // 第一次计时已被取消，此时不应清除
    const clearCalls = vi
      .mocked(chrome.action.setBadgeText)
      .mock.calls.filter(call => call[0]?.text === '')
    expect(clearCalls).toHaveLength(0)

    await vi.advanceTimersByTimeAsync(400)
    expect(chrome.action.setBadgeText).toHaveBeenLastCalledWith({ text: '' })
  })

  it('clearActionBadge 立即清空', async () => {
    await flashActionBadge('success')
    await clearActionBadge()
    expect(chrome.action.setBadgeText).toHaveBeenLastCalledWith({ text: '' })
  })
})
