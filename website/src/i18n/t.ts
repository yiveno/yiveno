/**
 * 官网产品面 i18n：当前仅 en（美式英语）。
 * 用法与扩展 `t()` 同形——组件不写死用户可见句。
 */

import { en, type WebsiteMessageKey } from './en'

export type { WebsiteMessageKey }

/** 取官网文案；缺键在开发期应被类型拦住 */
export function t(key: WebsiteMessageKey): string {
  return en[key]
}
