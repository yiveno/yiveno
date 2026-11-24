/**
 * Worker embed 配额熔断器（Recall + 异步调度器共用）。
 *
 * - 持久化到 chrome.storage.local，SW 挂起重启仍生效。
 * - 内存镜像供调度器同步入队门控（不可 await storage）。
 * - 仅 quota_exceeded / http_429 触发；预查 embedRemaining===0 也可 trip。
 * - Free/Pro 无 embedRemaining → 预查 fail-open；匿名明确为 0 → fail-closed。
 */

import { z } from 'zod'

import {
  fetchHostedQuota,
  type HostedQuotaSnapshot
} from '@/infrastructure/ai/hosted-quota-api-client'
import { logger } from '@/infrastructure/logging/logger'
import {
  readChromeStorageLocal,
  removeChromeStorageLocal,
  writeChromeStorageLocal
} from '@/infrastructure/storage/chrome-storage-local'

/** 与扩展 storage 既有 `yiveno.*` key 同族。 */
export const EMBED_QUOTA_BREAKER_STORAGE_KEY = 'yiveno.embedQuotaBreaker'

/** 配额快照 TTL：与 A2 embed 缓存对齐（5 分钟）。 */
const QUOTA_SNAPSHOT_TTL_MS = 5 * 60 * 1000

const EmbedQuotaBreakerStateSchema = z.object({
  /** trip 时刻（epoch ms） */
  trippedAtMs: z.number().finite().nonnegative(),
  /** trip 时 accessToken 末 16 字符（与 A2 tokenKey 同款） */
  trippedTokenFingerprint: z.string().min(1),
  /** 暂停至此时刻（epoch ms）；统一取下一个 UTC 午夜 */
  pausedUntilMs: z.number().finite().nonnegative()
})

export type EmbedQuotaBreakerState = z.infer<typeof EmbedQuotaBreakerStateSchema>

export type EmbedQuotaGateDenyReason = 'circuit_open' | 'precheck_zero'

export type EmbedQuotaGateDecision =
  { allow: true } | { allow: false; reason: EmbedQuotaGateDenyReason }

/** 内存镜像：加载完成前视为闭合（允许调用）。 */
let mirror: EmbedQuotaBreakerState | null = null
let mirrorLoaded = false
let mirrorLoadPromise: Promise<void> | null = null

/** 配额快照内存缓存（按 token 指纹隔离）。 */
let quotaSnapshotCache: {
  tokenFingerprint: string
  snapshot: HostedQuotaSnapshot
  fetchedAtMs: number
} | null = null

/** accessToken 末 16 字符指纹（与 A2 同款）。 */
export function embedTokenFingerprint(token: string): string {
  return token.length > 16 ? token.slice(-16) : token
}

/** 下一个 UTC 午夜（epoch ms）。全档统一，不做 tier 区分。 */
export function nextUtcMidnightMs(nowMs: number): number {
  const d = new Date(nowMs)
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1, 0, 0, 0, 0)
}

/** Worker embed 配额错误：与 embed-api-client 抛出的 `quota_exceeded` / `http_429` 对齐。 */
export function isWorkerQuotaEmbedError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return (
    message === 'quota_exceeded' || message === 'http_429' || message.includes('quota_exceeded')
  )
}

function isOpenFromState(state: EmbedQuotaBreakerState | null, nowMs: number): boolean {
  if (!state) {
    return false
  }
  if (nowMs >= state.pausedUntilMs) {
    // 惰性清理：自然过期视为闭合
    mirror = null
    void removeChromeStorageLocal(EMBED_QUOTA_BREAKER_STORAGE_KEY).catch(() => {
      // 清理失败不挡读路径
    })
    return false
  }
  return true
}

async function loadMirrorFromStorage(): Promise<void> {
  const stored = await readChromeStorageLocal(
    EMBED_QUOTA_BREAKER_STORAGE_KEY,
    EmbedQuotaBreakerStateSchema
  )
  mirror = stored
  mirrorLoaded = true
}

function ensureMirrorLoaded(): Promise<void> {
  if (mirrorLoaded) {
    return Promise.resolve()
  }
  if (!mirrorLoadPromise) {
    mirrorLoadPromise = loadMirrorFromStorage()
      .catch(error => {
        logger.warn('Embed', 'embed 熔断态从 storage 加载失败（视为闭合）', {
          error: error instanceof Error ? error.message : String(error)
        })
        mirror = null
        mirrorLoaded = true
      })
      .finally(() => {
        mirrorLoadPromise = null
      })
  }
  return mirrorLoadPromise
}

/** 模块加载即种子化内存镜像（失败则保持闭合）。 */
void ensureMirrorLoaded()

/** 同步：调度器入队门控用；加载完成前默认闭合（不挡入队）。 */
export function isEmbedQuotaBreakerOpenSync(nowMs = Date.now()): boolean {
  if (!mirrorLoaded) {
    return false
  }
  return isOpenFromState(mirror, nowMs)
}

/** 异步：Recall 路径可读 storage。 */
export async function isEmbedQuotaBreakerOpen(nowMs = Date.now()): Promise<boolean> {
  await ensureMirrorLoaded()
  return isOpenFromState(mirror, nowMs)
}

/**
 * trip：仅 quota 错误或预查明确剩余 0 时调用。
 * 同步写镜像；异步写 storage。
 */
