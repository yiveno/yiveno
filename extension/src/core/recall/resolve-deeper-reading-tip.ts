/**
 * rules_fallback 更深理解轻提示：按失败 kind 分流（纯函数，供 Side Panel / 单测）。
 */

import type { TranslateFn } from '@/core/i18n/translate'
import type {
  ClueLlmFailureKind,
  ClueLlmFailureQuotaSnapshot
} from '@/core/recall/understand/clue-llm-failure-kind'

/** kind → i18n key（unknown 用既有泛化 key）。 */
export const DEEPER_READING_TIP_KEYS: Record<ClueLlmFailureKind, string> = {
  quota_monthly: 'sidepanel_recall_deeper_reading_quota_monthly',
  quota_daily: 'sidepanel_recall_deeper_reading_quota_daily',
  timeout: 'sidepanel_recall_deeper_reading_timeout',
  network: 'sidepanel_recall_deeper_reading_network',
  auth: 'sidepanel_recall_deeper_reading_auth',
  provider_error: 'sidepanel_recall_deeper_reading_provider_error',
  not_configured: 'sidepanel_recall_deeper_reading_not_configured',
  empty_response: 'sidepanel_recall_deeper_reading_empty_response',
  unknown: 'sidepanel_recall_deeper_reading_unavailable'
}

/** 配额快照缺失时的无数字退回文案 key。 */
const QUOTA_TIP_KEYS_WITHOUT_NUMBERS = {
  quota_monthly: 'sidepanel_recall_deeper_reading_quota_monthly_no_numbers',
  quota_daily: 'sidepanel_recall_deeper_reading_quota_daily_no_numbers'
} as const

/**
 * 生成 deeper-reading tip 文案。
 * - 无 kind（或非 fallback 调用方）→ null（不显示）
 * - 配额类有完整快照 → 带数字插值；缺快照 → 无数字同义文案（不露出 $USED$ 原字面）
 */
export function resolveDeeperReadingTip(
  kind: ClueLlmFailureKind | undefined,
  translate: TranslateFn,
  quota?: ClueLlmFailureQuotaSnapshot
): string | null {
  if (!kind) {
    return null
  }
  if (kind === 'quota_monthly') {
    if (quota) {
      return translate(DEEPER_READING_TIP_KEYS.quota_monthly, [
        String(quota.used),
        String(quota.limit)
      ])
    }
    return translate(QUOTA_TIP_KEYS_WITHOUT_NUMBERS.quota_monthly)
  }
  if (kind === 'quota_daily') {
    if (quota) {
      return translate(DEEPER_READING_TIP_KEYS.quota_daily, [
        String(quota.dailyUsed),
        String(quota.dailyLimit)
      ])
    }
    return translate(QUOTA_TIP_KEYS_WITHOUT_NUMBERS.quota_daily)
  }
  return translate(DEEPER_READING_TIP_KEYS[kind])
}
