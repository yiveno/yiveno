import type { MessageKey } from '@/infrastructure/i18n/message-keys'
import { t } from '@/infrastructure/i18n/t'
import { logger } from '@/infrastructure/logging/logger'

/** Side Panel / Outcome 关键文案：缺 dist/_locales 同步时会露出 key。 */
const CRITICAL_SIDE_PANEL_MESSAGE_KEYS: MessageKey[] = [
  'popup_dismiss_candidates',
  'popup_outcome_exit_prompt',
  'popup_outcome_exit_found',
  'popup_outcome_exit_none'
]

/**
 * 启动时校验关键文案是否已由 chrome.i18n 解析。
 * 若返回 key 本身，通常是 dist/_locales 未同步 → rebuild + 刷新扩展。
 */
export function warnIfCriticalExtensionMessagesMissing(): void {
  const missing: MessageKey[] = []
  for (const key of CRITICAL_SIDE_PANEL_MESSAGE_KEYS) {
    if (t(key) === key) {
      missing.push(key)
    }
  }
  if (missing.length === 0) {
    return
  }
  logger.warn('i18n', '关键 Side Panel 文案未解析（将露出 message key）', {
    missingKeys: missing,
    hint: '运行 frontend build/build:watch 同步 dist/_locales，并在 chrome://extensions 刷新 Yiveno'
  })
}
