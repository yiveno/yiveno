/**
 * 绑定 OTP：邮箱归一化、8 位码、SHA-256、KV 存取、发码限流计数器。
 * 限流只在发信成功后递增；日志禁止写验证码明文。
 */

import type { Env } from '../../types/env'

/** 与 promote / billing 同口径 */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** OTP 有效期 / KV TTL（秒） */
export const BIND_OTP_TTL_SECONDS = 600

/** 同邮箱重发冷却（毫秒） */
export const BIND_OTP_COOLDOWN_MS = 60_000

/** 验码最大尝试次数 */
export const BIND_OTP_MAX_ATTEMPTS = 5

/** 每邮箱每小时发码上限 */
export const BIND_OTP_EMAIL_HOURLY_LIMIT = 5

/** 每设备（或 userId）每日发码上限 */
export const BIND_OTP_DEVICE_DAILY_LIMIT = 10

/** 每 IP 每日发码上限 */
export const BIND_OTP_IP_DAILY_LIMIT = 30

const BINDOTP_PREFIX = 'bindotp:' as const
const BINDRL_EMAIL_PREFIX = 'bindrl:email:' as const
const BINDRL_DEVICE_PREFIX = 'bindrl:device:' as const
const BINDRL_IP_PREFIX = 'bindrl:ip:' as const

export type BindOtpRecord = {
  codeHash: string
  attempts: number
  createdAt: number
  expiresAt: number
}

/** 可注入的 KV（生产 = env.AI_USAGE_KV） */
export type BindOtpKv = {
  get(key: string): Promise<string | null>
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>
  delete(key: string): Promise<void>
}

export function normalizeBindEmail(raw: string): string {
  return raw.trim().toLowerCase()
}

export function isValidBindEmail(raw: string): boolean {
  const email = normalizeBindEmail(raw)
  if (!email || email.length > 254) return false
  return EMAIL_RE.test(email)
}

/** 8 位数字，范围 10000000–99999999（首位非零） */
export function generateBindOtpCode(): string {
  const buf = new Uint32Array(1)
  crypto.getRandomValues(buf)
  const n = 10_000_000 + (buf[0]! % 90_000_000)
  return String(n)
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  const bytes = new Uint8Array(digest)
  let hex = ''
  for (const b of bytes) {
    hex += b.toString(16).padStart(2, '0')
  }
  return hex
}

/** 定长比较两个 hex（长度不同则 false） */
export function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return diff === 0
}

export function bindOtpKvKey(emailHash: string): string {
  return `${BINDOTP_PREFIX}${emailHash}`
}

function utcHourBucket(now: Date): string {
  const y = now.getUTCFullYear()
  const m = String(now.getUTCMonth() + 1).padStart(2, '0')
  const d = String(now.getUTCDate()).padStart(2, '0')
  const h = String(now.getUTCHours()).padStart(2, '0')
  return `${y}${m}${d}${h}`
}

function utcDayBucket(now: Date): string {
  const y = now.getUTCFullYear()
  const m = String(now.getUTCMonth() + 1).padStart(2, '0')
  const d = String(now.getUTCDate()).padStart(2, '0')
  return `${y}${m}${d}`
}

function resolveKv(env: Env, kv?: BindOtpKv): BindOtpKv | null {
  if (kv) return kv
  const binding = env.AI_USAGE_KV
  if (!binding) return null
  return binding as unknown as BindOtpKv
}

export async function storeBindOtpRecord(
  env: Env,
  normalizedEmail: string,
  record: BindOtpRecord,
  kvOverride?: BindOtpKv
): Promise<{ ok: true } | { ok: false; error: 'kv_unavailable' }> {
  const kv = resolveKv(env, kvOverride)
  if (!kv) return { ok: false, error: 'kv_unavailable' }
  const emailHash = await sha256Hex(normalizedEmail)
  await kv.put(bindOtpKvKey(emailHash), JSON.stringify(record), {
    expirationTtl: BIND_OTP_TTL_SECONDS
  })
  return { ok: true }
}

export async function getBindOtpRecord(
  env: Env,
  normalizedEmail: string,
  kvOverride?: BindOtpKv
): Promise<BindOtpRecord | null> {
  const kv = resolveKv(env, kvOverride)
  if (!kv) return null
  const emailHash = await sha256Hex(normalizedEmail)
  try {
    const raw = await kv.get(bindOtpKvKey(emailHash))
    if (!raw) return null
    const parsed = JSON.parse(raw) as unknown
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      typeof (parsed as BindOtpRecord).codeHash !== 'string' ||
      typeof (parsed as BindOtpRecord).attempts !== 'number' ||
      typeof (parsed as BindOtpRecord).createdAt !== 'number' ||
      typeof (parsed as BindOtpRecord).expiresAt !== 'number'
    ) {
      return null
    }
    return parsed as BindOtpRecord
  } catch {
    return null
  }
}

