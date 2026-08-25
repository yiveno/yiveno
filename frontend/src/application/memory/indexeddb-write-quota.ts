/**
 * IndexedDB 写配额耗尽检测与本会话熔断标记。
 * 独立文件，避免 bookmark-sync ↔ embedding 互相 import。
 */

import { logger } from '@/infrastructure/logging/logger'

/** 本会话 IndexedDB 已 QuotaExceeded：书签灌库应停止。 */
let indexedDbWriteQuotaExhausted = false

/** IndexedDB / Chrome 磁盘配额耗尽（DOMException.name）。 */
export function isIndexedDbQuotaExceededError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) {
    return false
  }
  if ('name' in error && error.name === 'QuotaExceededError') {
    return true
  }
  return error instanceof DOMException && error.code === 22
}

/** 本会话是否已判定写配额耗尽。 */
export function isIndexedDbWriteQuotaExhausted(): boolean {
  return indexedDbWriteQuotaExhausted
}

/** 标记本会话写配额耗尽（embedding / bookmark sync 共用）。 */
export function markIndexedDbWriteQuotaExhausted(reason = 'external'): void {
  if (indexedDbWriteQuotaExhausted) {
    return
  }
  indexedDbWriteQuotaExhausted = true
  logger.warn('IndexedDbQuota', 'IndexedDB 配额耗尽：本会话停止高成本写', { reason })
}

/** 测试用：清零本会话配额熔断。 */
export function resetIndexedDbWriteQuotaExhaustedForTests(): void {
  indexedDbWriteQuotaExhausted = false
}
