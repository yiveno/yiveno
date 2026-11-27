import { describe, expect, it } from 'vitest'

import { isWebsiteAccountMismatch } from './website-account-mismatch'

describe('isWebsiteAccountMismatch（三态）', () => {
  it('匿名扩展 + 官网 Pro → 无不一致提示（可接通）', () => {
    expect(
      isWebsiteAccountMismatch({
        extensionSignedIn: true,
        extensionAccountId: 'anon-user',
        websiteUserId: 'pro-user',
        isAnonymous: true
      })
    ).toBe(false)
  })

  it('真实异账号 → 仍报不一致', () => {
    expect(
      isWebsiteAccountMismatch({
        extensionSignedIn: true,
        extensionAccountId: 'ext-user-a',
        websiteUserId: 'web-user-b',
        isAnonymous: false
      })
    ).toBe(true)

    // 缺 isAnonymous 按真实账号（保守）
    expect(
      isWebsiteAccountMismatch({
        extensionSignedIn: true,
        extensionAccountId: 'ext-user-a',
        websiteUserId: 'web-user-b'
      })
    ).toBe(true)
  })

  it('同账号 → 无不一致提示', () => {
    expect(
      isWebsiteAccountMismatch({
        extensionSignedIn: true,
        extensionAccountId: 'same-user',
        websiteUserId: 'same-user',
        isAnonymous: false
      })
    ).toBe(false)
  })

  it('官网未登录 / 扩展未登录 → 无提示', () => {
    expect(
      isWebsiteAccountMismatch({
        extensionSignedIn: true,
        extensionAccountId: 'ext',
        websiteUserId: null,
        isAnonymous: false
      })
    ).toBe(false)
    expect(
      isWebsiteAccountMismatch({
        extensionSignedIn: false,
        extensionAccountId: 'ext',
        websiteUserId: 'web',
        isAnonymous: false
      })
    ).toBe(false)
  })
})
