/**
 * 扩展被其它设备挤掉后退登：本会话 Side Panel 软条提示（chrome.storage.session）。
 */

import { z } from 'zod'

import {
  readChromeStorageSession,
  removeChromeStorageSession,
  writeChromeStorageSession
} from '@/infrastructure/storage/chrome-storage-session'

export const EXTENSION_DISPLACED_NOTICE_KEY = 'yiveno:extension_displaced_notice' as const

const NoticeSchema = z.object({
  at: z.number().finite()
})

/** 是否有待展示的「被别处登录挤掉」提示。 */
export async function readExtensionDisplacedNotice(): Promise<boolean> {
  const row = await readChromeStorageSession(EXTENSION_DISPLACED_NOTICE_KEY, NoticeSchema)
  return row != null
}

/** 被挤掉 / refresh 作废退登后打标。 */
export async function writeExtensionDisplacedNotice(): Promise<void> {
  await writeChromeStorageSession(EXTENSION_DISPLACED_NOTICE_KEY, { at: Date.now() })
}

/** 登录成功或用户关闭软条后清除。 */
export async function clearExtensionDisplacedNotice(): Promise<void> {
  await removeChromeStorageSession(EXTENSION_DISPLACED_NOTICE_KEY)
}
