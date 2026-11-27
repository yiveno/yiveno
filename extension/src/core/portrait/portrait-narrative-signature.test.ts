/**
 * 画像事实签名。
 */

import { describe, expect, it } from 'vitest'

import { buildPortraitFactSignature } from '@/core/portrait/portrait-narrative-signature'

describe('portrait-narrative-signature', () => {
  it('同事实同签名（顺序无关）', () => {
    const a = buildPortraitFactSignature([
      { factId: 'f2', state: 'verified', inPortrait: true },
      { factId: 'f1', state: 'unconfirmed', inPortrait: false }
    ])
    const b = buildPortraitFactSignature([
      { factId: 'f1', state: 'unconfirmed', inPortrait: false },
      { factId: 'f2', state: 'verified', inPortrait: true }
    ])
    expect(a).toBe(b)
  })

  it('批准后 inPortrait/state 变化 → 签名变化', () => {
    const before = buildPortraitFactSignature([
      { factId: 'f1', state: 'unconfirmed', inPortrait: false }
    ])
    const after = buildPortraitFactSignature([
      { factId: 'f1', state: 'verified', inPortrait: true }
    ])
    expect(before).not.toBe(after)
  })
})
