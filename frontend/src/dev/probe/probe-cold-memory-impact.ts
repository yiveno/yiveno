/**
 * DEV：Cold Memory 影响量化（实验一·阶段五 · 2026-09-21）。
 * 读库盘点：评估 RECALL_SCAN_LIMIT = 20000 对真实库的截断影响。
 *
 * 输出 5 项关键指标：
 * 1. totalCount：库内总条目数
 * 2. beyondLimitCount：> 20000 updatedAt 排序外的条目数
 * 3. indexedRate：有倒排 token 的条目占比（按 extractDocumentIndexTokens 估算）
 * 4. oldestBeyondLimitIso：被截断的最老条目 savedAt
 * 5. byType / byLayer：基础分类
 *
 * 仅 import.meta.env.DEV；不写库。
 */

import type { MemoryItem } from '@/core/memory/memory-item'
import { resolveMemoryItemSavedAtIso } from '@/core/memory/memory-item-saved-at'
import { extractDocumentIndexTokens } from '@/core/recall/extract-document-index-tokens'
import { RECALL_SCAN_LIMIT } from '@/application/recall/backends/recall-scan-limit'
import { isProbeNoiseOrDiversityItem } from '@/dev/probe/recall-probe-purge-classify'
import { getCurrentOwnerId } from '@/infrastructure/identity/local-profile-service'
import { memoryItemRepository } from '@/infrastructure/indexeddb/memory-item-repository'
import { flowFail, flowOk, flowStart } from '@/infrastructure/logging/flow-log'

/** 量化扫描上限：仅用于量化探针本身；与 RECALL_SCAN_LIMIT 解耦以观察 >20K 的实际情况。 */
const PROBE_SCAN_LIMIT = 100000

export interface ColdMemoryImpactReport {
  /** 库内总条目数。 */
  totalCount: number
  /** 是否被 PROBE_SCAN_LIMIT 截断（即库内实际 > 100000）。 */
  probeTruncated: boolean
  /** RECALL_SCAN_LIMIT 之外的条目数（cold memory）。 */
  beyondLimitCount: number
  /** cold memory 占库内比例。 */
  beyondLimitRate: number
  /** 倒排有 token 的条目数。 */
  indexedCount: number
  /** 倒排有 token 的条目占比。 */
  indexedRate: number
  /** cold memory 中倒排有 token 的条目数。 */
  beyondLimitIndexedCount: number
  /** cold memory 中倒排有 token 的占比（理论上仍可被关键词池找到的部分）。 */
  beyondLimitIndexedRate: number
  /** cold memory 中最早一条的 savedAtIso。 */
  oldestBeyondLimitIso: string | null
  /** cold memory 中最新一条的 savedAtIso。 */
  newestBeyondLimitIso: string | null
  /** 按类型计数。 */
  byType: { bookmark: number; text_excerpt: number; other: number }
  /** 按层计数（探针噪声 vs 其余）。 */
  byLayer: { probe_noise_or_diversity: number; other: number }
  /** RECALL_SCAN_LIMIT 常量（确认本次报告基线）。 */
  scanLimit: number
}

function titleOf(item: MemoryItem): string {
  if (item.type === 'bookmark') {
    return item.payload.title
  }
  return item.payload.pageTitle || item.payload.selectedText.slice(0, 80)
}

function urlOf(item: MemoryItem): string {
  if (item.type === 'bookmark') {
    return item.payload.url
  }
  return item.payload.sourceUrl
}

