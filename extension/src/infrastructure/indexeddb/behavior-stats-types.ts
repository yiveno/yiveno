/**
 * `behavior_stats`：按 owner+url 聚合的浏览行为事实（本地-only；不上云）。
 * 事实层只记访问次数与时间；衰减在读时算，永不删行。
 */

import { z } from 'zod'

/**
 * 规范化浏览 URL：仅 http(s)；去 fragment（# 之后）；host 小写。
 * 不可用 → null。
 */
export function normalizeBehaviorUrl(url: string): string | null {
  try {
    const parsed = new URL(url.trim())
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null
    }
    parsed.hash = ''
    parsed.hostname = parsed.hostname.toLowerCase()
    return parsed.toString()
  } catch {
    return null
  }
}

/**
 * 从 URL 取展示用域名：hostname，去 www 前缀。
 * mail.google.com 与 drive.google.com 算两个站。
 */
export function extractBehaviorDomain(url: string): string | null {
  try {
    const parsed = new URL(url.trim())
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null
    }
    const host = parsed.hostname.toLowerCase()
    return host.startsWith('www.') ? host.slice(4) : host
  } catch {
    return null
  }
}

/** 单条行为统计行。 */
export const BehaviorStatsRecordSchema = z.object({
  /** 账号归属（同浏览器换号不串数据） */
  ownerId: z.string().uuid(),
  /** 去 fragment 后的完整 URL；与 ownerId 组成复合主键 */
  url: z.string().min(1),
  /** hostname，去 www */
  domain: z.string().min(1),
  /** 累计访问次数（跨重导入只增不减） */
  visitCount: z.number().int().positive(),
  /** 最近访问时间（epoch ms） */
  lastVisitTime: z.number().int().nonnegative(),
  /**
   * 累计停留毫秒；本批恒 0（字段先留，免迁移；第二片开始记）。
   */
  totalDwellMs: z.number().int().nonnegative(),
  /** 最近写入时间（ISO） */
  updatedAt: z.string().datetime()
})

export type BehaviorStatsRecord = z.infer<typeof BehaviorStatsRecordSchema>

/** 写入 / upsert 输入（尚未填 updatedAt）。 */
export type BehaviorStatsUpsertInput = {
  ownerId: string
  url: string
  visitCount: number
  lastVisitTime: number
  /** 缺省 0 */
  totalDwellMs?: number
}
