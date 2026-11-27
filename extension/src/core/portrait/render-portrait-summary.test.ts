/**
 * 画像摘要措辞 / 空态 / 簇视图同步。
 */

import { describe, expect, it } from 'vitest'

import { buildPortraitSummary } from '@/core/portrait/build-portrait-summary'
import {
  applyPortraitApproveClusterToView,
  applyPortraitApproveToView,
  applyPortraitDeclineToView,
  buildPortraitSummaryViewModel,
  renderPortraitFactLine,
  renderPortraitGroupNarrative
} from '@/core/portrait/render-portrait-summary'
import type { PortraitFactRecord } from '@/core/portrait/portrait-facts'

const OWNER = '11111111-1111-4111-8111-111111111111'
const NOW = '2026-11-25T08:00:00.000Z'

const t = (key: string, subs?: string | string[]) => {
  if (!subs) {
    return key
  }
  const list = Array.isArray(subs) ? subs : [subs]
  return `${key}:${list.join('|')}`
}

function dualSourcePending(value: string, refs: string[], credibility = 0.55): PortraitFactRecord {
  return {
    id: `${OWNER}\0contentTerm\0${value}`,
    ownerId: OWNER,
    slot: 'contentTerm',
    value,
    credibility,
    state: 'unconfirmed',
    sources: refs.map(ref => ({
      type: 'inference' as const,
      ref,
      score: credibility,
      observedAt: NOW
    })),
    inPortrait: false,
    createdAt: NOW,
    updatedAt: NOW
  }
}

