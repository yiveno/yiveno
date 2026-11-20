/**
 * 设备 token（D 方案）KV 读写：devtok / user_devs / user_meta。
 * 日志只打 deviceId / token 末 4 字符；禁止完整 token 进日志。
 */

import type { Env } from '../../types/env'
import { warn } from '../../utils/logger'

/** Bearer / 存储用前缀（与 JWT / uninstall revoke 区分） */
export const DEVICE_TOKEN_PREFIX = 'ydt_' as const

const DEVTOK_PREFIX = 'devtok:' as const
const USER_DEVS_PREFIX = 'user_devs:' as const
const USER_META_PREFIX = 'user_meta:' as const

/** 设备记录（权威：devtok:{token}） */
export type DeviceTokenRecord = {
  deviceId: string
  userId: string
  createdAt: string
  lastSeenAt: string
  deviceLabel: string
  platform: string
  extensionId?: string
  /** 签发时是否匿名（审计冗余；权威以 user_meta 为准） */
  isAnonymousAtIssue: boolean
  revokedAt?: string
}

/** 用户设备索引行 */
export type UserDeviceIndexEntry = {
  deviceId: string
  deviceLabel: string
  platform: string
  createdAt: string
  lastSeenAt: string
  /** token 末 8 字符，仅运维对照，非密钥 */
  tokenKeySuffix: string
}

export type UserDevicesIndex = {
  devices: UserDeviceIndexEntry[]
}

/** 配额权威元数据 */
export type UserMetaRecord = {
  isAnonymous: boolean
  email?: string
  updatedAt: string
}

/** 生成 opaque device token：`ydt_` + 64 hex（两次 UUID 去连字符）。 */
export function createDeviceToken(): string {
  const hex = `${crypto.randomUUID().replace(/-/g, '')}${crypto.randomUUID().replace(/-/g, '')}`
  return `${DEVICE_TOKEN_PREFIX}${hex}`
}

export function isDeviceTokenFormat(token: string): boolean {
  return /^ydt_[0-9a-f]{64}$/i.test(token)
}

export function deviceTokenKvKey(token: string): string {
  return `${DEVTOK_PREFIX}${token}`
}

export function userDevicesKvKey(userId: string): string {
  return `${USER_DEVS_PREFIX}${userId}`
}

export function userMetaKvKey(userId: string): string {
  return `${USER_META_PREFIX}${userId}`
}

/** 日志用：只暴露末 4 字符 */
export function deviceTokenLogSuffix(token: string): string {
  return token.slice(-4)
}

export async function getDeviceTokenRecord(
  env: Env,
  token: string
): Promise<DeviceTokenRecord | null> {
  const kv = env.AI_USAGE_KV
  if (!kv) return null
  try {
    const raw = await kv.get(deviceTokenKvKey(token))
    if (!raw) return null
    const parsed = JSON.parse(raw) as unknown
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      typeof (parsed as DeviceTokenRecord).deviceId !== 'string' ||
      typeof (parsed as DeviceTokenRecord).userId !== 'string'
    ) {
      return null
    }
    return parsed as DeviceTokenRecord
  } catch {
    warn('[DeviceAuth] 读取 devtok 失败')
    return null
  }
}

export async function putDeviceTokenRecord(
  env: Env,
  token: string,
  record: DeviceTokenRecord
): Promise<{ ok: true } | { ok: false; error: 'kv_unavailable' | 'kv_put_failed' }> {
  const kv = env.AI_USAGE_KV
  if (!kv) return { ok: false, error: 'kv_unavailable' }
  try {
    await kv.put(deviceTokenKvKey(token), JSON.stringify(record))
    return { ok: true }
  } catch {
    warn('[DeviceAuth] 写入 devtok 失败', {
      deviceId: record.deviceId,
      tokenSuffix: deviceTokenLogSuffix(token)
    })
    return { ok: false, error: 'kv_put_failed' }
  }
}

export async function deleteDeviceTokenRecord(env: Env, token: string): Promise<void> {
  if (!env.AI_USAGE_KV) return
  try {
    await env.AI_USAGE_KV.delete(deviceTokenKvKey(token))
  } catch {
    warn('[DeviceAuth] 删除 devtok 失败', { tokenSuffix: deviceTokenLogSuffix(token) })
  }
}

export async function getUserDevicesIndex(env: Env, userId: string): Promise<UserDevicesIndex> {
  const kv = env.AI_USAGE_KV
  if (!kv) return { devices: [] }
  try {
    const raw = await kv.get(userDevicesKvKey(userId))
    if (!raw) return { devices: [] }
    const parsed = JSON.parse(raw) as unknown
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      !Array.isArray((parsed as UserDevicesIndex).devices)
    ) {
      return { devices: [] }
    }
    return parsed as UserDevicesIndex
  } catch {
    warn('[DeviceAuth] 读取 user_devs 失败', { userId })
    return { devices: [] }
  }
}

