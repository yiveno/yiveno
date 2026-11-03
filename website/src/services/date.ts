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
