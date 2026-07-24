import { logger } from '@/infrastructure/logging/logger'
import type { MessageKey, TranslateFn } from '@/infrastructure/i18n/message-keys'

export type { MessageKey, TranslateFn } from '@/infrastructure/i18n/message-keys'
export { MESSAGE_KEYS } from '@/infrastructure/i18n/message-keys'

/**
 * 读取扩展文案（`chrome.i18n.getMessage`）。
 * 缺 key 时打 warn 并返回 key 本身，禁止自然语言兜底。
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
