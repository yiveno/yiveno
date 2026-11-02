import { describe, expect, it, vi } from 'vitest'

import {
  RECALL_TELEMETRY_EVIDENCE_ANCHOR_MAX_CHARS,
  RecallTelemetryEventSchema
} from '@/core/recall/recall-telemetry'
import {
  buildRecallEvidencePayload,
  scheduleRecallEvidenceWhenVisible
} from '@/pages/sidepanel/recall-result-card-evidence'

describe('buildRecallEvidencePayload', () => {
  it('无 telemetryRank 时返回 null', () => {
    expect(
      buildRecallEvidencePayload({
        id: 'a',
        typeLabel: 'Excerpt',
        subtitle: 'x',
        title: 't',
        url: 'https://example.com'
      })
    ).toBeNull()
  })

  it('含 rank 时组装 ECS 与 anchor', () => {
    const payload = buildRecallEvidencePayload({
      id: 'a',
      typeLabel: 'Excerpt',
      subtitle: 'Example · example.com',
      title: 'Title',
      url: 'https://example.com/p',
      excerpt: 'snippet',
      telemetryRank: 1,
      reasonCodes: ['note']
    })
    expect(payload).toMatchObject({
      memoryItemId: 'a',
      rank: 1,
      ecs: 3,
      reasonCodes: ['note'],
      anchor: 'snippet'
    })
  })

  it('超长摘录截到 anchor 上限，可通过 Zod', () => {
    const longExcerpt = `https://example.com/${'a'.repeat(300)} and more text`
    const payload = buildRecallEvidencePayload({
      id: '550e8400-e29b-41d4-a716-446655440000',
      typeLabel: 'Excerpt',
      subtitle: 'Example · example.com',
      title: 'Title',
      url: 'https://example.com/p',
      excerpt: longExcerpt,
      telemetryRank: 0
    })
    expect(payload?.anchor?.length).toBe(RECALL_TELEMETRY_EVIDENCE_ANCHOR_MAX_CHARS)
    expect(
      RecallTelemetryEventSchema.safeParse({
        type: 'evidence_visible',
        taskId: '550e8400-e29b-41d4-a716-446655440000',
        traceId: '550e8400-e29b-41d4-a716-446655440001',
        at: '2026-11-02T02:00:00.000Z',
        memoryItemId: '550e8400-e29b-41d4-a716-446655440000',
        rank: 0,
        ecs: 1,
        anchor: payload?.anchor
      }).success
    ).toBe(true)
  })
})

describe('scheduleRecallEvidenceWhenVisible', () => {
  it('无 root 时立即回调', () => {
    const onVisible = vi.fn()
    const cleanup = scheduleRecallEvidenceWhenVisible(() => null, onVisible)
    expect(onVisible).toHaveBeenCalledOnce()
    cleanup()
  })

  it('无 IntersectionObserver 时立即回调', () => {
    const original = globalThis.IntersectionObserver
    // @ts-expect-error 测试降级路径
    globalThis.IntersectionObserver = undefined

    const el = document.createElement('div')
    const onVisible = vi.fn()
    scheduleRecallEvidenceWhenVisible(() => el, onVisible)
    expect(onVisible).toHaveBeenCalledOnce()

    globalThis.IntersectionObserver = original
  })

  it('进入视口后回调一次并 disconnect', () => {
    let callback: IntersectionObserverCallback = () => {}
    const disconnect = vi.fn()
    const observe = vi.fn()

    class MockIntersectionObserver {
      constructor(cb: IntersectionObserverCallback) {
        callback = cb
      }
      observe = observe
      disconnect = disconnect
    }

    vi.stubGlobal('IntersectionObserver', MockIntersectionObserver)

    const el = document.createElement('div')
    const onVisible = vi.fn()
    const cleanup = scheduleRecallEvidenceWhenVisible(() => el, onVisible)
    expect(onVisible).not.toHaveBeenCalled()
    expect(observe).toHaveBeenCalledWith(el)

    callback([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver)
    expect(onVisible).toHaveBeenCalledOnce()
    expect(disconnect).toHaveBeenCalledOnce()

    callback([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver)
    expect(onVisible).toHaveBeenCalledOnce()

    cleanup()
    vi.unstubAllGlobals()
  })
})
