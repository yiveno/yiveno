/**
 * 设备 token（D 方案）KV 读写：devtok / user_devs / user_meta。
 * 日志只打 deviceId / token 末 4 字符；禁止完整 token 进日志。
 */

import type { Env } from '../../types/env'
import { warn } from '../../utils/logger'

/** Bearer / 存储用前缀（与 JWT / uninstall revoke 区分） */
export const DEVICE_TOKEN_PREFIX = 'ydt_' as const

/** 每账号设备软上限（设计 §10）；超出拒绝新注册 */
export const DEVICE_CAP_PER_USER = 20 as const

/** 设备展示名长度上限（trim 后） */
export const DEVICE_LABEL_MAX_LEN = 64 as const

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

/** 用户设备索引行（含完整 token，仅服务端；API 响应不得外泄） */
type UserDeviceIndexEntry = {
  deviceId: string
  deviceLabel: string
  platform: string
  createdAt: string
  lastSeenAt: string
  /** token 末 8 字符，仅运维对照，非密钥 */
  tokenKeySuffix: string
  /** 完整 device token；用于按 deviceId 撤销 / 核对 devtok 存在性 */
  deviceToken?: string
}

/** 对官网/扩展暴露的设备列表行（无 token） */
export type DeviceListItem = {
  deviceId: string
  name: string
  platform: string
  lastSeenAt: string
  createdAt: string
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
 * 列出用户设备：从 user_devs 取 id 后逐个核对 `devtok:` 存在性；
 * 索引漂移（无对应 token）的行不返回，并尽力从索引剔除。
 */
export async function listDevicesForUser(
  env: Env,
  userId: string
): Promise<{ ok: true; devices: DeviceListItem[] } | { ok: false; error: 'kv_unavailable' }> {
  if (!env.AI_USAGE_KV) return { ok: false, error: 'kv_unavailable' }
  const index = await getUserDevicesIndex(env, userId)
  const devices: DeviceListItem[] = []
  const kept: UserDeviceIndexEntry[] = []
  let drifted = false

  for (const entry of index.devices) {
    const token = entry.deviceToken?.trim()
    if (!token) {
      drifted = true
      continue
    }
    const record = await getDeviceTokenRecord(env, token)
    if (!record || record.revokedAt || record.userId !== userId) {
      drifted = true
      continue
    }
    kept.push({
      ...entry,
      deviceLabel: record.deviceLabel,
      platform: record.platform,
      lastSeenAt: record.lastSeenAt,
      createdAt: record.createdAt,
      deviceToken: token
    })
    devices.push({
      deviceId: record.deviceId,
      name: record.deviceLabel,
      platform: record.platform,
      lastSeenAt: record.lastSeenAt,
      createdAt: record.createdAt
    })
  }

  if (drifted) {
    await putUserDevicesIndex(env, userId, { devices: kept })
  }

  return { ok: true, devices }
}

/**
 * 签发一条 device token：写 devtok + 追加 user_devs（不挤掉其它设备）。
 * 已达 {@link DEVICE_CAP_PER_USER}（按存活设备计）→ `device_limit_reached`。
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
  | { ok: false; error: 'kv_unavailable' | 'kv_put_failed' | 'device_limit_reached' }
> {
  if (!env.AI_USAGE_KV) return { ok: false, error: 'kv_unavailable' }

  // 先列存活设备再判 cap（顺带清漂移索引）
  const listed = await listDevicesForUser(env, input.userId)
  if (!listed.ok) return listed
  if (listed.devices.length >= DEVICE_CAP_PER_USER) {
    warn('[DeviceAuth] 设备数已达上限，拒绝签发', {
      userId: input.userId,
      count: listed.devices.length,
      cap: DEVICE_CAP_PER_USER
    })
    return { ok: false, error: 'device_limit_reached' }
  }

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
    tokenKeySuffix: deviceToken.slice(-8),
    deviceToken
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
 * 按 deviceId 撤销（仅限 ownerUserId 名下）。
 * 不存在 / 非本人 → not_found（不泄露归属）。
 */
export async function revokeDeviceById(
  env: Env,
  ownerUserId: string,
  deviceId: string
): Promise<
  | { ok: true; revoked: true; deviceToken: string }
  | { ok: true; revoked: false; reason: 'not_found' }
  | { ok: false; error: 'kv_unavailable' }
> {
  if (!env.AI_USAGE_KV) return { ok: false, error: 'kv_unavailable' }
  const trimmedId = deviceId.trim()
  if (!trimmedId) {
    return { ok: true, revoked: false, reason: 'not_found' }
  }

  const index = await getUserDevicesIndex(env, ownerUserId)
  const entry = index.devices.find(d => d.deviceId === trimmedId)
  const token = entry?.deviceToken?.trim()
  if (!token) {
    return { ok: true, revoked: false, reason: 'not_found' }
  }

  const record = await getDeviceTokenRecord(env, token)
  if (!record || record.userId !== ownerUserId || record.deviceId !== trimmedId) {
    // 索引漂移：清掉该行
    index.devices = index.devices.filter(d => d.deviceId !== trimmedId)
    await putUserDevicesIndex(env, ownerUserId, index)
    return { ok: true, revoked: false, reason: 'not_found' }
  }

  await deleteDeviceTokenRecord(env, token)
  index.devices = index.devices.filter(d => d.deviceId !== trimmedId)
  await putUserDevicesIndex(env, ownerUserId, index)
  return { ok: true, revoked: true, deviceToken: token }
}

/**
 * 按 deviceId 改名（仅限本人；空名 → invalid_name）。
 */
export async function renameDeviceById(
  env: Env,
  ownerUserId: string,
  deviceId: string,
  rawName: string
): Promise<
  | { ok: true; device: DeviceListItem }
  | { ok: true; notFound: true }
  | { ok: false; error: 'kv_unavailable' | 'kv_put_failed' | 'invalid_name' }
> {
  if (!env.AI_USAGE_KV) return { ok: false, error: 'kv_unavailable' }
  const name = rawName.trim()
  if (!name || name.length > DEVICE_LABEL_MAX_LEN) {
    return { ok: false, error: 'invalid_name' }
  }

  const trimmedId = deviceId.trim()
  const index = await getUserDevicesIndex(env, ownerUserId)
  const entryIndex = index.devices.findIndex(d => d.deviceId === trimmedId)
  if (entryIndex < 0) {
    return { ok: true, notFound: true }
  }
  const entry = index.devices[entryIndex]!
  const token = entry.deviceToken?.trim()
  if (!token) {
    return { ok: true, notFound: true }
  }

  const record = await getDeviceTokenRecord(env, token)
  if (!record || record.userId !== ownerUserId || record.deviceId !== trimmedId) {
    return { ok: true, notFound: true }
  }

  const updated: DeviceTokenRecord = { ...record, deviceLabel: name }
  const putTok = await putDeviceTokenRecord(env, token, updated)
  if (!putTok.ok) return putTok

  index.devices[entryIndex] = { ...entry, deviceLabel: name, deviceToken: token }
  const putIdx = await putUserDevicesIndex(env, ownerUserId, index)
  if (!putIdx.ok) return putIdx

  return {
    ok: true,
    device: {
      deviceId: updated.deviceId,
      name: updated.deviceLabel,
      platform: updated.platform,
      lastSeenAt: updated.lastSeenAt,
      createdAt: updated.createdAt
    }
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
