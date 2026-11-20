/**
 * 会话作废 / 被挤掉退登后：账号桶已回迁到本地档的提示（chrome.storage.session）。
 * 文案须感知 flush 成败（诚实归因）；与 displaced elsewhere 软条独立。
 */

import { z } from 'zod'

import {
  readChromeStorageSession,
  removeChromeStorageSession,
  writeChromeStorageSession
} from '@/infrastructure/storage/chrome-storage-session'

export const SIGN_OUT_REMAP_NOTICE_KEY = 'yiveno:sign_out_remap_notice' as const

const NoticeSchema = z.object({
  /** 退登前 flush 是否成功 */
  flushOk: z.boolean(),
  at: z.number().finite()
})

export type SignOutRemapNotice = z.infer<typeof NoticeSchema>

/** 读取待展示的回迁提示；无则 null。 */
export async function readSignOutRemapNotice(): Promise<SignOutRemapNotice | null> {
  return readChromeStorageSession(SIGN_OUT_REMAP_NOTICE_KEY, NoticeSchema)
}

/** 写入回迁提示（invalid 退登路径）。 */
export async function writeSignOutRemapNotice(flushOk: boolean): Promise<void> {
  await writeChromeStorageSession(SIGN_OUT_REMAP_NOTICE_KEY, {
    flushOk,
    at: Date.now()
  })
}

/** 用户关闭软条或再次登录后清除。 */
export async function clearSignOutRemapNotice(): Promise<void> {
  await removeChromeStorageSession(SIGN_OUT_REMAP_NOTICE_KEY)
}
