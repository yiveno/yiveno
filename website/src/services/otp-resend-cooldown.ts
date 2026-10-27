/**
 * Email OTP「再次发送」冷却：截止时间写入 sessionStorage。
 * 同标签刷新 / 后退可恢复倒计时；关标签丢弃。服务端限流仍是硬闸。
 */

import { normalizeEmail } from './auth-email'

/** 与 LoginForm UI、SMTP Minimum interval 建议值对齐 */
export const OTP_RESEND_COOLDOWN_SEC = 60

const STORAGE_KEY = 'yiveno.otpResendCooldown'

type StoredCooldown = {
  /** 已规范化邮箱 */
  email: string
  /** 冷却结束的 epoch ms */
  until: number
}

function readRaw(): StoredCooldown | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null
    const email = (parsed as { email?: unknown }).email
    const until = (parsed as { until?: unknown }).until
    if (typeof email !== 'string' || typeof until !== 'number' || !Number.isFinite(until)) {
      return null
    }
    const normalized = normalizeEmail(email)
    if (!normalized) return null
    return { email: normalized, until }
  } catch {
    return null
  }
}

function writeRaw(value: StoredCooldown): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(value))
  } catch {
    // 隐私模式 / 配额满：仅丢持久化，UI 倒计时仍可走内存
  }
}

function clearRaw(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
}

/** 还剩多少秒；已过期则清键并返回 0 */
export function remainingOtpResendSecFor(email: string): number {
  const stored = readRaw()
  if (!stored) return 0
  const target = normalizeEmail(email)
  if (!target || stored.email !== target) return 0
  const leftMs = stored.until - Date.now()
  if (leftMs <= 0) {
    clearRaw()
    return 0
  }
  return Math.max(1, Math.ceil(leftMs / 1000))
}

/** 当前仍有效的冷却快照（任意邮箱）；过期则清键 */
export function peekOtpResendCooldown(): { email: string; remainingSec: number } | null {
  const stored = readRaw()
  if (!stored) return null
  const leftMs = stored.until - Date.now()
  if (leftMs <= 0) {
    clearRaw()
    return null
  }
  return {
    email: stored.email,
    remainingSec: Math.max(1, Math.ceil(leftMs / 1000))
  }
}

/** 发码成功后写入截止时间 */
export function markOtpResendCooldown(
  email: string,
  seconds: number = OTP_RESEND_COOLDOWN_SEC
): void {
  const normalized = normalizeEmail(email)
  if (!normalized || seconds <= 0) return
  writeRaw({ email: normalized, until: Date.now() + seconds * 1000 })
}

export function clearOtpResendCooldown(): void {
  clearRaw()
}
