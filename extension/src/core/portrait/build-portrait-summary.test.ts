/**
 * 画像摘要：pending 展示门槛 / 功能词 / hiddenPendingCount。
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

describe('buildPortraitSummary pending 门槛', () => {
  it('单来源项被隐藏且 hiddenPendingCount 计数', () => {
    const summary = buildPortraitSummary([inferenceFact('rag', { refs: ['note:1'] })])
    expect(summary.clusters).toHaveLength(0)
    expect(summary.hiddenPendingCount).toBe(1)
    expect(summary.empty).toBe(true)
  })

  it('双来源项展示', () => {
    const summary = buildPortraitSummary([inferenceFact('rag', { refs: ['note:1', 'note:2'] })])
    expect(summary.hiddenPendingCount).toBe(0)
    expect(summary.clusters).toHaveLength(1)
    expect(summary.clusters[0]?.label).toBe('rag')
    expect(summary.empty).toBe(false)
  })

  it('credibility ≥ 0.5 单来源也展示', () => {
    const summary = buildPortraitSummary([
      inferenceFact('zig', { credibility: 0.5, refs: ['note:1'] })
    ])
    expect(summary.clusters).toHaveLength(1)
    expect(summary.hiddenPendingCount).toBe(0)
  })

  it('功能词行不展示', () => {
    const summary = buildPortraitSummary([
      inferenceFact('联系', { refs: ['note:1', 'note:2'] }),
      inferenceFact('contact', { credibility: 0.6, refs: ['note:3'] }),
      inferenceFact('rag', { refs: ['note:4', 'note:5'] })
    ])
    expect(summary.clusters).toHaveLength(1)
    expect(summary.clusters[0]?.label).toBe('rag')
    expect(summary.hiddenPendingCount).toBe(2)
  })
})