export async function putUserDevicesIndex(
  env: Env,
  userId: string,
  index: UserDevicesIndex
): Promise<{ ok: true } | { ok: false; error: 'kv_unavailable' | 'kv_put_failed' }> {
  const kv = env.AI_USAGE_KV
  if (!kv) return { ok: false, error: 'kv_unavailable' }
  try {
    await kv.put(userDevicesKvKey(userId), JSON.stringify(index))
    return { ok: true }
  } catch {
    warn('[DeviceAuth] 写入 user_devs 失败', { userId })
    return { ok: false, error: 'kv_put_failed' }
  }
}

export async function getUserMeta(env: Env, userId: string): Promise<UserMetaRecord | null> {
  const kv = env.AI_USAGE_KV
  if (!kv) return null
  try {
    const raw = await kv.get(userMetaKvKey(userId))
    if (!raw) return null
    const parsed = JSON.parse(raw) as unknown
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      typeof (parsed as UserMetaRecord).isAnonymous !== 'boolean'
    ) {
      return null
    }
    return parsed as UserMetaRecord
  } catch {
    warn('[DeviceAuth] 读取 user_meta 失败', { userId })
    return null
  }
}

export async function putUserMeta(
  env: Env,
  userId: string,
  meta: UserMetaRecord
): Promise<{ ok: true } | { ok: false; error: 'kv_unavailable' | 'kv_put_failed' }> {
  const kv = env.AI_USAGE_KV
  if (!kv) return { ok: false, error: 'kv_unavailable' }
  try {
    await kv.put(userMetaKvKey(userId), JSON.stringify(meta))
    return { ok: true }
  } catch {
    warn('[DeviceAuth] 写入 user_meta 失败', { userId })
    return { ok: false, error: 'kv_put_failed' }
  }
}

/**
 * 签发一条 device token：写 devtok + 追加 user_devs（不挤掉其它设备）。
 */
export async function issueDeviceToken(
  env: Env,
  input: {
    userId: string
    isAnonymous: boolean
    email?: string | null
    deviceLabel?: string
    platform?: string
    extensionId?: string | null
  }
): Promise<
  | {
      ok: true
      deviceToken: string
      deviceId: string
      userId: string
      isAnonymous: boolean
      email: string | null
    }
  | { ok: false; error: 'kv_unavailable' | 'kv_put_failed' }
> {
  const deviceToken = createDeviceToken()
  const deviceId = crypto.randomUUID()
  const now = new Date().toISOString()
  const deviceLabel = input.deviceLabel?.trim() || 'Unknown device'
  const platform = input.platform?.trim() || 'unknown'
  const email = input.email?.trim() || null

  const record: DeviceTokenRecord = {
    deviceId,
    userId: input.userId,
    createdAt: now,
    lastSeenAt: now,
    deviceLabel,
    platform,
    isAnonymousAtIssue: input.isAnonymous,
    ...(input.extensionId?.trim() ? { extensionId: input.extensionId.trim() } : {})
  }

  const putTok = await putDeviceTokenRecord(env, deviceToken, record)
  if (!putTok.ok) return putTok

  const index = await getUserDevicesIndex(env, input.userId)
  index.devices.push({
    deviceId,
    deviceLabel,
    platform,
    createdAt: now,
    lastSeenAt: now,
    tokenKeySuffix: deviceToken.slice(-8)
  })
  const putIdx = await putUserDevicesIndex(env, input.userId, index)
  if (!putIdx.ok) {
    await deleteDeviceTokenRecord(env, deviceToken)
    return putIdx
  }

  // user_meta：已有则保留 isAnonymous（转正后旧设备继续有效）；缺则新建
  const existingMeta = await getUserMeta(env, input.userId)
  const isAnonymous = existingMeta?.isAnonymous ?? input.isAnonymous
  const metaEmail = email ?? existingMeta?.email ?? null
  const metaPut = await putUserMeta(env, input.userId, {
    isAnonymous,
    ...(metaEmail ? { email: metaEmail } : {}),
    updatedAt: now
  })
  if (!metaPut.ok) {
    await deleteDeviceTokenRecord(env, deviceToken)
    const rolled = await getUserDevicesIndex(env, input.userId)
    rolled.devices = rolled.devices.filter(d => d.deviceId !== deviceId)
    await putUserDevicesIndex(env, input.userId, rolled)
    return metaPut
  }

  return {
    ok: true,
    deviceToken,
    deviceId,
    userId: input.userId,
    isAnonymous,
    email: metaEmail
  }
}

/**
 * 撤销本设备：删 devtok + 从 user_devs 移除。
 * @returns 是否找到并删除
 */
export async function revokeDeviceTokenSelf(
  env: Env,
  token: string
): Promise<
  { ok: true; revoked: boolean; deviceId?: string } | { ok: false; error: 'kv_unavailable' }
> {
  if (!env.AI_USAGE_KV) return { ok: false, error: 'kv_unavailable' }
  const record = await getDeviceTokenRecord(env, token)
  if (!record || record.revokedAt) {
    return { ok: true, revoked: false }
  }
  await deleteDeviceTokenRecord(env, token)
  const index = await getUserDevicesIndex(env, record.userId)
  index.devices = index.devices.filter(d => d.deviceId !== record.deviceId)
  await putUserDevicesIndex(env, record.userId, index)
  return { ok: true, revoked: true, deviceId: record.deviceId }
}
