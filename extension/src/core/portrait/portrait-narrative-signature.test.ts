/**
 * 画像事实签名（含 prompt 版本段）。
 */

import { describe, expect, it } from 'vitest'

import { buildPortraitFactSignature } from '@/core/portrait/portrait-narrative-signature'

const SYSTEM_A = 'You write a short natural-language portrait summary…'
const SYSTEM_B = 'You write a short natural-language portrait summary… (v2)'

describe('portrait-narrative-signature', () => {
  it('同事实同 system → 同签名（顺序无关）', () => {
    const a = buildPortraitFactSignature(
      [
        { factId: 'f2', state: 'verified', inPortrait: true },
        { factId: 'f1', state: 'unconfirmed', inPortrait: false }
      ],
      SYSTEM_A
    )
    const b = buildPortraitFactSignature(
      [
        { factId: 'f1', state: 'unconfirmed', inPortrait: false },
        { factId: 'f2', state: 'verified', inPortrait: true }
      ],
      SYSTEM_A
    )
    expect(a).toBe(b)
  })

  it('批准后 inPortrait/state 变化 → 签名变化', () => {
    const before = buildPortraitFactSignature(
      [{ factId: 'f1', state: 'unconfirmed', inPortrait: false }],
      SYSTEM_A
    )
    const after = buildPortraitFactSignature(
      [{ factId: 'f1', state: 'verified', inPortrait: true }],
      SYSTEM_A
    )
    expect(before).not.toBe(after)
  })

  it('同事实、system 文案变化 → 签名不同', () => {
    const parts = [{ factId: 'f1', state: 'verified', inPortrait: true }] as const
    expect(buildPortraitFactSignature(parts, SYSTEM_A)).not.toBe(
      buildPortraitFactSignature(parts, SYSTEM_B)
    )
  })

  it('同事实、相同 system 文案 → 签名相同', () => {
    const parts = [{ factId: 'f1', state: 'verified', inPortrait: true }] as const
    expect(buildPortraitFactSignature(parts, SYSTEM_A)).toBe(
      buildPortraitFactSignature(parts, SYSTEM_A)
    )
  })
})