/** 模拟一次 recall 候选生成路径并量化冷记忆风险。 */
export async function buildColdMemoryImpactReport(): Promise<ColdMemoryImpactReport> {
  if (!import.meta.env.DEV) {
    throw new Error('buildColdMemoryImpactReport 仅允许 DEV 构建')
  }

  const startedAt = flowStart('DevProbe', 'Cold Memory 量化')
  try {
    await getCurrentOwnerId()
    const items = await memoryItemRepository.listByOwner({ limit: PROBE_SCAN_LIMIT })
    const probeTruncated = items.length >= PROBE_SCAN_LIMIT

    const totalCount = items.length

    // 按 updatedAt 倒序排序 → 模拟 listForKeywordRecall 的排序假设
    // 阶段一实验一已确认 listByOwner 输出按 updatedAt DESC。
    const sorted = [...items].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))

    // 倒排外的条目（cold memory）
    const beyond = sorted.slice(RECALL_SCAN_LIMIT)
    const beyondCount = beyond.length

    // 倒排有 token 计数
    let indexedCount = 0
    let beyondIndexedCount = 0
    let oldestBeyond: string | null = null
    let newestBeyond: string | null = null

    // 倒排 token 检查：调用真实 tokenizer（仅算 token set 非空）
    for (const item of sorted) {
      const tokens = extractDocumentIndexTokens(item)
      const hasIndex = tokens.length > 0
      if (hasIndex) {
        indexedCount += 1
      }
    }
    for (const item of beyond) {
      const tokens = extractDocumentIndexTokens(item)
      const savedAtIso = resolveMemoryItemSavedAtIso(item)
      if (tokens.length > 0) {
        beyondIndexedCount += 1
      }
      // 模拟"老条目"的真实 savedAt 时间窗
      if (!oldestBeyond || savedAtIso < oldestBeyond) {
        oldestBeyond = savedAtIso
      }
      if (!newestBeyond || savedAtIso > newestBeyond) {
        newestBeyond = savedAtIso
      }
    }

    const byType = { bookmark: 0, text_excerpt: 0, other: 0 }
    const byLayer = { probe_noise_or_diversity: 0, other: 0 }
    for (const item of items) {
      if (item.type === 'bookmark') {
        byType.bookmark += 1
      } else if (item.type === 'text_excerpt') {
        byType.text_excerpt += 1
      } else {
        byType.other += 1
      }
      if (isProbeNoiseOrDiversityItem(item)) {
        byLayer.probe_noise_or_diversity += 1
      } else {
        byLayer.other += 1
      }
    }

    const report: ColdMemoryImpactReport = {
      totalCount,
      probeTruncated,
      beyondLimitCount: beyondCount,
      beyondLimitRate: totalCount > 0 ? beyondCount / totalCount : 0,
      indexedCount,
      indexedRate: totalCount > 0 ? indexedCount / totalCount : 0,
      beyondLimitIndexedCount: beyondIndexedCount,
      beyondLimitIndexedRate: beyondCount > 0 ? beyondIndexedCount / beyondCount : 0,
      oldestBeyondLimitIso: oldestBeyond,
      newestBeyondLimitIso: newestBeyond,
      byType,
      byLayer,
      scanLimit: RECALL_SCAN_LIMIT
    }

    flowOk('DevProbe', 'Cold Memory 量化', startedAt, {
      total: report.totalCount,
      beyondLimit: report.beyondLimitCount,
      beyondLimitIndexedRate: report.beyondLimitIndexedRate.toFixed(3),
      probeTruncated: report.probeTruncated
    })

    return report
  } catch (error) {
    flowFail('DevProbe', 'Cold Memory 量化', startedAt, error)
    throw error
  }
}

/** 报告格式化（控制台 + UI 共用）。 */
export function formatColdMemoryImpactReport(report: ColdMemoryImpactReport): string {
  const lines = [
    `Cold Memory 量化报告（RECALL_SCAN_LIMIT = ${report.scanLimit}）`,
    `─────────────────────────────────────────`,
    `库内总条目：${report.totalCount}${report.probeTruncated ? '（超过 100K，量化截断）' : ''}`,
    `> ${report.scanLimit} 之外（cold memory）：${report.beyondLimitCount}（${(report.beyondLimitRate * 100).toFixed(1)}%）`,
    `倒排有 token：${report.indexedCount}（${(report.indexedRate * 100).toFixed(1)}%）`,
    `cold memory 中倒排有 token：${report.beyondLimitIndexedCount}（${(report.beyondLimitIndexedRate * 100).toFixed(1)}%）`,
    `cold memory 时间窗：${report.oldestBeyondLimitIso ?? 'N/A'} → ${report.newestBeyondLimitIso ?? 'N/A'}`,
    `按类型：bookmark=${report.byType.bookmark} text_excerpt=${report.byType.text_excerpt} other=${report.byType.other}`,
    `按层：noise=${report.byLayer.probe_noise_or_diversity} other=${report.byLayer.other}`,
    `─────────────────────────────────────────`,
    `关键判断：`,
    report.beyondLimitCount === 0
      ? `→ 你目前不受 cold memory 影响（库 < ${report.scanLimit}）`
      : report.beyondLimitIndexedRate > 0.5
        ? `→ cold memory 中过半有倒排，可走方案 D（age-aware secondary scan）`
        : `→ cold memory 倒排覆盖低，方案 B（full indexed）压力小`,
    report.byLayer.probe_noise_or_diversity > report.byLayer.other * 2
      ? `→ 噪声占主导，先 §5.9 种子研究净化库后再量化`
      : `→ 真实 Capture 主导，量化结果可信`
  ]
  return lines.join('\n')
}

// titleOf / urlOf 仅供将来 UI 渲染导出样本时使用；当前量化不需要 → 静默引用
void titleOf
void urlOf
