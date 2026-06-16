/**
 * 国际化辅助工具
 *
 * 提供便捷的国际化函数和 Vue Composable
 */

import { i18nService } from '@/infrastructure/i18n/i18n-service'

/**
 * 获取翻译文本（非响应式）
 * @param key 翻译键
 * @param substitutions 占位符替换（支持字符串或数组）
 * @returns 翻译后的文本
 */
export function t(key: string, substitutions?: string | string[]): string {
  return i18nService.t(key, substitutions)
}

/**
 * 获取当前语言
 * @returns 语言代码，如 'zh-CN', 'en', 'ja'
 */
export function getCurrentLocale(): string {
  return i18nService.getCurrentLanguage()
}

/**
 * 格式化数字（本地化）
 * @param value 数字
 * @param options 格式化选项
 * @returns 本地化的数字字符串
 *
 * @example
 * formatNumber(1234.56) // "1,234.56" (en) 或 "1,234.56" (zh-CN)
 * formatNumber(0.85, { style: 'percent' }) // "85%" (en) 或 "85%" (zh-CN)
 */
export function formatNumber(value: number, options?: Intl.NumberFormatOptions): string {
  const locale = getCurrentLocale()
  return new Intl.NumberFormat(locale, options).format(value)
}
