import type { TranslateFn } from '@/core/i18n/translate'
import { logger } from '@/infrastructure/logging/logger'
import type { MessageKey } from '@/infrastructure/i18n/message-keys'

export type { MessageKey } from '@/infrastructure/i18n/message-keys'
export type { TranslateFn } from '@/core/i18n/translate'
export { MESSAGE_KEYS } from '@/infrastructure/i18n/message-keys'

/**
 * 读取扩展文案（`chrome.i18n.getMessage`）。
 * 缺 key 时打 warn 并返回 key 本身，禁止自然语言兜底。
 */
export function t(key: MessageKey, substitutions?: string | string[]): string
export function t(key: string, substitutions?: string | string[]): string
export function t(key: string, substitutions?: string | string[]): string {
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

/** 作为可注入 core 的 TranslateFn（与 `t` 同一实现）。 */
export const translate: TranslateFn = t

/** 当前扩展 UI 语言（BCP 47），供 `toLocaleString` 等使用。 */
export function getUILanguage(): string {
  return chrome.i18n.getUILanguage()
}
