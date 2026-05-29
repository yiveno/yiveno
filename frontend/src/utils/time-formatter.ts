/**
 * 国际化时间格式化工具
 * 使用浏览器原生 Intl API，零依赖
 *
 * @description
 * - 自动检测用户语言环境
 * - 支持相对时间（"2小时前"）
 * - 支持本地化时间格式（12/24小时制）
 * - 零依赖，轻量级
 */

/**
 * 获取用户语言环境
 * @returns 用户的语言代码，如 'zh-CN', 'en-US', 'ja-JP'
 */
function getUserLocale(): string {
  return navigator.language || (navigator.languages && navigator.languages[0]) || 'en-US'
}

/**
 * 格式化相对时间
 * @param timestamp 时间戳（毫秒）
 * @returns 本地化的相对时间字符串
 * @example
 * formatRelativeTime(Date.now() - 3600000) // "1 hour ago" (en-US) 或 "1小时前" (zh-CN)
 */
export function formatRelativeTime(timestamp: number): string {
  const now = Date.now()
  const diff = now - timestamp
  const locale = getUserLocale()

  // 使用原生 Intl.RelativeTimeFormat
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })

  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)
  const weeks = Math.floor(days / 7)

  if (seconds < 60) return rtf.format(-seconds, 'second')
  if (minutes < 60) return rtf.format(-minutes, 'minute')
  if (hours < 24) return rtf.format(-hours, 'hour')
  if (days < 7) return rtf.format(-days, 'day')
  if (weeks < 4) return rtf.format(-weeks, 'week')

  // 超过4周，显示具体日期
  return formatDateTime(timestamp, { dateStyle: 'short' })
}

/**
 * 格式化具体时间
 * @param timestamp 时间戳（毫秒）
 * @returns 本地化的时间字符串
 * @example
 * formatTime(Date.now()) // "14:30:25" (zh-CN) 或 "2:30:25 PM" (en-US)
 */
export function formatTime(timestamp: number): string {
  const locale = getUserLocale()

  return new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: locale.startsWith('en-US') // 美国用12小时制
  }).format(timestamp)
}

/**
 * 格式化日期时间（完整格式）
 * @param timestamp 时间戳（毫秒）
 * @param options 格式化选项
 * @returns 本地化的日期时间字符串
 */
export function formatDateTime(timestamp: number, options?: Intl.DateTimeFormatOptions): string {
  const locale = getUserLocale()

  const defaultOptions: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }

  return new Intl.DateTimeFormat(locale, options || defaultOptions).format(timestamp)
}

/**
 * 格式化最近访问时间（只显示相对时间）
 * @param timestamp 时间戳（毫秒）
 * @returns 本地化的相对时间字符串
 * @example
 * // 中文: "2小时前"、"昨天"、"前天"
 * // 英文: "2 hours ago"、"yesterday"、"2 days ago"
 */
export function formatRecentVisitTime(timestamp?: number): string {
  if (!timestamp) return ''

  return formatRelativeTime(timestamp)
}

/**
 * 格式化完整时间（用于 tooltip）
 * @param timestamp 时间戳（毫秒）
 * @returns 本地化的完整时间字符串
 * @example
 * // 中文: "2025年1月16日 14:30:23"
 * // 英文: "Jan 16, 2025, 2:30:23 PM"
 */
export function formatFullDateTime(timestamp?: number): string {
  if (!timestamp) return ''

  const locale = getUserLocale()

  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: locale.startsWith('en-US')
  }).format(timestamp)
}
