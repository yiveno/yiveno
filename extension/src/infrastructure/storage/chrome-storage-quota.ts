/**
 * chrome.storage.local / session 用量采样（getBytesInUse + QUOTA_BYTES）。
 * 仅 Background 可观测性；IndexedDB 配额见 indexeddb-write-quota。
 */

import { logger } from '@/infrastructure/logging/logger'

/** chrome.storage 用量超过该比例时打 warn（默认 80%）。 */
export const CHROME_STORAGE_QUOTA_WARN_RATIO = 0.8

export interface ChromeStorageAreaQuotaSnapshot {
  /** 存储分区：local / session */
  area: 'local' | 'session'
  bytesInUse: number
  quotaBytes: number
  /** 0–1，quotaBytes 为 0 时为 0 */
  usageRatio: number
}

function resolveChromeStorageArea(area: 'local' | 'session'): chrome.storage.StorageArea {
  return area === 'local' ? chrome.storage.local : chrome.storage.session
}

/** 计算用量比例，避免除零。 */
export function computeChromeStorageUsageRatio(bytesInUse: number, quotaBytes: number): number {
  if (!Number.isFinite(bytesInUse) || bytesInUse < 0) {
    return 0
  }
  if (!Number.isFinite(quotaBytes) || quotaBytes <= 0) {
    return 0
  }
  return bytesInUse / quotaBytes
}

/** 读取单个 chrome.storage 分区用量快照。 */
export async function readChromeStorageAreaQuota(
  area: 'local' | 'session'
): Promise<ChromeStorageAreaQuotaSnapshot> {
  const storage = resolveChromeStorageArea(area)
  const bytesInUse = await storage.getBytesInUse()
  const quotaBytes =
    area === 'local' ? chrome.storage.local.QUOTA_BYTES : chrome.storage.session.QUOTA_BYTES
  return {
    area,
    bytesInUse,
    quotaBytes,
    usageRatio: computeChromeStorageUsageRatio(bytesInUse, quotaBytes)
  }
}

/** 同时采样 local 与 session。 */
export async function sampleChromeStorageQuota(): Promise<ChromeStorageAreaQuotaSnapshot[]> {
  return Promise.all([readChromeStorageAreaQuota('local'), readChromeStorageAreaQuota('session')])
}

/** 是否达到告警阈值。 */
export function isChromeStorageQuotaHigh(
  snapshot: ChromeStorageAreaQuotaSnapshot,
  warnRatio: number = CHROME_STORAGE_QUOTA_WARN_RATIO
): boolean {
  return snapshot.usageRatio >= warnRatio
}

function formatQuotaPercent(ratio: number): string {
  return `${Math.round(ratio * 1000) / 10}%`
}

function snapshotToLogFields(snapshot: ChromeStorageAreaQuotaSnapshot): Record<string, unknown> {
  return {
    bytesInUse: snapshot.bytesInUse,
    quotaBytes: snapshot.quotaBytes,
    usagePercent: formatQuotaPercent(snapshot.usageRatio)
  }
}

/**
 * 采样 chrome.storage 用量；超阈值打 warn，否则静默（避免每次 SW 唤醒刷屏）。
 * 失败不抛出，仅记 warn。
 */
export async function logChromeStorageQuotaSample(scope: string): Promise<void> {
  try {
    const snapshots = await sampleChromeStorageQuota()
    const highAreas = snapshots.filter(snapshot => isChromeStorageQuotaHigh(snapshot))
    if (highAreas.length === 0) {
      return
    }

    logger.warn('ChromeStorageQuota', `${scope}：chrome.storage 用量偏高`, {
      scope,
      warnRatio: CHROME_STORAGE_QUOTA_WARN_RATIO,
      local: snapshotToLogFields(snapshots.find(s => s.area === 'local')!),
      session: snapshotToLogFields(snapshots.find(s => s.area === 'session')!),
      highAreas: highAreas.map(snapshot => snapshot.area)
    })
  } catch (error) {
    logger.warn('ChromeStorageQuota', `${scope}：chrome.storage 用量采样失败`, { scope, error })
  }
}
