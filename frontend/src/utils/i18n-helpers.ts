/**
 * 国际化辅助工具
 *
 * 提供便捷的国际化函数和 Vue Composable
 */

import { computed } from 'vue'
import { i18nService } from '@/infrastructure/i18n/i18n-service'

/**
 * Vue Composable - 国际化
 * @returns 国际化相关的响应式函数和状态
 *
 * @example
 * ```vue
 * <script setup>
 * const { t, locale, isRTL } = useI18n()
 * </script>
 *
 * <template>
 *   <div :dir="isRTL ? 'rtl' : 'ltr'">
 *     {{ t('welcome') }}
 *   </div>
 * </template>
 * ```
 */
export function useI18n() {
  const locale = computed(() => i18nService.getCurrentLanguage())

  const isRTL = computed(() => {
    // 当前不支持 RTL 语言
    const rtlLanguages: string[] = []
    return rtlLanguages.some(lang => locale.value.startsWith(lang))
  })

  const translate = (key: string, substitutions?: string | string[]) => {
    return i18nService.t(key, substitutions)
  }

  return {
    t: translate,
    locale,
    isRTL
  }
}

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
 * 判断是否为 RTL 语言
 * @returns 是否为从右到左的语言
 */
export function isRTLLanguage(): boolean {
  const locale = getCurrentLocale()
  // 当前不支持 RTL 语言
  const rtlLanguages: string[] = []
  return rtlLanguages.some(lang => locale.startsWith(lang))
}

/**
 * 获取语言显示名称
 * @param locale 语言代码
 * @returns 语言的本地化显示名称
 */
export function getLanguageDisplayName(locale: string): string {
  const displayNames: Record<string, string> = {
    'zh-CN': '简体中文',
    'zh-TW': '繁體中文',
    en: 'English',
    ja: '日本語',
    ko: '한국어',
    de: 'Deutsch',
    es: 'Español'
  }

  return displayNames[locale] || locale
}

/**
 * 获取支持的语言列表
 * @returns 支持的语言代码数组
 */
export function getSupportedLocales(): readonly string[] {
  return ['zh-CN', 'zh-TW', 'en', 'ja', 'ko', 'de', 'es'] as const
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

/**
 * 格式化货币（本地化）
 * @param value 金额
 * @param currency 货币代码
 * @returns 本地化的货币字符串
 *
 * @example
 * formatCurrency(99.99, 'USD') // "$99.99" (en) 或 "US$99.99" (zh-CN)
 * formatCurrency(99.99, 'CNY') // "¥99.99" (zh-CN)
 */
export function formatCurrency(value: number, currency: string): string {
  const locale = getCurrentLocale()
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency
  }).format(value)
}

/**
 * 复数形式处理
 * @param count 数量
 * @param key 翻译键
 * @returns 根据数量选择正确的复数形式
 *
 * @example
 * // en/messages.json:
 * // "bookmark_count": { "message": "$1 bookmark(s)" }
 *
 * pluralize(1, 'bookmark_count') // "1 bookmark"
 * pluralize(5, 'bookmark_count') // "5 bookmarks"
 */
export function pluralize(count: number, key: string): string {
  return t(key, String(count))
}
