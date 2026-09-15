/**
 * 冷启动放行后轻条：本会话 dismiss 的 readyAt（chrome.storage.session）。
 */
import { z } from 'zod'
import {
  readChromeStorageSession,
  writeChromeStorageSession
} from '@/infrastructure/storage/chrome-storage-session'

export const COLD_START_POST_RELEASE_BANNER_DISMISS_KEY =
  'yiveno.coldStartPostReleaseBannerDismissedReadyAt' as const

const DismissPayloadSchema = z.object({
  readyAt: z.string().datetime()
})

/** 读取本会话已关闭轻条对应的 readyAt。 */
export async function readColdStartPostReleaseBannerDismissedReadyAt(): Promise<string | null> {
  const payload = await readChromeStorageSession(
    COLD_START_POST_RELEASE_BANNER_DISMISS_KEY,
    DismissPayloadSchema
  )
  return payload?.readyAt ?? null
}

/** 记录用户关闭轻条（绑定该次放行 readyAt）。 */
export async function writeColdStartPostReleaseBannerDismissedReadyAt(
  readyAt: string
): Promise<void> {
  await writeChromeStorageSession(COLD_START_POST_RELEASE_BANNER_DISMISS_KEY, { readyAt })
}
