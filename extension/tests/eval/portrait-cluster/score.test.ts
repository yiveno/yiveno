import { describe, expect, it } from 'vitest'

import { PORTRAIT_CLUSTER_EVAL_CASES } from './cases'
import {
  fakePortraitClusterRaw,
  scorePortraitClusterCase,
  summarizePortraitClusterScores
} from './score'

describe('portrait-cluster scorer', () => {
  it('用例集为 12 组且含单成员与噪声', () => {
    expect(PORTRAIT_CLUSTER_EVAL_CASES).toHaveLength(12)
    expect(PORTRAIT_CLUSTER_EVAL_CASES.some(row => row.id === 'single_member')).toBe(true)
    expect(PORTRAIT_CLUSTER_EVAL_CASES.some(row => row.id === 'noise_mixed_fruit')).toBe(true)
  })

  it('合法划分 + label 命中关键词 → pass', () => {
    const fruit = PORTRAIT_CLUSTER_EVAL_CASES.find(row => row.id === 'fruit_zh')!
    const raw = fakePortraitClusterRaw([{ label: '水果', items: ['苹果', '梨', '香蕉'] }])
    const row = scorePortraitClusterCase(fruit, raw)
    expect(row.pass).toBe(true)
  })

  it('划分合法但 label 不命中 → fail', () => {
    const fruit = PORTRAIT_CLUSTER_EVAL_CASES.find(row => row.id === 'fruit_zh')!
    const raw = fakePortraitClusterRaw([{ label: '杂项', items: ['苹果', '梨', '香蕉'] }])
    const row = scorePortraitClusterCase(fruit, raw)
    expect(row.pass).toBe(false)
    expect(row.reasons[0]).toContain('未命中')
  })

  it('划分不合法 → fail', () => {
    const fruit = PORTRAIT_CLUSTER_EVAL_CASES.find(row => row.id === 'fruit_zh')!
    const row = scorePortraitClusterCase(
      fruit,
      JSON.stringify({ clusters: [{ label: '水果', items: ['苹果'] }] })
    )
    expect(row.pass).toBe(false)
  })

  it('单成员不要求关键词', () => {
    const single = PORTRAIT_CLUSTER_EVAL_CASES.find(row => row.id === 'single_member')!
    const raw = fakePortraitClusterRaw([{ label: '孤立兴趣项', items: ['孤立兴趣项'] }])
    expect(scorePortraitClusterCase(single, raw).pass).toBe(true)
  })

  it('汇总 pass/fail', () => {
    const summary = summarizePortraitClusterScores([
      { id: 'a', pass: true, reasons: [] },
      { id: 'b', pass: false, reasons: ['x'] }
    ])
    expect(summary).toEqual({
      rows: [
        { id: 'a', pass: true, reasons: [] },
        { id: 'b', pass: false, reasons: ['x'] }
      ],
      passed: 1,
      failed: 1,
      total: 2
    })
  })
})
