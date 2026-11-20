import { describe, expect, it } from 'vitest'

import { decideFromExtensionAuthPhase } from './from-extension-auth-phase'

const extId = 'abcdefghijklmnopqrstuvwxyz'
const userA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const userB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'

describe('decideFromExtensionAuthPhase', () => {
  it('缺 extensionId → error', () => {
    expect(
      decideFromExtensionAuthPhase({
        extensionId: '',
        extensionSignedIn: true,
        extensionUserId: userA,
        websiteUserId: ''
      })
    ).toBe('error_missing_extension')
  })

  it('扩展未登录 → error', () => {
    expect(
      decideFromExtensionAuthPhase({
        extensionId: extId,
        extensionSignedIn: false,
        extensionUserId: '',
        websiteUserId: ''
      })
    ).toBe('error_extension_unsigned')
  })

  it('同账号 → redirect_same（不铸会话）', () => {
    expect(
      decideFromExtensionAuthPhase({
        extensionId: extId,
        extensionSignedIn: true,
        extensionUserId: userA,
        websiteUserId: userA
      })
    ).toBe('redirect_same')
  })

  it('官网未登录 → auto_sign_in', () => {
    expect(
      decideFromExtensionAuthPhase({
        extensionId: extId,
        extensionSignedIn: true,
        extensionUserId: userA,
        websiteUserId: ''
      })
    ).toBe('auto_sign_in')
  })

  it('官网不同账号 → confirm_switch', () => {
    expect(
      decideFromExtensionAuthPhase({
        extensionId: extId,
        extensionSignedIn: true,
        extensionUserId: userA,
        websiteUserId: userB
      })
    ).toBe('confirm_switch')
  })
})