describe('render-portrait-summary', () => {
  it('空态文案', () => {
    const view = buildPortraitSummaryViewModel(buildPortraitSummary([]), t)
    expect(view.empty).toBe(true)
    expect(view.emptyText).toBe('portrait_empty')
  })

  it('四态措辞 key', () => {
    const item = {
      factId: 'x',
      slot: 'contentTerm' as const,
      value: 'github.com',
      credibility: 0.9,
      state: 'verified' as const,
      inPortrait: true,
      wording: 'direct' as const,
      pendingInference: false,
      sourceTypes: ['behavior'],
      sourceNoteRefs: [] as string[]
    }
    expect(renderPortraitFactLine(item, t)).toBe('portrait_fact_direct:github.com')
    expect(renderPortraitFactLine({ ...item, wording: 'paraphrase', credibility: 0.4 }, t)).toBe(
      'portrait_fact_paraphrase:github.com'
    )
    expect(renderPortraitFactLine({ ...item, wording: 'hedged', credibility: 0.7 }, t)).toBe(
      'portrait_fact_hedged:github.com'
    )
    expect(renderPortraitFactLine({ ...item, wording: 'juxtapose', state: 'contested' }, t)).toBe(
      'portrait_fact_juxtapose:github.com'
    )
    expect(
      renderPortraitFactLine(
        { ...item, wording: 'inferred', credibility: 0.4, state: 'unconfirmed' },
        t
      )
    ).toBe('portrait_fact_inferred:github.com')
  })

  it('分组视图含浮出 pending 簇', () => {
    const facts: PortraitFactRecord[] = [dualSourcePending('rag', ['note:1', 'note:2'])]
    const view = buildPortraitSummaryViewModel(buildPortraitSummary(facts), t)
    expect(view.clusters).toHaveLength(1)
    expect(view.clusters[0]?.items[0]?.line).toBe('portrait_fact_inferred:rag')
    expect(view.groups[0]?.key).toBe('unconfirmed')
  })

  it('存量 contested contentTerm 读侧自愈为 unconfirmed + inferred', () => {
    const facts: PortraitFactRecord[] = [
      {
        id: `${OWNER}\0contentTerm\0rag`,
        ownerId: OWNER,
        slot: 'contentTerm',
        value: 'rag',
        credibility: 0.55,
        state: 'contested',
        sources: [
          { type: 'inference', ref: 'n1', score: 0.55, observedAt: NOW },
          { type: 'inference', ref: 'n1b', score: 0.55, observedAt: NOW }
        ],
        inPortrait: false,
        createdAt: NOW,
        updatedAt: NOW
      },
      {
        id: `${OWNER}\0contentTerm\0vector`,
        ownerId: OWNER,
        slot: 'contentTerm',
        value: 'vector',
        credibility: 0.55,
        state: 'contested',
        sources: [
          { type: 'inference', ref: 'n2', score: 0.55, observedAt: NOW },
          { type: 'inference', ref: 'n2b', score: 0.55, observedAt: NOW }
        ],
        inPortrait: false,
        createdAt: NOW,
        updatedAt: NOW
      }
    ]
    const summary = buildPortraitSummary(facts)
    expect(summary.groups.contested).toHaveLength(0)
    expect(summary.groups.unconfirmed).toHaveLength(2)
    expect(summary.groups.unconfirmed.every(i => i.wording === 'inferred')).toBe(true)
    const view = buildPortraitSummaryViewModel(summary, t)
    expect(
      view.clusters.every(c => c.items.every(i => i.line.startsWith('portrait_fact_inferred:')))
    ).toBe(true)
  })

  it('批准后行文案改 direct 且在 verified 组', () => {
    const facts: PortraitFactRecord[] = [dualSourcePending('github.com', ['note:1', 'note:2'])]
    const view = buildPortraitSummaryViewModel(buildPortraitSummary(facts), t)
    expect(view.clusters[0]?.items[0]?.line).toBe('portrait_fact_inferred:github.com')
    const next = applyPortraitApproveToView(view, `${OWNER}\0contentTerm\0github.com`, t)
    expect(next.clusters).toHaveLength(0)
    const verified = next.groups.find(g => g.key === 'verified')
    expect(verified?.items).toHaveLength(1)
    expect(verified?.items[0]?.line).toBe('portrait_fact_direct:github.com')
    expect(verified?.items[0]?.inPortrait).toBe(true)
  })

  it('忽略后该行从视图移除', () => {
    const facts: PortraitFactRecord[] = [dualSourcePending('rag', ['note:1', 'note:2'])]
    const view = buildPortraitSummaryViewModel(buildPortraitSummary(facts), t)
    const next = applyPortraitDeclineToView(view, `${OWNER}\0contentTerm\0rag`, t)
    expect(next.clusters).toHaveLength(0)
    expect(
      next.groups.every(g => g.items.every(i => i.factId !== `${OWNER}\0contentTerm\0rag`))
    ).toBe(true)
  })

  it('整簇批准后簇移除且 narrative 更新', () => {
    const facts: PortraitFactRecord[] = [
      dualSourcePending('rag', ['note:shared', 'note:a'], 0.4),
      dualSourcePending('vector', ['note:shared', 'note:b'], 0.4),
      dualSourcePending('zig', ['note:z1', 'note:z2'], 0.55)
    ]
    const view = buildPortraitSummaryViewModel(buildPortraitSummary(facts), t)
    expect(view.clusters.length).toBeGreaterThanOrEqual(2)
    expect(view.pendingNarrative).toContain('portrait_narrative_pending')
    const shared = view.clusters.find(c => c.items.some(i => i.value === 'rag'))
    expect(shared).toBeTruthy()
    const factIds = shared!.items.map(i => i.factId)
    const next = applyPortraitApproveClusterToView(view, factIds, t)
    expect(next.clusters.every(c => !c.items.some(i => factIds.includes(i.factId)))).toBe(true)
    expect(next.pendingNarrative).not.toContain('rag')
    expect(next.groups.find(g => g.key === 'verified')?.items.length).toBe(factIds.length)
  })

  it('确定性叙事：前 3 代表 + 计数', () => {
    const items = [
      { value: 'a', credibility: 0.9 },
      { value: 'b', credibility: 0.8 },
      { value: 'c', credibility: 0.7 },
      { value: 'd', credibility: 0.6 },
      { value: 'e', credibility: 0.5 }
    ]
    expect(renderPortraitGroupNarrative('verified', items, t)).toBe(
      'portrait_narrative_verified_more:a, b, c|2'
    )
    expect(renderPortraitGroupNarrative('verified', items.slice(0, 2), t)).toBe(
      'portrait_narrative_verified:a, b'
    )
  })

  it('视图含 summaryText / narrative / factSignature', () => {
    const facts: PortraitFactRecord[] = [
      {
        id: `${OWNER}\0contentTerm\0github.com`,
        ownerId: OWNER,
        slot: 'contentTerm',
        value: 'github.com',
        credibility: 0.9,
        state: 'verified',
        sources: [
          { type: 'statement', ref: 'a', score: 0.5, observedAt: NOW },
          { type: 'behavior', ref: 'b', score: 0.8, observedAt: NOW }
        ],
        inPortrait: true,
        createdAt: NOW,
        updatedAt: NOW
      },
      dualSourcePending('zig', ['note:1', 'note:2'])
    ]
    const view = buildPortraitSummaryViewModel(buildPortraitSummary(facts), t)
    expect(view.summaryText).toContain('portrait_summary_lead:github.com')
    expect(view.summaryText).toContain('portrait_summary_pending_count:1')
    expect(view.groups.find(g => g.key === 'verified')?.narrative).toBe(
      'portrait_narrative_verified:github.com'
    )
    expect(view.pendingNarrative).toBe('portrait_narrative_pending:zig')
    expect(view.factSignature.length).toBeGreaterThan(0)
  })
})
