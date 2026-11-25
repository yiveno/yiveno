/**
 * 画像摘要措辞 / 空态。
 */

import { describe, expect, it } from 'vitest'

import { buildPortraitSummary } from '@/core/portrait/build-portrait-summary'
import {
  applyPortraitApproveToView,
  applyPortraitDeclineToView,
  buildPortraitSummaryViewModel,
  renderPortraitFactLine
} from '@/core/portrait/render-portrait-summary'
import type { PortraitFactRecord } from '@/core/portrait/portrait-facts'

const OWNER = '11111111-1111-4111-8111-111111111111'
const NOW = '2026-11-25T08:00:00.000Z'

const t = (key: string, subs?: string | string[]) => {
  const value = Array.isArray(subs) ? subs[0] : subs
  return value ? `${key}:${value}` : key
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
      sourceTypes: ['behavior']
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
  })

  it('分组视图含 pending', () => {
    const facts: PortraitFactRecord[] = [
      {
        id: `${OWNER}\0contentTerm\0rag`,
        ownerId: OWNER,
        slot: 'contentTerm',
        value: 'rag',
        credibility: 0.4,
        state: 'unconfirmed',
        sources: [{ type: 'inference', ref: 'n', score: 0.4, observedAt: NOW }],
        inPortrait: false,
        createdAt: NOW,
        updatedAt: NOW
      }
    ]
    const view = buildPortraitSummaryViewModel(buildPortraitSummary(facts), t)
    expect(view.pendingInferences).toHaveLength(1)
    expect(view.groups[0]?.key).toBe('unconfirmed')
  })

  it('批准后行文案改 direct 且在 verified 组', () => {
    const facts: PortraitFactRecord[] = [
      {
        id: `${OWNER}\0contentTerm\0github.com`,
        ownerId: OWNER,
        slot: 'contentTerm',
        value: 'github.com',
        credibility: 0.4,
        state: 'unconfirmed',
        sources: [{ type: 'inference', ref: 'n', score: 0.4, observedAt: NOW }],
        inPortrait: false,
        createdAt: NOW,
        updatedAt: NOW
      }
    ]
    const view = buildPortraitSummaryViewModel(buildPortraitSummary(facts), t)
    expect(view.pendingInferences[0]?.line).toBe('portrait_fact_paraphrase:github.com')
    const next = applyPortraitApproveToView(view, `${OWNER}\0contentTerm\0github.com`, t)
    expect(next.pendingInferences).toHaveLength(0)
    const verified = next.groups.find(g => g.key === 'verified')
    expect(verified?.items).toHaveLength(1)
    expect(verified?.items[0]?.line).toBe('portrait_fact_direct:github.com')
    expect(verified?.items[0]?.inPortrait).toBe(true)
  })

  it('忽略后该行从视图移除', () => {
    const facts: PortraitFactRecord[] = [
      {
        id: `${OWNER}\0contentTerm\0rag`,
        ownerId: OWNER,
        slot: 'contentTerm',
        value: 'rag',
        credibility: 0.4,
        state: 'unconfirmed',
        sources: [{ type: 'inference', ref: 'n', score: 0.4, observedAt: NOW }],
        inPortrait: false,
        createdAt: NOW,
        updatedAt: NOW
      }
    ]
    const view = buildPortraitSummaryViewModel(buildPortraitSummary(facts), t)
    const next = applyPortraitDeclineToView(view, `${OWNER}\0contentTerm\0rag`, t)
    expect(next.pendingInferences).toHaveLength(0)
    expect(
      next.groups.every(g => g.items.every(i => i.factId !== `${OWNER}\0contentTerm\0rag`))
    ).toBe(true)
  })
})
