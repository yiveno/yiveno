/**
 * 偏好域名排序：三种算子、半衰期、平局、截断、空表。
 */

import { describe, expect, it } from 'vitest'

import { rankBehaviorDomains } from '@/core/behavior/rank-behavior-domains'
import type { BehaviorStatsRecord } from '@/infrastructure/indexeddb/behavior-stats-types'

const NOW = Date.UTC(2026, 10, 24, 12, 0, 0)
const DAY = 86_400_000

function row(
  partial: Pick<BehaviorStatsRecord, 'url' | 'domain' | 'visitCount' | 'lastVisitTime'> & {
    ownerId?: string
  }
): BehaviorStatsRecord {
  return {
    ownerId: partial.ownerId ?? '11111111-1111-4111-8111-111111111111',
    url: partial.url,
    domain: partial.domain,
    visitCount: partial.visitCount,
    lastVisitTime: partial.lastVisitTime,
    totalDwellMs: 0,
    updatedAt: '2026-11-24T00:00:00.000Z'
  }
}

describe('rankBehaviorDomains', () => {
  it('空表 → []', () => {
    expect(rankBehaviorDomains([], 'most_frequent', NOW)).toEqual([])
  })

  it('most_frequent：纯频次，不衰减', () => {
    const ranked = rankBehaviorDomains(
      [
        row({
          url: 'https://old.example/a',
          domain: 'old.example',
          visitCount: 100,
          lastVisitTime: NOW - 60 * DAY
        }),
        row({
          url: 'https://new.example/a',
          domain: 'new.example',
          visitCount: 10,
          lastVisitTime: NOW
        })
      ],
      'most_frequent',
      NOW
    )
    expect(ranked[0]?.domain).toBe('old.example')
    expect(ranked[0]?.visitCount).toBe(100)
  })

  it('favorite：30 天半衰期抬近站', () => {
    const ranked = rankBehaviorDomains(
      [
        row({
          url: 'https://old.example/a',
          domain: 'old.example',
          visitCount: 100,
          lastVisitTime: NOW - 90 * DAY
        }),
        row({
          url: 'https://new.example/a',
          domain: 'new.example',
          visitCount: 20,
          lastVisitTime: NOW
        })
      ],
      'favorite',
      NOW
    )
    expect(ranked[0]?.domain).toBe('new.example')
  })

  it('recent_frequent：7 天半衰期', () => {
    // 14 天前 20 次 → score≈5；今天 8 次 → 8，近站胜
    const ranked = rankBehaviorDomains(
      [
        row({
          url: 'https://week.example/a',
          domain: 'week.example',
          visitCount: 20,
          lastVisitTime: NOW - 14 * DAY
        }),
        row({
          url: 'https://today.example/a',
          domain: 'today.example',
          visitCount: 8,
          lastVisitTime: NOW
        })
      ],
      'recent_frequent',
      NOW
    )
    expect(ranked[0]?.domain).toBe('today.example')
  })

  it('平局：lastVisitTime 近者胜，再 domain 字典序', () => {
    const ranked = rankBehaviorDomains(
      [
        row({
          url: 'https://b.example/',
          domain: 'b.example',
          visitCount: 5,
          lastVisitTime: NOW - DAY
        }),
        row({
          url: 'https://a.example/',
          domain: 'a.example',
          visitCount: 5,
          lastVisitTime: NOW
        })
      ],
      'most_frequent',
      NOW
    )
    expect(ranked.map(entry => entry.domain)).toEqual(['a.example', 'b.example'])
  })

  it('同域名多 URL 先衰减再求和；topUrl 取访问最多', () => {
    const ranked = rankBehaviorDomains(
      [
        row({
          url: 'https://github.com/a',
          domain: 'github.com',
          visitCount: 3,
          lastVisitTime: NOW
        }),
        row({
          url: 'https://github.com/b',
          domain: 'github.com',
          visitCount: 10,
          lastVisitTime: NOW - DAY
        })
      ],
      'most_frequent',
      NOW
    )
    expect(ranked).toHaveLength(1)
    expect(ranked[0]?.visitCount).toBe(13)
    expect(ranked[0]?.topUrl).toBe('https://github.com/b')
    expect(ranked[0]?.urlCount).toBe(2)
  })

  it('topN 截断为 5', () => {
    const rows = Array.from({ length: 8 }, (_, index) =>
      row({
        url: `https://site${index}.example/`,
        domain: `site${index}.example`,
        visitCount: 8 - index,
        lastVisitTime: NOW
      })
    )
    expect(rankBehaviorDomains(rows, 'most_frequent', NOW, 5)).toHaveLength(5)
  })
})
