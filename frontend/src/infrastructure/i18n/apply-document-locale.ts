import type { MessageKey } from '@/infrastructure/i18n/message-keys'
import { getUILanguage, t } from '@/infrastructure/i18n/t'

/**
 * 扩展页面：设置 `document.documentElement.lang` 与 `document.title`。
 * 静态 HTML 的 title/lang 不能走 `__MSG_*__`，须在入口脚本调用。
 */
export function applyDocumentLocale(options: { titleKey: MessageKey }): void {
  document.documentElement.lang = getUILanguage()
  document.title = t(options.titleKey)
}
