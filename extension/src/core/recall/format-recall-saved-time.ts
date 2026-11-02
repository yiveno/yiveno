/**
 * Recall 卡保存时间展示（相对 + 绝对）。
 * 纯函数；无 Chrome / DOM 依赖。locale 由调用方传入（BCP 47，与 UI 语言一致）。
 */

/** 保存时间双标签：相对主展示 + 绝对悬停/读屏。 */
export interface RecallSavedTimeLabels {
  /** 相对时间（如 “3 weeks ago” / “3 周前”） */
  relative: string
  /** 绝对时间（如 “Aug 1, 2026, 12:00 PM”） */
  absolute: string
}

/** 缺省 locale：测试与未接线调用回落美式英语。 */
const DEFAULT_LOCALE = 'en'

function formatAbsolute(date: Date, locale: string): string {
  return date.toLocaleString(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function formatRelativePast(
  diffMs: number,
  justSavedLabel: string | undefined,
  locale: string
): string {
  const diffSec = Math.floor(diffMs / 1000)
  if (diffSec < 60 && justSavedLabel) {
    return justSavedLabel
  }

  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) {
    return rtf.format(-diffMin, 'minute')
  }
  const diffHour = Math.floor(diffMin / 60)
  if (diffHour < 24) {
    return rtf.format(-diffHour, 'hour')
  }
  const diffDay = Math.floor(diffHour / 24)
  if (diffDay < 7) {
    return rtf.format(-diffDay, 'day')
  }
  const diffWeek = Math.floor(diffDay / 7)
  if (diffWeek < 5) {
    return rtf.format(-diffWeek, 'week')
  }
  const diffMonth = Math.floor(diffDay / 30)
  if (diffMonth < 12) {
    return rtf.format(-diffMonth, 'month')
  }
  const diffYear = Math.floor(diffDay / 365)
  return rtf.format(-Math.max(1, diffYear), 'year')
}

export type FormatRecallSavedTimeOptions = {
  nowMs?: number
  justSavedLabel?: string
  /** BCP 47（如 `en` / `zh-CN`）；须与当前 UI locale 一致。 */
  locale?: string
}

/**
 * 将 ISO 保存时间格式化为 Recall 卡 ECS 要素。
 * 未来时间或无效 ISO 返回 null。
 */
export function formatRecallSavedTime(
  iso: string,
  options?: FormatRecallSavedTimeOptions
): RecallSavedTimeLabels | null {
  const trimmed = iso.trim()
  if (!trimmed) {
    return null
  }
  const date = new Date(trimmed)
  const time = date.getTime()
  if (!Number.isFinite(time)) {
    return null
  }

  const nowMs = options?.nowMs ?? Date.now()
  const diffMs = nowMs - time
  if (diffMs < 0) {
    return null
  }

  const locale = options?.locale?.trim() || DEFAULT_LOCALE

  return {
    relative: formatRelativePast(diffMs, options?.justSavedLabel, locale),
    absolute: formatAbsolute(date, locale)
  }
}
