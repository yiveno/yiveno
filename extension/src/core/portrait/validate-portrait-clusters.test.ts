/**
 * 画像语义簇划分校验。
 */

import { describe, expect, it } from 'vitest'

import { validatePortraitClusters } from '@/core/portrait/validate-portrait-clusters'

const INPUT = ['苹果', '梨', 'Vue', 'React']

describe('validatePortraitClusters', () => {
  it('完整划分通过', () => {
    const raw = JSON.stringify({
      clusters: [
        { label: '水果', items: ['苹果', '梨'] },
        { label: '前端框架', items: ['Vue', 'React'] }
      ]
    })
    const result = validatePortraitClusters(raw, INPUT)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.clusters).toHaveLength(2)
      expect(result.clusters[0]?.label).toBe('水果')
    }
  })

  it('遗漏项失败', () => {
    const raw = JSON.stringify({
      clusters: [{ label: '水果', items: ['苹果', '梨'] }]
    })
    const result = validatePortraitClusters(raw, INPUT)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reasons.some(r => r.startsWith('遗漏项:'))).toBe(true)
    }
  })

  it('重复项失败', () => {
    const raw = JSON.stringify({
      clusters: [
        { label: '水果', items: ['苹果', '梨'] },
        { label: '前端框架', items: ['Vue', 'React', '苹果'] }
      ]
    })
    const result = validatePortraitClusters(raw, INPUT)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reasons.some(r => r.startsWith('重复项:'))).toBe(true)
    }
  })

  it('发明项失败', () => {
    const raw = JSON.stringify({
      clusters: [
        { label: '水果', items: ['苹果', '梨', '香蕉'] },
        { label: '前端框架', items: ['Vue', 'React'] }
      ]
    })
    const result = validatePortraitClusters(raw, INPUT)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reasons.some(r => r.includes('发明项:香蕉'))).toBe(true)
    }
  })

  it('单成员 label 不等于 value 失败', () => {
    const raw = JSON.stringify({
      clusters: [
        { label: '水果', items: ['苹果', '梨'] },
        { label: '框架', items: ['Vue'] },
        { label: 'React', items: ['React'] }
      ]
    })
    const result = validatePortraitClusters(raw, INPUT)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reasons.some(r => r.includes('单成员簇'))).toBe(true)
    }
  })

  it('多成员照抄成员 label 失败', () => {
    const raw = JSON.stringify({
      clusters: [
        { label: '苹果', items: ['苹果', '梨'] },
        { label: '前端框架', items: ['Vue', 'React'] }
      ]
    })
    const result = validatePortraitClusters(raw, INPUT)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reasons.some(r => r.includes('不得照抄成员'))).toBe(true)
    }
  })

  it('单成员 label===value 可通过', () => {
    const raw = JSON.stringify({
      clusters: [
        { label: '水果', items: ['苹果', '梨'] },
        { label: 'Vue', items: ['Vue'] },
        { label: 'React', items: ['React'] }
      ]
    })
    const result = validatePortraitClusters(raw, INPUT)
    expect(result.ok).toBe(true)
  })
})
