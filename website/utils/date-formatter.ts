/**
 * 国际化日期格式化工具
 * 
 * 根据用户的语言环境自动格式化日期时间
 */

/**
 * 获取用户的语言环境
 * 优先级：用户设置 > 浏览器语言 > 默认语言
 */
export const getUserLocale = (): string => {
  // 1. 尝试从 localStorage 获取用户设置的语言
  if (typeof window !== 'undefined') {
    const savedLocale = localStorage.getItem('user_locale')
    if (savedLocale) return savedLocale
  }

  // 2. 使用浏览器语言
  if (typeof navigator !== 'undefined') {
    return navigator.language || 'en-US'
  }

  // 3. 默认语言
  return 'en-US'
}

/**
 * 格式化日期时间（完整格式）
 * 
 * @param date - 日期对象或 ISO 字符串
 * @param locale - 语言环境（可选，默认自动检测）
 * @returns 格式化后的日期时间字符串
 * 
 * @example
 * formatDateTime('2027-05-07T13:15:57.576359+00:00')
 * // zh-CN: 2027年5月7日 13:15:57
 * // en-US: May 7, 2027, 1:15:57 PM
 * // ja-JP: 2027年5月7日 13:15:57
 */
export const formatDateTime = (
  date: Date | string,
  locale?: string
): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date
  const userLocale = locale || getUserLocale()

  return dateObj.toLocaleString(userLocale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  })
}

/**
 * 格式化日期（仅日期，不含时间）
 * 
 * @param date - 日期对象或 ISO 字符串
 * @param locale - 语言环境（可选，默认自动检测）
 * @returns 格式化后的日期字符串
 * 
 * @example
 * formatDate('2027-05-07')
 * // zh-CN: 2027年5月7日
 * // en-US: May 7, 2027
 * // ja-JP: 2027年5月7日
 */
export const formatDate = (
  date: Date | string,
  locale?: string
): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date
  const userLocale = locale || getUserLocale()

  return dateObj.toLocaleDateString(userLocale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
}

/**
 * 格式化时间（仅时间，不含日期）
 * 
 * @param date - 日期对象或 ISO 字符串
 * @param locale - 语言环境（可选，默认自动检测）
 * @returns 格式化后的时间字符串
 * 
 * @example
 * formatTime('2027-05-07T13:15:57')
 * // zh-CN: 13:15:57
 * // en-US: 1:15:57 PM
 */
export const formatTime = (
  date: Date | string,
  locale?: string
): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date
  const userLocale = locale || getUserLocale()

  return dateObj.toLocaleTimeString(userLocale, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  })
}

/**
 * 格式化相对时间（如：3天前、2小时后）
 * 
 * @param date - 日期对象或 ISO 字符串
 * @param locale - 语言环境（可选，默认自动检测）
 * @returns 相对时间字符串
 * 
 * @example
 * formatRelativeTime('2027-05-07')
 * // zh-CN: 1年后
 * // en-US: in 1 year
 */
export const formatRelativeTime = (
  date: Date | string,
  locale?: string
): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date
  const userLocale = locale || getUserLocale()
  const now = new Date()
  const diffMs = dateObj.getTime() - now.getTime()
  const diffSeconds = Math.floor(diffMs / 1000)
  const diffMinutes = Math.floor(diffSeconds / 60)
  const diffHours = Math.floor(diffMinutes / 60)
  const diffDays = Math.floor(diffHours / 24)
  const diffMonths = Math.floor(diffDays / 30)
  const diffYears = Math.floor(diffDays / 365)

  const rtf = new Intl.RelativeTimeFormat(userLocale, { numeric: 'auto' })

  if (Math.abs(diffYears) >= 1) {
    return rtf.format(diffYears, 'year')
  } else if (Math.abs(diffMonths) >= 1) {
    return rtf.format(diffMonths, 'month')
  } else if (Math.abs(diffDays) >= 1) {
    return rtf.format(diffDays, 'day')
  } else if (Math.abs(diffHours) >= 1) {
    return rtf.format(diffHours, 'hour')
  } else if (Math.abs(diffMinutes) >= 1) {
    return rtf.format(diffMinutes, 'minute')
  } else {
    return rtf.format(diffSeconds, 'second')
  }
}

/**
 * 格式化紧凑日期时间（短格式）
 * 
 * @param date - 日期对象或 ISO 字符串
 * @param locale - 语言环境（可选，默认自动检测）
 * @returns 格式化后的紧凑日期时间字符串
 * 
 * @example
 * formatCompactDateTime('2027-05-07T13:15:57')
 * // zh-CN: 2027/5/7 13:15
 * // en-US: 5/7/2027, 1:15 PM
 */
export const formatCompactDateTime = (
  date: Date | string,
  locale?: string
): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date
  const userLocale = locale || getUserLocale()

  return dateObj.toLocaleString(userLocale, {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  })
}

/**
 * 设置用户语言环境
 * 
 * @param locale - 语言环境代码（如：'zh-CN', 'en-US', 'ja-JP'）
 */
export const setUserLocale = (locale: string) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('user_locale', locale)
  }
}
