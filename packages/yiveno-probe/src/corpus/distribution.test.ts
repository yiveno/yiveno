/**
 * 分布工具固定种子统计（CI 确定性）。
 */

import { describe, expect, it } from 'vitest'

import { createSeededRng } from './prng'
import { pickZipfWeighted, planDaysAgoSequence, sampleSkewedDaysAgo } from './distribution'
import { buildDiversityExcerptSeeds, DIVERSITY_PACKS } from './diversity'
import type { RecallProbePersonaId } from './types'

const PERSONAS: readonly RecallProbePersonaId[] = [
  'researcher',
  'creator',
  'developer',
  'student',
  'knowledge_worker'
]

describe('sampleSkewedDaysAgo', () => {
  it('4000 次：三段占比贴近 60/25/15，值域 1–400', () => {
    const rng = createSeededRng(20260906)
    const n = 4000
    let near = 0
    let mid = 0
    let far = 0
    for (let i = 0; i < n; i += 1) {
      const d = sampleSkewedDaysAgo(rng)
      expect(d).toBeGreaterThanOrEqual(1)
      expect(d).toBeLessThanOrEqual(400)
      if (d <= 30) {
        near += 1
      } else if (d <= 120) {
        mid += 1
      } else {
        far += 1
      }
    }
    const nearRate = near / n
    const midRate = mid / n
    const farRate = far / n
    // 实测写进控制台供汇报（vitest 默认可见）

    console.log(
      `[skew] near=${(nearRate * 100).toFixed(2)}% mid=${(midRate * 100).toFixed(2)}% far=${(farRate * 100).toFixed(2)}%`
    )
    expect(Math.abs(nearRate - 0.6)).toBeLessThanOrEqual(0.04)
    expect(Math.abs(midRate - 0.25)).toBeLessThanOrEqual(0.04)
    expect(Math.abs(farRate - 0.15)).toBeLessThanOrEqual(0.04)
  })
})

describe('pickZipfWeighted', () => {
  it('1200 次 / 12 元：top-3 ∈ [0.50,0.68]，每元至少 1', () => {
    const list = Array.from({ length: 12 }, (_, i) => `s${i}`)
    const rng = createSeededRng(4242)
    const counts = new Map<string, number>()
    const n = 1200
    for (let i = 0; i < n; i += 1) {
      const hit = pickZipfWeighted(rng, list)
      counts.set(hit, (counts.get(hit) ?? 0) + 1)
    }
    for (const item of list) {
      expect(counts.get(item) ?? 0).toBeGreaterThanOrEqual(1)
    }
    const top3 = ((counts.get('s0') ?? 0) + (counts.get('s1') ?? 0) + (counts.get('s2') ?? 0)) / n

    console.log(`[zipf] top3=${(top3 * 100).toFixed(2)}%`)
    expect(top3).toBeGreaterThanOrEqual(0.5)
    expect(top3).toBeLessThanOrEqual(0.68)
  })
})

describe('planDaysAgoSequence', () => {
  it('count=150：成簇≥0.5、规模≥3 组≥4、≤30 天≥0.45', () => {
    const days = planDaysAgoSequence(20260906, 'days-bm', 'developer', 150)
    expect(days).toHaveLength(150)

    let clustered = 0
    for (let i = 0; i < days.length; i += 1) {
      const d = days[i]!
      const hasNeighbor = days.some((other, j) => j !== i && Math.abs(other - d) <= 3)
      if (hasNeighbor) {
        clustered += 1
      }
    }
    const clusterRate = clustered / days.length

    const sorted = [...days].sort((a, b) => a - b)
    const groups: number[][] = []
    let current: number[] = [sorted[0]!]
    for (let i = 1; i < sorted.length; i += 1) {
      if (sorted[i]! - sorted[i - 1]! <= 3) {
        current.push(sorted[i]!)
      } else {
        groups.push(current)
        current = [sorted[i]!]
      }
    }
    groups.push(current)
    const largeGroups = groups.filter(g => g.length >= 3).length

    const nearRate = days.filter(d => d <= 30).length / days.length

    console.log(
      `[burst] clusterRate=${(clusterRate * 100).toFixed(2)}% largeGroups=${largeGroups} near30=${(nearRate * 100).toFixed(2)}%`
    )
    expect(clusterRate).toBeGreaterThanOrEqual(0.5)
    expect(largeGroups).toBeGreaterThanOrEqual(4)
    expect(nearRate).toBeGreaterThanOrEqual(0.45)
  })
})

describe('excerpt diversity', () => {
  it('5 画像 ×150：互异 selectedText ≥40，无 (div N) 后缀', () => {
    for (const persona of PERSONAS) {
      const rows = buildDiversityExcerptSeeds(persona, 150, { seed: 20260906 })
      const texts = rows.map(r => r.selectedText)
      const unique = new Set(texts)

      console.log(`[excerpt:${persona}] unique=${unique.size}`)
      expect(unique.size).toBeGreaterThanOrEqual(40)
      for (const text of texts) {
        expect(text).not.toMatch(/\(div \d+\)$/)
      }
      expect(DIVERSITY_PACKS[persona].excerptMiddles.length).toBeGreaterThanOrEqual(8)
      expect(DIVERSITY_PACKS[persona].excerptClosers.length).toBeGreaterThanOrEqual(8)
    }
  })
})
