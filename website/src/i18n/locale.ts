/**
 * 官网 UI 语言：跟浏览器，可覆盖并持久化到 localStorage。
 * 不按 IP 国家锁定；与扩展 `ui-locale` 语义对齐。
 */

export const WEBSITE_UI_LOCALE_STORAGE_KEY = 'yiveno.website.uiLocale' as const

/** 官网已支持的 UI locale。 */
export type WebsiteUiLocaleId = 'en' | 'zh_CN'

/** 用户偏好：system 跟浏览器。 */
export type WebsiteUiLocalePreference = 'system' | WebsiteUiLocaleId

/** 规范化浏览器语言字符串；空 / 非字符串 → ''。 */
function normalizeBrowserLanguage(language: unknown): string {
  if (typeof language !== 'string') {
    return ''
  }
  return language.trim().toLowerCase().replace(/_/g, '-')
}

/** 浏览器语言是否视为中文偏好。 */
export function isChineseBrowserLanguage(language: unknown): boolean {
  const normalized = normalizeBrowserLanguage(language)
  return normalized === 'zh' || normalized.startsWith('zh-')
}

/** 偏好 + 浏览器语言 → 实际 locale。 */
export function resolveWebsiteUiLocale(
  preference: WebsiteUiLocalePreference,
  browserLanguage: unknown
): WebsiteUiLocaleId {
  if (preference === 'en' || preference === 'zh_CN') {
    return preference
  }
  return isChineseBrowserLanguage(browserLanguage) ? 'zh_CN' : 'en'
}

/** 解析 localStorage / 未知值；非法回退 system。 */
export function parseWebsiteUiLocalePreference(value: unknown): WebsiteUiLocalePreference {
  if (value === 'system' || value === 'en' || value === 'zh_CN') {
    return value
  }
  return 'system'
}

/** 读持久化偏好（SSR / 无 window 时 system）。 */
export function readWebsiteUiLocalePreference(): WebsiteUiLocalePreference {
  if (typeof localStorage === 'undefined') {
    return 'system'
  }
  try {
    return parseWebsiteUiLocalePreference(localStorage.getItem(WEBSITE_UI_LOCALE_STORAGE_KEY))
  } catch {
    return 'system'
  }
}

/** 写持久化偏好。 */
export function writeWebsiteUiLocalePreference(preference: WebsiteUiLocalePreference): void {
  if (typeof localStorage === 'undefined') {
    return
  }
  try {
    localStorage.setItem(WEBSITE_UI_LOCALE_STORAGE_KEY, preference)
  } catch {
    // 隐私模式等写失败：忽略，本次会话仍可用内存偏好
  }
}

/**
 * 读浏览器语言；SSR / 无 navigator / language 为空时回落 'en'。
 * Astro SSR 下可能存在 `navigator` 但 `language` 为 undefined。
 */
export function readBrowserLanguage(): string {
  if (typeof navigator === 'undefined') {
    return 'en'
  }
  const language = navigator.language
  return typeof language === 'string' && language.trim() ? language : 'en'
}

/** 当前生效 locale（偏好 + navigator.language）。 */
export function getWebsiteEffectiveUiLocale(
  preference: WebsiteUiLocalePreference = readWebsiteUiLocalePreference(),
  browserLanguage: string = readBrowserLanguage()
): WebsiteUiLocaleId {
  return resolveWebsiteUiLocale(preference, browserLanguage)
}

/** locale → html lang。 */
export function toWebsiteBcp47LangTag(locale: WebsiteUiLocaleId): string {
  return locale === 'zh_CN' ? 'zh-CN' : 'en'
}
