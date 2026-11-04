/**
 * diversity / noise 过程随机：同 seed 可复现；指纹仍可被 purge 分类识别。
 */

import { describe, expect, it } from 'vitest'

import {
  buildDiversityBookmarkSeeds,
  buildDiversityExcerptSeeds,
  buildNoiseBookmarkSeeds,
  buildNoiseExcerptSeeds,
  DEFAULT_PROBE_FILLER_SEED
} from '../index'

describe('probe filler procedural RNG', () => {
  it('同 seed 可复现 noise', () => {
    const a = buildNoiseBookmarkSeeds(20, { seed: 42 })
    const b = buildNoiseBookmarkSeeds(20, { seed: 42 })
    expect(a.map(x => x.title)).toEqual(b.map(x => x.title))
    expect(a.map(x => x.url)).toEqual(b.map(x => x.url))
  })

  it('不同 seed 改变 noise 标题组合', () => {
    const a = buildNoiseBookmarkSeeds(30, { seed: 1 })
    const b = buildNoiseBookmarkSeeds(30, { seed: 2 })
    expect(a.map(x => x.title).join('\n')).not.toEqual(b.map(x => x.title).join('\n'))
  })

  it('noise URL 保留 /probe/ 指纹', () => {
    const rows = buildNoiseBookmarkSeeds(15, { seed: DEFAULT_PROBE_FILLER_SEED })
    for (const row of rows) {
      expect(row.url).toMatch(/\/probe(?:\/|$)/i)
    }
    const excerpts = buildNoiseExcerptSeeds(10, { seed: 7 })
    for (const row of excerpts) {
      expect(row.sourceUrl).toMatch(/\/probe(?:\/|$)/i)
      expect(row.selectedText).toMatch(/filler excerpt/i)
    }
  })

  it('同 seed 可复现 diversity（内容字段 + 线索）', () => {
    const a = buildDiversityBookmarkSeeds('developer', 16, { seed: 99 })
    const b = buildDiversityBookmarkSeeds('developer', 16, { seed: 99 })
    expect(a.map(x => `${x.title}|${x.url}|${x.daysAgo}|${x.note ?? ''}`)).toEqual(
      b.map(x => `${x.title}|${x.url}|${x.daysAgo}|${x.note ?? ''}`)
    )
    expect(a.map(x => JSON.stringify(x.clues))).toEqual(b.map(x => JSON.stringify(x.clues)))
    expect(a.every(x => x.clues.length >= 1)).toBe(true)
  })

  it('diversity URL 保留 yiveno-div 指纹', () => {
    const rows = buildDiversityBookmarkSeeds('researcher', 12, { seed: 3 })
    for (const row of rows) {
      expect(row.url).toMatch(/yiveno-div|yivenoDiv/i)
    }
    const excerpts = buildDiversityExcerptSeeds('creator', 8, { seed: 3 })
    for (const row of excerpts) {
      expect(row.sourceUrl).toMatch(/yiveno-div|yivenoDiv/i)
      expect(row.selectedText).toMatch(/\(div \d+\)$/)
    }
  })

  it('标题不再是机械的 persona topic N 主形态', () => {
    const rows = buildDiversityBookmarkSeeds('developer', 40, { seed: 11 })
    const mechanical = rows.filter(r => /developer topic \d+$/i.test(r.title))
    expect(mechanical.length).toBe(0)
  })
})
