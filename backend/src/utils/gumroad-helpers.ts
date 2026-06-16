/**
 * Gumroad 通用工具函数
 */

/** 将值转换为布尔值 */
export function toBoolean(flag: unknown): boolean {
  return flag === true || flag === 'true' || flag === '1'
}

/** 将值转换为 ISO 日期字符串，失败时返回 fallback */
export function toIsoDate(value: unknown, fallback: string | null = null): string | null {
  if (!value) return fallback
  const date = new Date(value as string | number | Date)
  if (Number.isNaN(date.getTime())) return fallback
  return date.toISOString()
}