export async function deleteBindOtpRecord(
  env: Env,
  normalizedEmail: string,
  kvOverride?: BindOtpKv
): Promise<void> {
  const kv = resolveKv(env, kvOverride)
  if (!kv) return
  const emailHash = await sha256Hex(normalizedEmail)
  try {
    await kv.delete(bindOtpKvKey(emailHash))
  } catch {
    // 忽略删除失败
  }
}

async function readCounter(kv: BindOtpKv, key: string): Promise<number> {
  try {
    const raw = await kv.get(key)
    if (!raw) return 0
    const n = Number.parseInt(raw, 10)
    return Number.isFinite(n) && n > 0 ? n : 0
  } catch {
    return 0
  }
}

async function incrementCounter(kv: BindOtpKv, key: string, ttlSeconds: number): Promise<void> {
  const next = (await readCounter(kv, key)) + 1
  await kv.put(key, String(next), { expirationTtl: ttlSeconds })
}

export type BindRateLimitCheck = {
  limited: boolean
  /** 缺 IP 时跳过 IP 维 */
  skippedIp: boolean
}

/**
 * 检查邮箱小时 / 设备日 / IP 日是否已超限（不递增）。
 */
export async function checkBindOtpRateLimits(
  env: Env,
  input: {
    normalizedEmail: string
    deviceKey: string
    ip: string | null
    now?: Date
  },
  kvOverride?: BindOtpKv
): Promise<BindRateLimitCheck> {
  const kv = resolveKv(env, kvOverride)
  if (!kv) {
    // 无 KV 时由上层发码路径另报；此处视为未超限以免双重错误
    return { limited: false, skippedIp: true }
  }
  const now = input.now ?? new Date()
  const emailHash = await sha256Hex(input.normalizedEmail)
  const hour = utcHourBucket(now)
  const day = utcDayBucket(now)

  const emailCount = await readCounter(kv, `${BINDRL_EMAIL_PREFIX}${emailHash}:${hour}`)
  if (emailCount >= BIND_OTP_EMAIL_HOURLY_LIMIT) {
    return { limited: true, skippedIp: !input.ip }
  }

  const deviceCount = await readCounter(kv, `${BINDRL_DEVICE_PREFIX}${input.deviceKey}:${day}`)
  if (deviceCount >= BIND_OTP_DEVICE_DAILY_LIMIT) {
    return { limited: true, skippedIp: !input.ip }
  }

  const ip = input.ip?.trim() || null
  if (!ip) {
    return { limited: false, skippedIp: true }
  }
  const ipHash = await sha256Hex(ip)
  const ipCount = await readCounter(kv, `${BINDRL_IP_PREFIX}${ipHash}:${day}`)
  if (ipCount >= BIND_OTP_IP_DAILY_LIMIT) {
    return { limited: true, skippedIp: false }
  }
  return { limited: false, skippedIp: false }
}

/**
 * 发信成功后递增三維计数器（IP 缺则跳过该维）。
 */
export async function incrementBindOtpRateLimits(
  env: Env,
  input: {
    normalizedEmail: string
    deviceKey: string
    ip: string | null
    now?: Date
  },
  kvOverride?: BindOtpKv
): Promise<void> {
  const kv = resolveKv(env, kvOverride)
  if (!kv) return
  const now = input.now ?? new Date()
  const emailHash = await sha256Hex(input.normalizedEmail)
  const hour = utcHourBucket(now)
  const day = utcDayBucket(now)

  // 小时桶 TTL ≈ 2h；日桶 TTL ≈ 2d（略大于窗口，防漂移）
  await incrementCounter(kv, `${BINDRL_EMAIL_PREFIX}${emailHash}:${hour}`, 2 * 60 * 60)
  await incrementCounter(kv, `${BINDRL_DEVICE_PREFIX}${input.deviceKey}:${day}`, 2 * 24 * 60 * 60)

  const ip = input.ip?.trim() || null
  if (!ip) return
  const ipHash = await sha256Hex(ip)
  await incrementCounter(kv, `${BINDRL_IP_PREFIX}${ipHash}:${day}`, 2 * 24 * 60 * 60)
}
