import { describe, expect, it } from 'vitest'

import {
  isRetiredEnrichmentSeedToken,
  scrubRetiredEnrichmentSeedTokens
} from '@/core/memory/retired-enrichment-seeds'

describe('retired-enrichment-seeds', () => {
  it('识别主题与实体 seed（大小写不敏感）', () => {
    expect(isRetiredEnrichmentSeedToken('wwii')).toBe(true)
    expect(isRetiredEnrichmentSeedToken('WWII')).toBe(true)
    expect(isRetiredEnrichmentSeedToken('Hitler')).toBe(true)
    expect(isRetiredEnrichmentSeedToken('Li Bai')).toBe(true)
    expect(isRetiredEnrichmentSeedToken('video')).toBe(false)
    expect(isRetiredEnrichmentSeedToken('tutorial')).toBe(false)
  })

  it('scrub 保序剔除', () => {
    expect(
      scrubRetiredEnrichmentSeedTokens(['video', 'wwii', 'youtube', 'Hitler', 'watch', 'Changchun'])
    ).toEqual(['video', 'youtube', 'watch'])
  })
})