export function tripEmbedQuotaBreaker(accessToken: string, nowMs = Date.now()): void {
  const state: EmbedQuotaBreakerState = {
    trippedAtMs: nowMs,
    trippedTokenFingerprint: embedTokenFingerprint(accessToken),
    pausedUntilMs: nextUtcMidnightMs(nowMs)
  }
  mirror = state
  mirrorLoaded = true
  logger.warn('Embed', 'embed 配额熔断已开启', {
    trippedTokenFingerprint: state.trippedTokenFingerprint,
    pausedUntilMs: state.pausedUntilMs
  })
  void writeChromeStorageLocal(EMBED_QUOTA_BREAKER_STORAGE_KEY, state).catch(error => {
    logger.warn('Embed', 'embed 熔断态写入 storage 失败', {
      error: error instanceof Error ? error.message : String(error)
    })
  })
}

/** 若 error 为配额类则 trip；返回是否已 trip。 */
export function tripEmbedQuotaBreakerFromError(accessToken: string, error: unknown): boolean {
  if (!isWorkerQuotaEmbedError(error)) {
    return false
  }
  tripEmbedQuotaBreaker(accessToken)
  return true
}

/**
 * 清除熔断（持久态 + 镜像）。
 * 合法路径：(a) 维护预查 remaining > 0；(b) auth 身份变化。
 */
export function clearEmbedQuotaBreaker(reason: string): void {
  const hadTrip = mirror !== null
  mirror = null
  mirrorLoaded = true
  quotaSnapshotCache = null
  if (hadTrip) {
    logger.info('Embed', 'embed 配额熔断已清除', { reason })
  }
  // 无论镜像是否已种子化，都删 storage（覆盖「加载前维护预查清除」）
  void removeChromeStorageLocal(EMBED_QUOTA_BREAKER_STORAGE_KEY).catch(error => {
    logger.warn('Embed', 'embed 熔断态删除 storage 失败', {
      error: error instanceof Error ? error.message : String(error)
    })
  })
}

/**
 * 当前 token 指纹与 trip 时不同 → 清熔断。
 * 无 trip 态或同身份 → 不动。无 token 时无法判定身份变化，不动熔断。
 */
export async function clearEmbedQuotaBreakerIfIdentityChanged(
  currentAccessToken: string | null | undefined
): Promise<boolean> {
  await ensureMirrorLoaded()
  if (!mirror) {
    return false
  }
  if (!currentAccessToken) {
    return false
  }
  const fp = embedTokenFingerprint(currentAccessToken)
  if (fp === mirror.trippedTokenFingerprint) {
    return false
  }
  clearEmbedQuotaBreaker('auth_identity_changed')
  return true
}

function invalidateQuotaSnapshotIfTokenChanged(tokenFingerprint: string): void {
  if (quotaSnapshotCache && quotaSnapshotCache.tokenFingerprint !== tokenFingerprint) {
    quotaSnapshotCache = null
  }
}

/**
 * Recall 门控：本地熔断 +（可选）联网预查。
 * Omnibox：`allowNetworkPrecheck: false`（ADR-007 不联网）。
 */
export async function gateWorkerEmbedRequest(input: {
  accessToken: string
  allowNetworkPrecheck: boolean
  nowMs?: number
}): Promise<EmbedQuotaGateDecision> {
  const nowMs = input.nowMs ?? Date.now()
  if (await isEmbedQuotaBreakerOpen(nowMs)) {
    return { allow: false, reason: 'circuit_open' }
  }

  if (!input.allowNetworkPrecheck) {
    return { allow: true }
  }

  const tokenFingerprint = embedTokenFingerprint(input.accessToken)
  invalidateQuotaSnapshotIfTokenChanged(tokenFingerprint)

  let snapshot: HostedQuotaSnapshot | null = null
  if (
    quotaSnapshotCache &&
    quotaSnapshotCache.tokenFingerprint === tokenFingerprint &&
    nowMs - quotaSnapshotCache.fetchedAtMs < QUOTA_SNAPSHOT_TTL_MS
  ) {
    snapshot = quotaSnapshotCache.snapshot
  } else {
    try {
      snapshot = await fetchHostedQuota(input.accessToken)
      quotaSnapshotCache = {
        tokenFingerprint,
        snapshot,
        fetchedAtMs: nowMs
      }
    } catch (error) {
      // 配额请求失败 → fail-open
      logger.info('Embed', 'embed 预查配额失败（fail-open）', {
        error: error instanceof Error ? error.message : String(error)
      })
      return { allow: true }
    }
  }

  // Free/Pro：embedRemaining 未定义 → fail-open
  if (typeof snapshot.embedRemaining !== 'number' || !Number.isFinite(snapshot.embedRemaining)) {
    return { allow: true }
  }

  if (snapshot.embedRemaining <= 0) {
    tripEmbedQuotaBreaker(input.accessToken, nowMs)
    return { allow: false, reason: 'precheck_zero' }
  }

  return { allow: true }
}

/** 测试用：重置镜像、缓存与 storage。 */
export function resetEmbedQuotaCircuitBreakerForTests(): void {
  mirror = null
  mirrorLoaded = true
  mirrorLoadPromise = null
  quotaSnapshotCache = null
  void removeChromeStorageLocal(EMBED_QUOTA_BREAKER_STORAGE_KEY)
}

/** 测试用：模拟 SW 重启——清空镜像后从 storage 重新种子化。 */
export async function reloadEmbedQuotaCircuitBreakerFromStorageForTests(): Promise<void> {
  mirror = null
  mirrorLoaded = false
  mirrorLoadPromise = null
  quotaSnapshotCache = null
  await ensureMirrorLoaded()
}
