/**
 * Side Panel「官网已登录 — Connect」软条：Dismiss 后本机仅显示一次（卸扩展后存储清空会再出现）。
 */

import { z } from 'zod'

import {
  readChromeStorageLocal,
  writeChromeStorageLocal
} from '@/infrastructure/storage/chrome-storage-local'

export const WEBSITE_CONNECT_BANNER_DISMISSED_KEY =
  'yiveno:website_connect_banner_dismissed' as const

const DismissedSchema = z.object({
  dismissed: z.literal(true)
})

export async function readWebsiteConnectBannerDismissed(): Promise<boolean> {
  const row = await readChromeStorageLocal(WEBSITE_CONNECT_BANNER_DISMISSED_KEY, DismissedSchema)
  return row?.dismissed === true
}

export async function writeWebsiteConnectBannerDismissed(): Promise<void> {
  await writeChromeStorageLocal(WEBSITE_CONNECT_BANNER_DISMISSED_KEY, { dismissed: true })
}
