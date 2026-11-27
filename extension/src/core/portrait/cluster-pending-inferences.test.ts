/**
 * 待确认推断共现聚类。
 */

import { describe, expect, it } from 'vitest'

import { clusterPendingInferences } from '@/core/portrait/cluster-pending-inferences'

describe('clusterPendingInferences', () => {
  it('共享同一 source note ref → 连边成簇', () => {
    const clusters = clusterPendingInferences([
      {
        factId: 'a',
        value: 'rag',
        credibility: 0.4,
        sourceNoteRefs: ['note:1', 'note:2']
      },
      {
        factId: 'b',
        value: 'vector',
        credibility: 0.55,
        sourceNoteRefs: ['note:2']
      },
      {
        factId: 'c',
        value: 'zig',
        credibility: 0.6,
        sourceNoteRefs: ['note:9']
      }
    ])
    expect(clusters).toHaveLength(2)
    const joined = clusters.find(c => c.items.some(i => i.factId === 'a'))
    expect(joined?.count).toBe(2)
    expect(joined?.items.map(i => i.factId).sort()).toEqual(['a', 'b'])
    expect(joined?.label).toBe('vector')
    const solo = clusters.find(c => c.items.some(i => i.factId === 'c'))
    expect(solo?.count).toBe(1)
    expect(solo?.label).toBe('zig')
  })

  it('无共现 → 单项自成一簇', () => {
    const clusters = clusterPendingInferences([
      { factId: 'a', value: 'alpha', credibility: 0.5, sourceNoteRefs: ['note:1'] },
      { factId: 'b', value: 'beta', credibility: 0.5, sourceNoteRefs: ['note:2'] }
    ])
    expect(clusters).toHaveLength(2)
    expect(clusters.every(c => c.count === 1)).toBe(true)
  })

  it('排序：最高 credibility 降序，再按 count 降序', () => {
    const clusters = clusterPendingInferences([
      { factId: 'low', value: 'low', credibility: 0.4, sourceNoteRefs: ['n1', 'n2'] },
      { factId: 'low2', value: 'low2', credibility: 0.4, sourceNoteRefs: ['n1'] },
      { factId: 'hi', value: 'hi', credibility: 0.7, sourceNoteRefs: ['n9'] }
    ])
    expect(clusters[0]?.label).toBe('hi')
    expect(clusters[1]?.count).toBe(2)
  })

  it('label：同分取字典序首个', () => {
    const clusters = clusterPendingInferences([
      { factId: 'b', value: 'beta', credibility: 0.5, sourceNoteRefs: ['n'] },
      { factId: 'a', value: 'alpha', credibility: 0.5, sourceNoteRefs: ['n'] }
    ])
    expect(clusters).toHaveLength(1)
    expect(clusters[0]?.label).toBe('alpha')
  })
})
