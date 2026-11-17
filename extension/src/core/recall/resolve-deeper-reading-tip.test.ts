import { describe, expect, it } from 'vitest'

import {
  DEEPER_READING_TIP_KEYS,
  resolveDeeperReadingTip
} from '@/core/recall/resolve-deeper-reading-tip'
import type { ClueLlmFailureKind } from '@/core/recall/understand/clue-llm-failure-kind'

describe('resolveDeeperReadingTip', () => {
  const catalog: Record<string, string> = {
    sidepanel_recall_deeper_reading_unavailable: 'generic deeper unavailable',
    sidepanel_recall_deeper_reading_quota_monthly: 'month $1/$2',
    sidepanel_recall_deeper_reading_quota_monthly_no_numbers: 'month used up',
    sidepanel_recall_deeper_reading_quota_daily: 'day $1/$2',
    sidepanel_recall_deeper_reading_quota_daily_no_numbers: 'day used up',
    sidepanel_recall_deeper_reading_timeout: 'timeout tip',
    sidepanel_recall_deeper_reading_network: 'network tip',
    sidepanel_recall_deeper_reading_auth: 'auth tip',
    sidepanel_recall_deeper_reading_provider_error: 'provider tip',
    sidepanel_recall_deeper_reading_not_configured: 'not configured tip',
    sidepanel_recall_deeper_reading_empty_response: 'empty tip'
  }

  const translate = (key: string, substitutions?: string | string[]) => {
    const raw = catalog[key] ?? key
    if (!substitutions) {
      return raw
    }
    const list = Array.isArray(substitutions) ? substitutions : [substitutions]
    return list.reduce((text, value, index) => text.replace(`$${index + 1}`, value), raw)
  }

  it('无 kind → null（rules / 成功路径不显示 tip）', () => {
    expect(resolveDeeperReadingTip(undefined, translate)).toBeNull()
  })

  it('9 个 kind 均映射到对应 key 文案', () => {
    const kinds = Object.keys(DEEPER_READING_TIP_KEYS) as ClueLlmFailureKind[]
    expect(kinds).toHaveLength(9)
    for (const kind of kinds) {
      if (kind === 'quota_monthly' || kind === 'quota_daily') {
        continue
      }
      const tip = resolveDeeperReadingTip(kind, translate)
      expect(tip).toBe(catalog[DEEPER_READING_TIP_KEYS[kind]])
    }
  })

  it('配额月/日有快照 → 带数字；无快照 → 无占位符原字面', () => {
    expect(
      resolveDeeperReadingTip('quota_monthly', translate, {
        used: 30,
        limit: 30,
        dailyUsed: 1,
        dailyLimit: 20
      })
    ).toBe('month 30/30')
    expect(resolveDeeperReadingTip('quota_monthly', translate)).toBe('month used up')
    expect(
      resolveDeeperReadingTip('quota_daily', translate, {
        used: 10,
        limit: 30,
        dailyUsed: 20,
        dailyLimit: 20
      })
    ).toBe('day 20/20')
    expect(resolveDeeperReadingTip('quota_daily', translate)).toBe('day used up')
  })
})
