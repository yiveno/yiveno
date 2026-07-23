import type { z } from 'zod'

import { logger } from '@/infrastructure/logging/logger'

/**
 * 读取 chrome.storage.local 中的 JSON 值并用 Zod 校验。
 * 键不存在或校验失败时返回 null。
 */
export async function readChromeStorageLocal<T>(
  key: string,
  schema: z.ZodType<T>
): Promise<T | null> {
  const result = await chrome.storage.local.get(key)
  const raw = result[key]
  if (raw === undefined) {
    return null
  }

  const parsed = schema.safeParse(raw)
  if (!parsed.success) {
    logger.warn('ChromeStorageLocal', '存储数据校验失败，忽略损坏项', {
      key,
      issues: parsed.error.issues
    })
    return null
  }

  return parsed.data
}

/** 写入 chrome.storage.local。 */
export async function writeChromeStorageLocal<T extends Record<string, unknown>>(
  key: string,
  value: T
): Promise<void> {
  await chrome.storage.local.set({ [key]: value })
}
