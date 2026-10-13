import { describe, expect, it } from 'vitest'

import { createBookmarkMemoryItem } from '@/core/memory/create-memory-item'
import {
  entityMatchesHostBrand,
  extractDomainEnrichmentProfile,
  getDomainEnrichmentReuseKey,
  getMemoryItemHostname,
  mergeDomainProfileIntoExisting
} from '@/core/memory/domain-enrichment-profile'

describe('domain-enrichment-profile', () => {
  it('同 host 不同 path 共用 enrich:d 键', () => {
    const a = createBookmarkMemoryItem({
      ownerId: 'o',
      sourceLocalProfileId: 'p',
      payload: { title: 'A', url: 'https://www.google.com/a.html' }
    })
    const b = createBookmarkMemoryItem({
      ownerId: 'o',
      sourceLocalProfileId: 'p',
      payload: { title: 'B', url: 'https://google.com/b.html' }
    })
    expect(getMemoryItemHostname(a)).toBe('google.com')
    expect(getDomainEnrichmentReuseKey(a)).toBe('enrich:d:google.com')
    expect(getDomainEnrichmentReuseKey(a)).toBe(getDomainEnrichmentReuseKey(b))
  })

  it('只抽出站级 tags + 品牌 entities；忽略页面 keywords', () => {
    const item = createBookmarkMemoryItem({
      ownerId: 'o',
      sourceLocalProfileId: 'p',
      payload: { title: 'Pricing', url: 'https://github.com/org/repo' },
      clues: {
        tags: ['code', 'page', 'pricing-special'],
        keywords: ['billing', 'seat'],
        entities: ['GitHub', 'Octocat Mascot']
      }
    })
    const profile = extractDomainEnrichmentProfile(item)
    expect(profile).not.toBeNull()
    expect(profile?.tags).toEqual(expect.arrayContaining(['code', 'page']))
    expect(profile?.tags).not.toContain('pricing-special')
    expect(profile?.entities).toEqual(['GitHub'])
    expect(entityMatchesHostBrand('GitHub', 'github.com')).toBe(true)
    expect(entityMatchesHostBrand('Octocat Mascot', 'github.com')).toBe(false)
  })

  it('mergeDomainProfileIntoExisting 不覆盖 summary / 不注入 keywords', () => {
    const merged = mergeDomainProfileIntoExisting(
      {
        tags: ['page'],
        keywords: ['keep'],
        entities: [],
        summary: 'page summary'
      },
      { tags: ['code'], entities: ['GitHub'] }
    )
    expect(merged.keywords).toEqual(['keep'])
    expect(merged.summary).toBe('page summary')
    expect(merged.tags).toEqual(expect.arrayContaining(['page', 'code']))
    expect(merged.entities).toEqual(['GitHub'])
  })
})
