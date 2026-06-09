/**
 * 构建时内嵌的 locale 文案，供 chrome.i18n 未命中时回退（常见于 watch 热更新后未重载扩展）
 */

import enMessages from '../../../public/_locales/en/messages.json'
import zhCNMessages from '../../../public/_locales/zh_CN/messages.json'
import zhTWMessages from '../../../public/_locales/zh_TW/messages.json'

interface MessageEntry {
  message: string
}

type MessageCatalog = Record<string, MessageEntry>

const catalogsByLocale: Record<string, MessageCatalog> = {
  en: enMessages,
  zh_CN: zhCNMessages,
  'zh-CN': zhCNMessages,
  zh_TW: zhTWMessages,
  'zh-TW': zhTWMessages
}

/**
 * 将 UI 语言代码映射到内嵌 catalog
 */
function resolveCatalog(locale: string): MessageCatalog {
  if (catalogsByLocale[locale]) {
    return catalogsByLocale[locale]
  }

  const normalized = locale.replace('-', '_')
  if (catalogsByLocale[normalized]) {
    return catalogsByLocale[normalized]
  }

  if (locale.startsWith('zh')) {
    return locale.toUpperCase().includes('TW') || locale.toUpperCase().includes('HK')
      ? zhTWMessages
      : zhCNMessages
  }

  return enMessages
}

/**
 * 应用 Chrome i18n 占位符替换
 */
export function applyMessageSubstitutions(
  template: string,
  substitutions?: string | string[]
): string {
  if (!substitutions) {
    return template
  }

  const values = Array.isArray(substitutions) ? substitutions : [substitutions]
  return values.reduce((message, value, index) => {
    return message.split(`$${index + 1}`).join(value)
  }, template)
}

/**
 * 从内嵌 catalog 获取文案（chrome.i18n 未同步新 key 时的兜底）
 */
export function getBundledMessage(
  key: string,
  locale: string,
  substitutions?: string | string[]
): string | undefined {
  const primary = resolveCatalog(locale)[key]?.message
  if (primary) {
    return applyMessageSubstitutions(primary, substitutions)
  }

  const english = resolveCatalog('en')[key]?.message
  if (english) {
    return applyMessageSubstitutions(english, substitutions)
  }

  return undefined
}
