/**
 * 本机 Connect / mint 编排窗口：抑制「signed in elsewhere」软条。
 * 立意：elsewhere 仅表示他端占租约；本机官网铸会话自挤不得冒充。
 */

import { z } from 'zod'

import {
  readChromeStorageSession,
  removeChromeStorageSession,
  writeChromeStorageSession
} from '@/infrastructure/storage/chrome-storage-session'

export const SUPPRESS_DISPLACED_NOTICE_KEY = 'yiveno:suppress_displaced_notice' as const

/** 本机 Connect 编排默认抑制窗口（覆盖挤掉确认 + handoff）。 */
export const SUPPRESS_DISPLACED_NOTICE_TTL_MS = 120_000

const SuppressSchema = z.object({
  until: z.number().finite()
})

/** 是否处于本机 Connect 抑制窗（未过期）。 */
export async function isDisplacedNoticeSuppressed(): Promise<boolean> {
  const row = await readChromeStorageSession(SUPPRESS_DISPLACED_NOTICE_KEY, SuppressSchema)
  if (!row) {
    return false
  }
  if (Date.now() >= row.until) {
    await removeChromeStorageSession(SUPPRESS_DISPLACED_NOTICE_KEY)
    return false
  }
  return true
}

/** 开始本机 Connect / 即将 mint：打开抑制窗。 */
export async function beginSuppressDisplacedNotice(
  ttlMs: number = SUPPRESS_DISPLACED_NOTICE_TTL_MS
): Promise<void> {
  await writeChromeStorageSession(SUPPRESS_DISPLACED_NOTICE_KEY, {
    until: Date.now() + Math.max(1_000, ttlMs)
  })
}

/** Connect 结束：关闭抑制窗。 */
export async function endSuppressDisplacedNotice(): Promise<void> {
  await removeChromeStorageSession(SUPPRESS_DISPLACED_NOTICE_KEY)
}
