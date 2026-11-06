/**
 * 冻结夹具构造：精选确定性 + 无 diversity。
 */

import { describe, expect, it } from 'vitest'

import { buildProbeGeneratedFixture } from './probe-generated-fixture'

describe('buildProbeGeneratedFixture', () => {
  it('researcher 精选：同 seed 两次字段一致且无 diversity case', () => {
    const a = buildProbeGeneratedFixture({
      personas: ['researcher'],
      baseline: { top1Rate: 0.5, inTop3Rate: 0.8, judged: 10 }
    })
    const b = buildProbeGeneratedFixture({
      personas: ['researcher'],
      baseline: { top1Rate: 0.5, inTop3Rate: 0.8, judged: 10 }
    })
    expect(a.items).toEqual(b.items)
    expect(a.cases).toEqual(b.cases)
    expect(a.items.every(row => row.key.length > 0)).toBe(true)
    expect(a.cases.every(row => row.source === 'curated')).toBe(true)
    expect(a.cases.length).toBeGreaterThan(0)
  })
})
