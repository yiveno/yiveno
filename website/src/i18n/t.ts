/**
 * 官网产品面 i18n：en / zh_CN；默认跟浏览器，可覆盖并持久化。
 * 用法与扩展 `t()` 同形——已接入字典的组件不写死用户可见句。
 */

import { en, type WebsiteMessageKey } from './en'
import { getWebsiteEffectiveUiLocale, type WebsiteUiLocaleId } from './locale'
import { zh } from './zh'

export type { WebsiteMessageKey }

const catalogs: Record<WebsiteUiLocaleId, Record<WebsiteMessageKey, string>> = {
  en,
  zh_CN: zh
}

/** 取官网文案；缺键回退 en。 */
export function t(
  key: WebsiteMessageKey,
  locale: WebsiteUiLocaleId = getWebsiteEffectiveUiLocale()
): string {
  return catalogs[locale][key] ?? en[key]
}

/**
 * 取文案并替换 `{name}` 占位（如 `{email}` / `{seconds}`）。
 * 未知占位原样保留，便于发现漏传。
 */
export function tFormat(
  key: WebsiteMessageKey,
  vars: Record<string, string | number>,
  locale: WebsiteUiLocaleId = getWebsiteEffectiveUiLocale()
): string {
  return t(key, locale).replace(/\{([A-Za-z_][A-Za-z0-9_]*)\}/g, (match, name: string) => {
    const value = vars[name]
    return value === undefined ? match : String(value)
  })
}
