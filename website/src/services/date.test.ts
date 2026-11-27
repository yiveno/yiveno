import { describe, expect, test } from 'vitest'
import { formatDate, formatDateTime } from './date'
import { t } from '../i18n/t'

describe('formatDateTime', () => {
  test('无效日期回退未知', () => {
    const unknown = t('account.date.unknown')
    expect(formatDateTime(undefined)).toBe(unknown)
    expect(formatDateTime('')).toBe(unknown)
    expect(formatDateTime('not-a-date')).toBe(unknown)
  })

  test('有效日期含时间部分', () => {
    const iso = '2026-06-15T14:30:00.000Z'
    const result = formatDateTime(iso)
    expect(result).not.toBe(t('account.date.unknown'))
    // 相对纯日期更长，且含本地时:分（形态随 locale；钉数字与时间痕迹）
    expect(result.length).toBeGreaterThan(formatDate(iso).length)
    expect(result).toMatch(/\d{1,2}.+\d{2}|AM|PM|上午|下午/)
  })
})
