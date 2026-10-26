/**
 * 扩展 UI 语言偏好与解析（纯函数；无 Chrome）。
 * 产品面：en = 美式英语；zh_CN = 简体中文。
 * 默认 `system`：跟浏览器语言偏好，不按 IP 国家锁定。
 */

/** 已支持的产品 UI locale（与 `_locales/` 目录名一致）。 */
export const UI_LOCALE_IDS = ['en', 'zh_CN'] as const

/** 产品 UI locale id。 */
export type UiLocaleId = (typeof UI_LOCALE_IDS)[number]

/**
 * 用户语言偏好。
 * - system：跟随浏览器 UI 语言
 * - en / zh_CN：强制该 locale
 */
export type UiLocalePreference = 'system' | UiLocaleId

/** 合法 preference 集合（含 system）。 */
export const UI_LOCALE_PREFERENCES = ['system', ...UI_LOCALE_IDS] as const

/** 浏览器语言是否视为中文偏好（含 zh、zh-CN、zh-Hans、zh_TW 等）。 */
export function isChineseBrowserLanguage(language: string): boolean {
  const normalized = language.trim().toLowerCase().replace(/_/g, '-')
  return normalized === 'zh' || normalized.startsWith('zh-')
}

/**
 * 将偏好 + 浏览器语言解析为实际 UI locale。
 * system 时：中文系浏览器 → zh_CN，否则 en。
 */
export function resolveUiLocale(
  preference: UiLocalePreference,
  browserLanguage: string
): UiLocaleId {
  if (preference === 'en' || preference === 'zh_CN') {
    return preference
  }
  return isChineseBrowserLanguage(browserLanguage) ? 'zh_CN' : 'en'
}

/** locale → BCP 47，供 `document.lang` / `toLocaleString`。 */
export function toBcp47LangTag(locale: UiLocaleId): string {
  return locale === 'zh_CN' ? 'zh-CN' : 'en'
}

/** 校验未知字符串是否为合法 preference。 */
export function parseUiLocalePreference(value: unknown): UiLocalePreference | null {
  if (typeof value !== 'string') {
    return null
  }
  return (UI_LOCALE_PREFERENCES as readonly string[]).includes(value)
    ? (value as UiLocalePreference)
    : null
}
