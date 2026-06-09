import { describe, expect, it } from 'vitest'
import { isAiEngineUiReady } from '@/application/ai/ai-engine-availability'

describe('ai-engine-availability', () => {
  it('Pro 且已登录时 UI 可用', () => {
    expect(
      isAiEngineUiReady({
        hasApiKey: false,
        isPro: true,
        isLoggedIn: true
      })
    ).toBe(true)
  })

  it('仅有 API Key 时 UI 可用', () => {
    expect(
      isAiEngineUiReady({
        hasApiKey: true,
        isPro: false,
        isLoggedIn: false
      })
    ).toBe(true)
  })

  it('非 Pro 且无 Key 时 UI 不可用', () => {
    expect(
      isAiEngineUiReady({
        hasApiKey: false,
        isPro: false,
        isLoggedIn: true
      })
    ).toBe(false)
  })

  it('Pro 但未登录且无 Key 时 UI 不可用', () => {
    expect(
      isAiEngineUiReady({
        hasApiKey: false,
        isPro: true,
        isLoggedIn: false
      })
    ).toBe(false)
  })
})
