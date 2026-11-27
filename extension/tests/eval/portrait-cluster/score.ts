/**
 * portrait_cluster label 语义 scorer（纯函数）。
 * 划分合法（复用 validatePortraitClusters）且每多成员簇 label 命中期望关键词任一词。
 */

import {
  validatePortraitClusters,
  type PortraitClusterPartitionCluster
} from '@/core/portrait/validate-portrait-clusters'
import type { PortraitClusterEvalCase } from './cases'

export type PortraitClusterScoreRow = {
  id: string
  pass: boolean
  reasons: string[]
}

export type PortraitClusterScoreSummary = {
  rows: PortraitClusterScoreRow[]
  passed: number
  failed: number
  total: number
}

function labelHitsKeyword(label: string, keywords: readonly string[]): boolean {
  if (keywords.length === 0) {
    return true
  }
  const lower = label.toLowerCase()
  return keywords.some(keyword => {
    const needle = keyword.trim().toLowerCase()
    return needle.length > 0 && lower.includes(needle)
  })
}

/**
 * 对单组用例打分：raw LLM 输出 + case。
 */
export function scorePortraitClusterCase(
  caseRow: PortraitClusterEvalCase,
  rawText: string
): PortraitClusterScoreRow {
  const validated = validatePortraitClusters(rawText, caseRow.values)
  if (!validated.ok) {
    return {
      id: caseRow.id,
      pass: false,
      reasons: validated.reasons
    }
  }

  const reasons: string[] = []
  for (const cluster of validated.clusters) {
    const multi = cluster.items.length > 1
    if (!multi) {
      // 单成员：划分校验已要求 label===value
      continue
    }
    if (!labelHitsKeyword(cluster.label, caseRow.expectedLabelKeywords)) {
      reasons.push(`簇「${cluster.label}」未命中期望关键词`)
    }
  }

  return {
    id: caseRow.id,
    pass: reasons.length === 0,
    reasons
  }
}

/** 汇总多组结果。 */
export function summarizePortraitClusterScores(
  rows: readonly PortraitClusterScoreRow[]
): PortraitClusterScoreSummary {
  const passed = rows.filter(row => row.pass).length
  return {
    rows: [...rows],
    passed,
    failed: rows.length - passed,
    total: rows.length
  }
}

/** 测试辅助：从已校验簇构造假 JSON 原文。 */
export function fakePortraitClusterRaw(clusters: PortraitClusterPartitionCluster[]): string {
  return JSON.stringify({ clusters })
}
