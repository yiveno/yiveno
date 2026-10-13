import type { TranslateFn } from '@/core/i18n/translate'
import { logger } from '@/infrastructure/logging/logger'

export type { TranslateFn } from '@/core/i18n/translate'

/**
 * 读取扩展文案（`chrome.i18n.getMessage`）。
 * 缺 key 时打 warn 并返回 key 本身，禁止自然语言兜底。
 * 类型为 core `TranslateFn`，可直接注入 recall / empty 等纯函数。
 */
export const t: TranslateFn = (key, substitutions) => {
  const message =
    substitutions === undefined
      ? chrome.i18n.getMessage(key)
      : chrome.i18n.getMessage(key, substitutions)

  if (!message) {
    logger.warn('i18n', `缺少文案 key: ${key}`)
    return key
  }

  return message
}

/** 当前扩展 UI 语言（BCP 47），供 `toLocaleString` 等使用。 */
export function getUILanguage(): string {
  return chrome.i18n.getUILanguage()
}
