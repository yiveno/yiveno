/**
 * Cold Memory 量化探针单测（阶段五 · 2026-09-21）。
 * 验证：报告形状、阈值常量、beyondLimit 比例计算正确性。
 */

import { describe, expect, it } from 'vitest'

import { RECALL_SCAN_LIMIT } from '@/application/recall/backends/recall-scan-limit'
import {
  formatColdMemoryImpactReport,
  type ColdMemoryImpactReport
} from '@/dev/probe/probe-cold-memory-impact'

describe('probe-cold-memory-impact', () => {
  const sampleReport: ColdMemoryImpactReport = {
    totalCount: 1000,
    probeTruncated: false,
    beyondLimitCount: 0,
    beyondLimitRate: 0,
    indexedCount: 800,
    indexedRate: 0.8,
    beyondLimitIndexedCount: 0,
    beyondLimitIndexedRate: 0,
    oldestBeyondLimitIso: null,
    newestBeyondLimitIso: null,
    byType: { bookmark: 500, text_excerpt: 450, other: 50 },
    byLayer: { probe_noise_or_diversity: 200, other: 800 },
    scanLimit: RECALL_SCAN_LIMIT
  }

  it('格式化：未触发 cold memory → 提示不受影响', () => {
    const out = formatColdMemoryImpactReport(sampleReport)
    expect(out).toContain(`RECALL_SCAN_LIMIT = ${RECALL_SCAN_LIMIT}`)
    expect(out).toContain('库内总条目：1000')
    expect(out).toContain('目前不受 cold memory 影响')
  })

  it('格式化：cold memory 中倒排覆盖高 → 提示走方案 D', () => {
    const withCold: ColdMemoryImpactReport = {
      ...sampleReport,
      totalCount: 25000,
      beyondLimitCount: 5000,
      beyondLimitRate: 5000 / 25000,
      beyondLimitIndexedCount: 3000,
      beyondLimitIndexedRate: 3000 / 5000
    }
    const out = formatColdMemoryImpactReport(withCold)
    expect(out).toContain('> 20000 之外（cold memory）：5000')
    expect(out).toContain('cold memory 中过半有倒排，可走方案 D')
  })

  it('格式化：cold memory 倒排覆盖低 → 提示方案 B', () => {
    const withCold: ColdMemoryImpactReport = {
      ...sampleReport,
      totalCount: 25000,
      beyondLimitCount: 5000,
      beyondLimitRate: 5000 / 25000,
      beyondLimitIndexedCount: 1000,
      beyondLimitIndexedRate: 1000 / 5000
    }
    const out = formatColdMemoryImpactReport(withCold)
    expect(out).toContain('cold memory 倒排覆盖低，方案 B（full indexed）压力小')
  })

  it('格式化：噪声占比 > 真实 Capture 2× → 提示先净化', () => {
    const noisyLibrary: ColdMemoryImpactReport = {
      ...sampleReport,
      totalCount: 5000,
      byLayer: { probe_noise_or_diversity: 4000, other: 1000 }
    }
    const out = formatColdMemoryImpactReport(noisyLibrary)
    expect(out).toContain('噪声占主导，先 §5.9 种子研究净化库后再量化')
  })

  it('RECALL_SCAN_LIMIT 常量不变（防意外改阈值）', () => {
    expect(RECALL_SCAN_LIMIT).toBe(20000)
  })
})
