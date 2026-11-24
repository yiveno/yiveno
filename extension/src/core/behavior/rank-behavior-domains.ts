/**
 * 偏好问题：按域名汇总浏览行为并排序（纯函数）。
 * score = Σ visitCount × 0.5^(age_days / halfLife)；most_frequent 不衰减。
 */

import type { PreferenceOperator } from '@/core/recall/parse-recall-clue-types'
import type { BehaviorStatsRecord } from '@/infrastructure/indexeddb/behavior-stats-types'

const MS_PER_DAY = 86_400_000

/** 半衰期（天）；most_frequent = null 表示不衰减。 */
export function halfLifeDaysForOperator(operator: PreferenceOperator): number | null {
  switch (operator) {
    case 'most_frequent':
      return null
    case 'favorite':
      return 30
    case 'recent_frequent':
      return 7
  }
}

export type RankedBehaviorDomain = {
  domain: string
  /** 衰减后总分（内部；勿展示给用户） */
  score: number
  /** 域名下累计访问次数（跨 URL 求和） */
  visitCount: number
  /** 域名下最近访问时间 */
  lastVisitTime: number
  /** 该域名下访问最多的 URL（平局取 lastVisitTime 近者，再 url 字典序） */
  topUrl: string
  /** 域名下独立 URL 数 */
  urlCount: number
}

function decayedVisitScore(
  visitCount: number,
  lastVisitTime: number,
  nowMs: number,
  halfLifeDays: number | null
): number {
  if (halfLifeDays == null) {
    return visitCount
  }
  const ageDays = Math.max(0, (nowMs - lastVisitTime) / MS_PER_DAY)
  return visitCount * Math.pow(0.5, ageDays / halfLifeDays)
}

/**
 * 按 URL 先衰减再按域名求和；取 topN（默认 5）。
 * 平局：lastVisitTime 近者胜，再 domain 字典序。
 */
export function rankBehaviorDomains(
  rows: readonly BehaviorStatsRecord[],
  operator: PreferenceOperator,
  nowMs: number,
  topN = 5
): RankedBehaviorDomain[] {
  const halfLife = halfLifeDaysForOperator(operator)
  type Acc = {
    domain: string
    score: number
    visitCount: number
    lastVisitTime: number
    topUrl: string
    topUrlVisitCount: number
    topUrlLastVisitTime: number
    urlCount: number
  }
  const byDomain = new Map<string, Acc>()

  for (const row of rows) {
    const score = decayedVisitScore(row.visitCount, row.lastVisitTime, nowMs, halfLife)
    const existing = byDomain.get(row.domain)
    if (!existing) {
      byDomain.set(row.domain, {
        domain: row.domain,
        score,
        visitCount: row.visitCount,
        lastVisitTime: row.lastVisitTime,
        topUrl: row.url,
        topUrlVisitCount: row.visitCount,
        topUrlLastVisitTime: row.lastVisitTime,
        urlCount: 1
      })
      continue
    }
    existing.score += score
    existing.visitCount += row.visitCount
    existing.lastVisitTime = Math.max(existing.lastVisitTime, row.lastVisitTime)
    existing.urlCount += 1
    const betterTop =
      row.visitCount > existing.topUrlVisitCount ||
      (row.visitCount === existing.topUrlVisitCount &&
        (row.lastVisitTime > existing.topUrlLastVisitTime ||
          (row.lastVisitTime === existing.topUrlLastVisitTime &&
            row.url.localeCompare(existing.topUrl) < 0)))
    if (betterTop) {
      existing.topUrl = row.url
      existing.topUrlVisitCount = row.visitCount
      existing.topUrlLastVisitTime = row.lastVisitTime
    }
  }

  const ranked = [...byDomain.values()].sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score
    }
    if (b.lastVisitTime !== a.lastVisitTime) {
      return b.lastVisitTime - a.lastVisitTime
    }
    return a.domain.localeCompare(b.domain)
  })

  return ranked.slice(0, Math.max(0, topN)).map(entry => ({
    domain: entry.domain,
    score: entry.score,
    visitCount: entry.visitCount,
    lastVisitTime: entry.lastVisitTime,
    topUrl: entry.topUrl,
    urlCount: entry.urlCount
  }))
}
