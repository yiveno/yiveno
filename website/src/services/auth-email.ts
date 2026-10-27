/**
 * 官网邮箱登录：纯格式校验（不碰网络）。
 * OTP / magic link 发信与校验见 `auth.ts`。
 */

/** 去空白并小写；空串返回 ''。 */
export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase()
}

/**
 * 宽松邮箱形态（产品面防手滑，非 RFC 全覆盖）。
 * 须含 @ 与域名点号；禁止空白与多余 @。
 */
export function isValidEmail(raw: string): boolean {
  const email = normalizeEmail(raw)
  if (!email || email.length > 254) return false
  // 本地@域名.tld；禁止空格与连续 @
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

/** 用户粘贴的 OTP：只留数字，最长 8（Supabase 默认 6）。 */
export function normalizeOtpCode(raw: string): string {
  return raw.replace(/\D/g, '').slice(0, 8)
}

export function isCompleteOtpCode(raw: string): boolean {
  const code = normalizeOtpCode(raw)
  return code.length >= 6 && code.length <= 8
}
