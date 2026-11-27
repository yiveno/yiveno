/**
 * 画像摘要：按簇浮出 / 隐藏 / 功能词过滤。
 */

import { describe, expect, it } from 'vitest'

import { buildPortraitSummary } from '@/core/portrait/build-portrait-summary'
import type { PortraitFactRecord } from '@/core/portrait/portrait-facts'

const OWNER = '11111111-1111-4111-8111-111111111111'
const NOW = '2026-11-25T08:00:00.000Z'

function inferenceFact(
  value: string,
  opts: {
    credibility?: number
    refs?: string[]
  } = {}
): PortraitFactRecord {
  const refs = opts.refs ?? ['note:1']
  return {
    id: `${OWNER}\0contentTerm\0${value}`,
    ownerId: OWNER,
    slot: 'contentTerm',
    value,
    credibility: opts.credibility ?? 0.4,
    state: 'unconfirmed',
    sources: refs.map(ref => ({
      type: 'inference' as const,
      ref,
      score: opts.credibility ?? 0.4,
      observedAt: NOW
    })),
    inPortrait: false,
    createdAt: NOW,
    updatedAt: NOW
  }
}

describe('buildPortraitSummary pending 按簇浮出', () => {
  it('多成员簇浮出', () => {
    const summary = buildPortraitSummary(
      [
        inferenceFact('苹果', { refs: ['note:fruit'] }),
        inferenceFact('梨', { refs: ['note:fruit'] })
      ],
      {
        clusterPartition: [{ label: '水果', items: ['苹果', '梨'] }]
      }
    )
    const surfaced = summary.clusters.filter(c => c.surfaced)
    expect(surfaced).toHaveLength(1)
    expect(surfaced[0]?.label).toBe('水果')
    expect(summary.hiddenPendingItems).toHaveLength(0)
    expect(summary.empty).toBe(false)
  })

  it('单成员低证据进隐藏', () => {
    const summary = buildPortraitSummary([inferenceFact('rag', { refs: ['note:1'] })])
    expect(summary.clusters.every(c => !c.surfaced)).toBe(true)
    expect(summary.hiddenPendingItems).toHaveLength(1)
    expect(summary.hiddenPendingItems[0]?.value).toBe('rag')
    expect(summary.hiddenPendingCount).toBe(1)
    expect(summary.empty).toBe(false)
  })

  it('单成员 credibility ≥ 0.5 浮出', () => {
    const summary = buildPortraitSummary([
      inferenceFact('zig', { credibility: 0.5, refs: ['note:1'] })
    ])
    expect(summary.clusters.filter(c => c.surfaced)).toHaveLength(1)
    expect(summary.hiddenPendingItems).toHaveLength(0)
  })

  it('功能词全过滤', () => {
    const summary = buildPortraitSummary([
      inferenceFact('联系', { refs: ['note:1', 'note:2'] }),
      inferenceFact('contact', { credibility: 0.6, refs: ['note:3'] }),
      inferenceFact('rag', { refs: ['note:4', 'note:5'] }),
      inferenceFact('vector', { refs: ['note:4'] })
    ])
    const values = [
      ...summary.clusters.flatMap(c => c.items.map(i => i.value)),
      ...summary.hiddenPendingItems.map(i => i.value)
    ]
    expect(values).not.toContain('联系')
    expect(values).not.toContain('contact')
    expect(values).toContain('rag')
    expect(values).toContain('vector')
  })
})
