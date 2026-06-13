/**
 * Favicon 服务相关类型定义
 *
 * 包含 Favicon 加载和缓存的所有类型
 */

import type { Timestamp } from '../core/common'

/**
 * Favicon 状态类型
 *
 * Favicon 的加载状态
 */
export type FaviconStatus = 'loading' | 'loaded' | 'error'

/**
 * Favicon 记录接口（内存缓存）
 *
 * 用于内存中缓存 Favicon 的加载状态
 */
export interface FaviconRecord {
  /** Favicon URL */
  url: string

  /** 加载状态 */
  status: FaviconStatus

  /** 已尝试的回退次数 */
  attempts: number

  /** 时间戳 */
  timestamp: Timestamp
}
