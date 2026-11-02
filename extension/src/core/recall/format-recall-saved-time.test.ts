import { describe, expect, it } from 'vitest'

import { formatRecallSavedTime } from '@/core/recall/format-recall-saved-time'

describe('formatRecallSavedTime', () => {
  const nowMs = Date.parse('2026-08-27T12:00:00.000Z')

  it('无效 ISO 返回 null', () => {
    expect(formatRecallSavedTime('', { nowMs })).toBeNull()
    expect(formatRecallSavedTime('not-a-date', { nowMs })).toBeNull()
  })

  it('60 秒内可用 justSavedLabel', () => {
    const labels = formatRecallSavedTime('2026-08-27T11:59:30.000Z', {
      nowMs,
      justSavedLabel: 'Just saved'
    })
    expect(labels?.relative).toBe('Just saved')
    expect(labels?.absolute).toContain('2026')
  })

  it('数天前返回相对英文（缺省 locale）', () => {
    const labels = formatRecallSavedTime('2026-08-20T12:00:00.000Z', { nowMs })
    expect(labels?.relative).toMatch(/day|week/)
    expect(labels?.absolute.length).toBeGreaterThan(0)
  })

  it('zh-CN 相对时间跟 locale（不上 en last month）', () => {
    // ≥30 天且周档已出（diffDay/7≥5）→ 月份档；Intl zh-CN →「上个月」等
    const labels = formatRecallSavedTime('2026-07-20T12:00:00.000Z', {
      nowMs,
      locale: 'zh-CN'
    })
    expect(labels?.relative).toMatch(/月/)
    expect(labels?.relative).not.toMatch(/last month|month ago/i)
    expect(labels?.absolute.length).toBeGreaterThan(0)
  })
})
