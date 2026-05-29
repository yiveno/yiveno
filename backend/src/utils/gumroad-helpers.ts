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

/** ArrayBuffer → 十六进制字符串 */
export function bufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

/** 时间安全字符串比较 */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let result = 0
  for (let i = 0; i < a.length; i += 1) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return result === 0
}
