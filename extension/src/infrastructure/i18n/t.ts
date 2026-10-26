import type { TranslateFn } from '@/core/i18n/translate'
import {
  resolveUiLocale,
  toBcp47LangTag,
  type UiLocaleId,
  type UiLocalePreference
} from '@/core/i18n/ui-locale'
import { formatChromeI18nMessage } from '@/infrastructure/i18n/format-chrome-i18n-message'
import { logger } from '@/infrastructure/logging/logger'
import { getUserSettings } from '@/infrastructure/settings/user-settings-service'

export type { TranslateFn } from '@/core/i18n/translate'

/** Chrome `_locales` 单条文案 shape。 */
interface LocaleMessageEntry {
  message: string
  placeholders?: Record<string, { content: string; example?: string }>
  description?: string
}

type LocaleCatalog = Record<string, LocaleMessageEntry>

/** 当前生效 UI locale（设置加载前按浏览器粗判）。 */
let effectiveLocale: UiLocaleId = detectSystemLocaleSafe()

/** 已加载的文案目录；null 时回退 `chrome.i18n.getMessage`。 */
let catalog: LocaleCatalog | null = null

/** 并发 init 合并。 */
let initInFlight: Promise<UiLocaleId> | null = null

/** 无 chrome 时（单测）安全回落 en。 */
function detectSystemLocaleSafe(): UiLocaleId {
  try {
    const browserLanguage = chrome.i18n.getUILanguage()
    return resolveUiLocale('system', browserLanguage)
  } catch {
    return 'en'
  }
}

/** 读取 `_locales/<id>/messages.json`（扩展包内相对路径）。 */
async function loadLocaleCatalog(locale: UiLocaleId): Promise<LocaleCatalog> {
  const url = chrome.runtime.getURL(`_locales/${locale}/messages.json`)
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`加载 locale 目录失败: ${locale} HTTP ${response.status}`)
  }
  const json: unknown = await response.json()
  if (!json || typeof json !== 'object' || Array.isArray(json)) {
    throw new Error(`locale 目录 JSON 无效: ${locale}`)
  }
  return json as LocaleCatalog
}

/**
 * 按用户偏好解析并加载文案目录。
 * 页面入口 / SW bootstrap / content script 启动时调用。
 */
export async function initUiLocaleFromSettings(): Promise<UiLocaleId> {
  if (initInFlight) {
    return initInFlight
  }

  initInFlight = (async () => {
    let preference: UiLocalePreference = 'system'
    try {
      const settings = await getUserSettings()
      preference = settings.uiLocalePreference
    } catch (error) {
      logger.warn('i18n', '读取语言偏好失败，回退 system', {
        error: error instanceof Error ? error.message : String(error)
      })
    }

    const browserLanguage = chrome.i18n.getUILanguage()
    const nextLocale = resolveUiLocale(preference, browserLanguage)

    try {
      catalog = await loadLocaleCatalog(nextLocale)
      effectiveLocale = nextLocale
    } catch (error) {
      logger.warn('i18n', '加载文案目录失败，回退 chrome.i18n', {
        locale: nextLocale,
        error: error instanceof Error ? error.message : String(error)
      })
      catalog = null
      effectiveLocale = nextLocale
    }

    return effectiveLocale
  })().finally(() => {
    initInFlight = null
  })

  return initInFlight
}

/** 当前生效 UI locale（供测试 / 日志）。 */
export function getEffectiveUiLocale(): UiLocaleId {
  return effectiveLocale
}

/**
 * 测试用：注入目录与 locale，跳过 fetch。
 * 生产路径勿调用。
 */
export function setUiLocaleCatalogForTests(
  locale: UiLocaleId,
  nextCatalog: LocaleCatalog | null
): void {
  effectiveLocale = locale
  catalog = nextCatalog
}

/**
 * 读取扩展文案。
 * 优先已加载目录；否则 `chrome.i18n.getMessage`（Chrome UI 语言）。
 * 缺 key 时打 warn 并返回 key 本身，禁止自然语言兜底。
 */
export const t: TranslateFn = (key, substitutions) => {
  const entry = catalog?.[key]
  if (entry?.message) {
    return formatChromeI18nMessage(entry.message, substitutions)
  }

  const message =
    substitutions === undefined
      ? chrome.i18n.getMessage(key)
      : chrome.i18n.getMessage(key, substitutions)

  if (!message) {
    logger.warn('i18n', `缺少文案 key: ${key}`, { effectiveLocale })
    return key
  }

  return message
}

/**
 * 当前扩展 UI 语言（BCP 47）。
 * 尊重用户偏好解析结果，不仅是 Chrome UI 语言。
 */
export function getUILanguage(): string {
  return toBcp47LangTag(effectiveLocale)
}
