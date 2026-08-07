import type { z } from 'zod'

import { logger } from '@/infrastructure/logging/logger'

/**
 * 读取 chrome.storage.session 中的 JSON 值并用 Zod 校验。
 * 键不存在或校验失败时返回 null。
 */
export async function readChromeStorageSession<T>(
  key: string,
  schema: z.ZodType<T>
): Promise<T | null> {
  const result = await chrome.storage.session.get(key)
  const raw = result[key]
  if (raw === undefined) {
    return null
  }

  const parsed = schema.safeParse(raw)
  if (!parsed.success) {
    logger.warn('ChromeStorageSession', '存储数据校验失败，忽略损坏项', {
      key,
      issues: parsed.error.issues
    })
    return null
  }

  return parsed.data
}

/** 写入 chrome.storage.session。 */
export async function writeChromeStorageSession<T extends Record<string, unknown>>(
  key: string,
  value: T
): Promise<void> {
  await chrome.storage.session.set({ [key]: value })
}

/** 删除 chrome.storage.session 中的键。 */
export async function removeChromeStorageSession(key: string | string[]): Promise<void> {
  await chrome.storage.session.remove(key)
}
