/**
 * 从边缘请求头解析访客国家（ISO 3166-1 alpha-2）。
 * Cloudflare: cf-ipcountry；Vercel: x-vercel-ip-country。
 * 未知码（XX / T1 / OTHERS）仅作应用内哨兵，永不传给 Paddle。
 */

const INVALID = new Set(['', 'XX', 'T1', 'OTHERS', 'ZZ'])

export function resolveVisitorCountry(headers: Headers): string | undefined {
  const raw =
    headers.get('cf-ipcountry') ||
    headers.get('x-vercel-ip-country') ||
    headers.get('x-country-code') ||
    ''
  const code = raw.trim().toUpperCase()
  if (INVALID.has(code) || !/^[A-Z]{2}$/.test(code)) {
    return undefined
  }
  return code
}
