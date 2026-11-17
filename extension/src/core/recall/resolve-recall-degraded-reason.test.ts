import { describe, expect, it } from 'vitest'

import { resolveRecallDegradedReason } from '@/core/recall/resolve-recall-degraded-reason'

describe('resolveRecallDegradedReason', () => {
  it('llm → null', () => {
    expect(
      resolveRecallDegradedReason({
        source: 'llm',
        mode: 'semantic',
        signedIn: false,
        aiFeaturesEnabled: false
      })
    ).toBeNull()
  })

  it('rules_fallback → null（不叠加 Stage 2b tip）', () => {
    expect(
      resolveRecallDegradedReason({
        source: 'rules_fallback',
        mode: 'semantic',
        signedIn: true,
        aiFeaturesEnabled: true
      })
    ).toBeNull()
  })

  it('rules + ai_off（含 mode=lexical，无 completer 常态）→ ai_off', () => {
    expect(
      resolveRecallDegradedReason({
        source: 'rules',
        mode: 'lexical',
        signedIn: true,
        aiFeaturesEnabled: false
      })
    ).toBe('ai_off')
    expect(
      resolveRecallDegradedReason({
        source: 'rules',
        mode: 'semantic',
        signedIn: true,
        aiFeaturesEnabled: false
      })
    ).toBe('ai_off')
  })

  it('rules + ai_on + 未登录（含 mode=lexical）→ not_signed_in', () => {
    expect(
      resolveRecallDegradedReason({
        source: 'rules',
        mode: 'lexical',
        signedIn: false,
        aiFeaturesEnabled: true
      })
    ).toBe('not_signed_in')
  })

  it('rules + ai_on + 已登录 + lexical（纯 URL）→ null', () => {
    expect(
      resolveRecallDegradedReason({
        source: 'rules',
        mode: 'lexical',
        signedIn: true,
        aiFeaturesEnabled: true
      })
    ).toBeNull()
  })

  it('rules + ai_on + 已登录 + semantic → null', () => {
    expect(
      resolveRecallDegradedReason({
        source: 'rules',
        mode: 'semantic',
        signedIn: true,
        aiFeaturesEnabled: true
      })
    ).toBeNull()
  })

  it('任一信号 null → null', () => {
    expect(
      resolveRecallDegradedReason({
        source: 'rules',
        mode: 'semantic',
        signedIn: null,
        aiFeaturesEnabled: true
      })
    ).toBeNull()
    expect(
      resolveRecallDegradedReason({
        source: 'rules',
        mode: 'semantic',
        signedIn: false,
        aiFeaturesEnabled: null
      })
    ).toBeNull()
  })

  it('ai_off 与未登录同时 → ai_off（顺序）', () => {
    expect(
      resolveRecallDegradedReason({
        source: 'rules',
        mode: 'semantic',
        signedIn: false,
        aiFeaturesEnabled: false
      })
    ).toBe('ai_off')
  })

  it('source/mode 缺失 → null', () => {
    expect(
      resolveRecallDegradedReason({
        source: undefined,
        mode: 'semantic',
        signedIn: false,
        aiFeaturesEnabled: false
      })
    ).toBeNull()
  })
})
