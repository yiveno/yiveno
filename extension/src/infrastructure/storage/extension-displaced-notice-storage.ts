/**
 * 「账号在别处登录了扩展，所以你这边下线了」软条（chrome.storage.session）。
 * **立意收窄：** 仅租约被他端占用（lease displaced）且非本机 Connect 编排时打标。
 * refresh 作废 / 本机 mint 自挤 → 静默退登，不写本标记。
 */

import { z } from 'zod'

import { logger } from '@/infrastructure/logging/logger'
import {
  readChromeStorageSession,
  removeChromeStorageSession,
  writeChromeStorageSession
} from '@/infrastructure/storage/chrome-storage-session'
import { isDisplacedNoticeSuppressed } from '@/infrastructure/storage/suppress-displaced-notice-storage'

export const EXTENSION_DISPLACED_NOTICE_KEY = 'yiveno:extension_displaced_notice' as const

/** revalidate 唯一允许打 elsewhere 软条的 reason。 */
export const DISPLACED_NOTICE_REASON = 'extension_session_displaced' as const

const NoticeSchema = z.object({
  at: z.number().finite()
})

/** 是否有待展示的「被别处登录挤掉」提示。 */
export async function readExtensionDisplacedNotice(): Promise<boolean> {
  const row = await readChromeStorageSession(EXTENSION_DISPLACED_NOTICE_KEY, NoticeSchema)
  return row != null
}

/**
 * 按立意决定是否打 elsewhere 软条。
 * @returns 是否已写入标记
 */
export async function maybeWriteExtensionDisplacedNotice(reason: string): Promise<boolean> {
  if (reason !== DISPLACED_NOTICE_REASON) {
    logger.info('Auth', '退登原因非他端挤掉，不展示 elsewhere 软条', { reason })
    return false
  }
  if (await isDisplacedNoticeSuppressed()) {
    logger.info('Auth', '本机 Connect 编排中，抑制 elsewhere 软条')
    return false
  }
  await writeChromeStorageSession(EXTENSION_DISPLACED_NOTICE_KEY, { at: Date.now() })
  return true
}

/** @deprecated 测试/内部：无门禁写入；生产路径请用 {@link maybeWriteExtensionDisplacedNotice} */
export async function writeExtensionDisplacedNotice(): Promise<void> {
  await writeChromeStorageSession(EXTENSION_DISPLACED_NOTICE_KEY, { at: Date.now() })
}

/** 登录成功或用户关闭软条后清除。 */
export async function clearExtensionDisplacedNotice(): Promise<void> {
  await removeChromeStorageSession(EXTENSION_DISPLACED_NOTICE_KEY)
}
