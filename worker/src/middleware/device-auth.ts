/**
 * 设备 token 鉴权中间件（D 方案）。
 * Bearer → KV `devtok:`；短 TTL 内存缓存；lastSeenAt 节流写。
 */

import type { MiddlewareHandler } from 'hono'
import type { Env } from '../types/env'
import {
  deviceTokenLogSuffix,
  getDeviceTokenRecord,
  getUserMeta,
  putDeviceTokenRecord,
  putUserDevicesIndex,
  getUserDevicesIndex,
  isDeviceTokenFormat,
  type DeviceTokenRecord
} from '../services/auth/device-token-kv'
import { info, warn } from '../utils/logger'

/** 实例内缓存 TTL（毫秒）；跨 isolate 撤销最多延迟至此窗口 */
export const DEVICE_AUTH_CACHE_TTL_MS = 45_000

/** lastSeenAt 最短写入间隔 */
export const DEVICE_LAST_SEEN_THROTTLE_MS = 5 * 60_000

export type DeviceAuthCacheEntry = {
  userId: string
  deviceId: string
  isAnonymous: boolean
  email: string | null
  /** 完整 token 仅存于 Map key；勿打日志 */
  expiresAt: number
  /** 上次成功写 lastSeenAt 的墙钟 */
  lastSeenWrittenAt: number
}

/** 可注入的缓存（测试用）；生产用模块级 Map */
export type DeviceAuthCacheStore = Map<string, DeviceAuthCacheEntry>

const defaultCache: DeviceAuthCacheStore = new Map()

let activeCache: DeviceAuthCacheStore = defaultCache

/** 测试：替换 / 清空缓存 */
export function setDeviceAuthCacheForTests(cache: DeviceAuthCacheStore | null): void {
  activeCache = cache ?? defaultCache
}

export function clearDeviceAuthCache(): void {
  activeCache.clear()
}

export function invalidateDeviceAuthCacheEntry(token: string): void {
  activeCache.delete(token)
}

interface DeviceAuthEnv {
  Bindings: Env
  Variables: {
    deviceUserId: string
    deviceIsAnonymous: boolean
    deviceId: string
    /** 与 supabase 路径对齐：双栈路由可读同一键 */
    supabaseUserId: string
    supabaseAccessToken: string
    supabaseUserEmail: string | null
  }
}

async function maybeTouchLastSeen(
  env: Env,
  token: string,
  record: DeviceTokenRecord,
  cacheEntry: DeviceAuthCacheEntry,
  now: number
): Promise<void> {
  if (now - cacheEntry.lastSeenWrittenAt < DEVICE_LAST_SEEN_THROTTLE_MS) {
    return
  }
  const lastSeenAt = new Date(now).toISOString()
  const updated: DeviceTokenRecord = { ...record, lastSeenAt }
  const put = await putDeviceTokenRecord(env, token, updated)
  if (!put.ok) return

  cacheEntry.lastSeenWrittenAt = now
  const index = await getUserDevicesIndex(env, record.userId)
  const devices = index.devices.map(d =>
    d.deviceId === record.deviceId ? { ...d, lastSeenAt } : d
  )
  await putUserDevicesIndex(env, record.userId, { devices })
}

/**
 * 解析 Bearer device token；命中后设置 device* / supabase* 变量。
 */
export function deviceAuth(): MiddlewareHandler<DeviceAuthEnv> {
  return async (c, next) => {
    const authHeader = c.req.header('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return c.json({ error: 'missing_authorization' }, 401)
    }
    const token = authHeader.slice('Bearer '.length).trim()
    if (!token || !isDeviceTokenFormat(token)) {
      return c.json({ error: 'invalid_token' }, 401)
    }

    if (!c.env.AI_USAGE_KV) {
      return c.json({ error: 'kv_not_configured' }, 503)
    }

    const now = Date.now()
    const cached = activeCache.get(token)
    if (cached && cached.expiresAt > now) {
      c.set('deviceUserId', cached.userId)
      c.set('deviceIsAnonymous', cached.isAnonymous)
      c.set('deviceId', cached.deviceId)
      c.set('supabaseUserId', cached.userId)
      c.set('supabaseAccessToken', '')
      c.set('supabaseUserEmail', cached.email)
      // 节流写仍需 record；缓存命中时异步读一次（失败则跳过 touch）
      void getDeviceTokenRecord(c.env, token).then(record => {
        if (record && !record.revokedAt) {
          void maybeTouchLastSeen(c.env, token, record, cached, now)
        }
      })
      return await next()
    }

    const record = await getDeviceTokenRecord(c.env, token)
    if (!record || record.revokedAt) {
      activeCache.delete(token)
      warn('[DeviceAuth] token 无效或已撤销', {
        tokenSuffix: deviceTokenLogSuffix(token),
        hasRecord: Boolean(record)
      })
      return c.json({ error: 'invalid_token' }, 401)
    }

    const meta = await getUserMeta(c.env, record.userId)
    const isAnonymous = meta?.isAnonymous ?? record.isAnonymousAtIssue
    const email = meta?.email ?? null

    const entry: DeviceAuthCacheEntry = {
      userId: record.userId,
      deviceId: record.deviceId,
      isAnonymous,
      email,
      expiresAt: now + DEVICE_AUTH_CACHE_TTL_MS,
      lastSeenWrittenAt: 0
    }
    // 若 record.lastSeenAt 很新，避免立即再写
    const lastSeenMs = Date.parse(record.lastSeenAt)
    if (Number.isFinite(lastSeenMs)) {
      entry.lastSeenWrittenAt = lastSeenMs
    }
    activeCache.set(token, entry)

    await maybeTouchLastSeen(c.env, token, record, entry, now)

    info('[DeviceAuth] 鉴权通过', {
      deviceId: record.deviceId,
      userId: record.userId,
      isAnonymous,
      tokenSuffix: deviceTokenLogSuffix(token)
    })

    c.set('deviceUserId', record.userId)
    c.set('deviceIsAnonymous', isAnonymous)
    c.set('deviceId', record.deviceId)
    c.set('supabaseUserId', record.userId)
    c.set('supabaseAccessToken', '')
    c.set('supabaseUserEmail', email)
    return await next()
  }
}
