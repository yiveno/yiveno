/**
 * 画像 LLM 叙事审核。
 */

import { describe, expect, it } from 'vitest'

import type { PortraitNarrativeContentPoints } from '@/core/portrait/portrait-narrative-prompt'
import { validatePortraitNarrative } from '@/core/portrait/validate-portrait-narrative'

function basePoints(
  overrides: Partial<PortraitNarrativeContentPoints> = {}
): PortraitNarrativeContentPoints {
  return {
    locale: 'zh_CN',
    groups: [
      {
        key: 'verified',
        label: '确定',
        values: ['github.com'],
        total: 1
      }
    ],
    pendingValues: [],
    pendingTotal: 0,
    contestedValues: [],
    contestedTotal: 0,
    ...overrides
  }
}

describe('validatePortraitNarrative', () => {
  it('正常文本通过', () => {
    const points = basePoints()
    const result = validatePortraitNarrative('比较确定的是，你喜欢 github.com。', points, 'zh_CN')
    expect(result.ok).toBe(true)
    expect(result.reasons).toEqual([])
  })

  it('编造域名不过', () => {
    const result = validatePortraitNarrative(
      '你喜欢 github.com，也喜欢 evil.example。',
      basePoints(),
      'zh_CN'
    )
    expect(result.ok).toBe(false)
    expect(result.reasons.some(r => r.startsWith('invented_domain:'))).toBe(true)
  })

  it('pending 确定断言不过', () => {
    const points = basePoints({
      pendingValues: ['zig'],
      pendingTotal: 1,
      groups: [
        {
          key: 'unconfirmed',
          label: '待确认',
          values: ['zig'],
          total: 1
        }
      ]
    })
    const result = validatePortraitNarrative('你喜欢 zig。', points, 'zh_CN')
    expect(result.ok).toBe(false)
    expect(result.reasons.some(r => r.startsWith('pending_asserted:'))).toBe(true)
  })

  it('pending 缺不确定标记不过；含标记通过', () => {
    const points = basePoints({
      pendingValues: ['zig'],
      pendingTotal: 1,
      groups: [{ key: 'unconfirmed', label: '待确认', values: ['zig'], total: 1 }]
    })
    const bad = validatePortraitNarrative('你也关注 zig。', points, 'zh_CN')
    expect(bad.ok).toBe(false)
    expect(bad.reasons.some(r => r.startsWith('pending_missing_hedge:'))).toBe(true)

    const good = validatePortraitNarrative('我猜你可能关注 zig，还不确定。', points, 'zh_CN')
    expect(good.ok).toBe(true)
  })

  it('contested 缺矛盾标记不过；含标记通过', () => {
    const points = basePoints({
      contestedValues: ['vim'],
      contestedTotal: 1,
      groups: [{ key: 'contested', label: '矛盾', values: ['vim'], total: 1 }]
    })
    const bad = validatePortraitNarrative('你提过 vim。', points, 'zh_CN')
    expect(bad.ok).toBe(false)
    expect(bad.reasons.some(r => r.startsWith('contested_missing_marker:'))).toBe(true)

    const good = validatePortraitNarrative('关于 vim，我看到的线索还对不上。', points, 'zh_CN')
    expect(good.ok).toBe(true)
  })

  it('数字对不上不过；对齐计数通过', () => {
    const points = basePoints({
      pendingValues: ['alpha', 'beta'],
      pendingTotal: 2,
      groups: [
        { key: 'verified', label: '确定', values: ['github.com'], total: 1 },
        { key: 'unconfirmed', label: '待确认', values: ['alpha', 'beta'], total: 2 }
      ]
    })
    const bad = validatePortraitNarrative('还有 9 项待你确认。', points, 'zh_CN')
    expect(bad.ok).toBe(false)
    expect(bad.reasons).toContain('bad_count:9')

    const good = validatePortraitNarrative(
      '比较确定的是，你喜欢 github.com。还有 2 项待你确认。',
      points,
      'zh_CN'
    )
    expect(good).toEqual({ ok: true, reasons: [] })
  })

  it('含 markdown 不过', () => {
    const result = validatePortraitNarrative('# 标题\n你喜欢 github.com。', basePoints(), 'zh_CN')
    expect(result.ok).toBe(false)
    expect(result.reasons).toEqual(expect.arrayContaining(['markdown', 'multiline']))
  })

  it('含内部术语不过', () => {
    const result = validatePortraitNarrative(
      '按 credibility 看你喜欢 github.com。',
      basePoints(),
      'zh_CN'
    )
    expect(result.ok).toBe(false)
    expect(result.reasons).toContain('internal_terms')
  })

  it('超长不过', () => {
    const long = `你喜欢 github.com。${'啊'.repeat(160)}`
    const result = validatePortraitNarrative(long, basePoints(), 'zh_CN')
    expect(result.ok).toBe(false)
    expect(result.reasons).toContain('too_long')
  })

  it('en：pending 断言与 hedge', () => {
    const points: PortraitNarrativeContentPoints = {
      locale: 'en',
      groups: [{ key: 'unconfirmed', label: 'unconfirmed', values: ['zig'], total: 1 }],
      pendingValues: ['zig'],
      pendingTotal: 1,
      contestedValues: [],
      contestedTotal: 0
    }
    const bad = validatePortraitNarrative('You like zig a lot.', points, 'en')
    expect(bad.ok).toBe(false)
    expect(bad.reasons.some(r => r.startsWith('pending_asserted:'))).toBe(true)

    const good = validatePortraitNarrative(
      "I'm guessing you might be into zig — still not sure.",
      points,
      'en'
    )
    expect(good.ok).toBe(true)
  })
})
