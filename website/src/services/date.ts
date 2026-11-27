/**
 * 官网日期展示：跟生效 UI locale（BCP 47）。
 * 禁止裸 `toLocaleDateString()` 无 locale。
 */

import { getWebsiteEffectiveUiLocale, toWebsiteBcp47LangTag } from '../i18n/locale'
import { t } from '../i18n/t'

/** 将 ISO / 可解析日期串格式化为用户可读长日期。 */
export function formatDate(dateStr: string | undefined): string {
  if (!dateStr) return t('account.date.unknown')
  try {
    const d = new Date(dateStr)
    if (Number.isNaN(d.getTime())) return t('account.date.unknown')
    const locale = toWebsiteBcp47LangTag(getWebsiteEffectiveUiLocale())
    return d.toLocaleDateString(locale, { year: 'numeric', month: 'long', day: 'numeric' })
  } catch {
    return t('account.date.unknown')
  }
}

/**
 * 将 ISO / 可解析日期串格式化为本地年月日 + 时:分。
 * 用于取消续订后的「Pro 至 …」到期时刻。
 */
export function formatDateTime(dateStr: string | undefined): string {
  if (!dateStr) return t('account.date.unknown')
  try {
    const d = new Date(dateStr)
    if (Number.isNaN(d.getTime())) return t('account.date.unknown')
    const locale = toWebsiteBcp47LangTag(getWebsiteEffectiveUiLocale())
    return d.toLocaleString(locale, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  } catch {
    return t('account.date.unknown')
  }
}
