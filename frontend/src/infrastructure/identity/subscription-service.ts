/**
 * 本机订阅快照读写 + 刷新（Background 唯一写入口）。
 * 订阅变更事件由 Background 层监听并处理（避免 infrastructure → application 跨层依赖）。
 */

import {
  SUBSCRIPTION_SNAPSHOT_STORAGE_KEY,
  SubscriptionRefreshError,
  SubscriptionSnapshotSchema,
  createFreeSubscriptionSnapshot,
  type SubscriptionSnapshot
} from '@/core/identity/subscription-snapshot'
import { getAuthSession } from '@/infrastructure/identity/auth-session-service'
import { getAccountBinding } from '@/infrastructure/identity/local-profile-service'
import { fetchRemoteSubscriptionStatus } from '@/infrastructure/identity/subscription-api-client'
import { getSyncPrefs, patchSyncPrefs } from '@/infrastructure/identity/sync-prefs-service'
import { ensureMemoryCloudSyncAlarm } from '@/infrastructure/sync/memory-cloud-sync-alarm'
import {
  readChromeStorageLocal,
  removeChromeStorageLocal,
  writeChromeStorageLocal
} from '@/infrastructure/storage/chrome-storage-local'
import { flowFail, flowOk, flowStart } from '@/infrastructure/logging/flow-log'
import { logger } from '@/infrastructure/logging/logger'

/**
 * 订阅变更事件：基础设施层发出，Background 层处理。
 * 避免 infrastructure → application 跨层依赖（Phase 1 审计 P0-1 修复）。
 */
export interface SubscriptionChangedEvent {
  /** 刷新后的快照。 */
  snapshot: SubscriptionSnapshot
  /** 触发原因。 */
  reason: 'signed_out' | 'refreshed' | 'forced'
}

/** 订阅变更事件监听器。 */
export type SubscriptionChangedListener = (event: SubscriptionChangedEvent) => void | Promise<void>

const listeners = new Set<SubscriptionChangedListener>()

/** 注册订阅变更监听器（Background 唯一合法消费者）。 */
export function onSubscriptionChanged(listener: SubscriptionChangedListener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** 触发订阅变更事件（由 subscription-service 在刷新成功后调用）。 */
function emitSubscriptionChanged(event: SubscriptionChangedEvent): void {
  for (const listener of listeners) {
    try {
      void listener(event)
    } catch {
      // 静默，不阻塞其他监听器
    }
  }
}

/** 读本地缓存；损坏则 null。 */
export async function getSubscriptionSnapshot(): Promise<SubscriptionSnapshot | null> {
  return readChromeStorageLocal(SUBSCRIPTION_SNAPSHOT_STORAGE_KEY, SubscriptionSnapshotSchema)
}

export async function setSubscriptionSnapshot(snapshot: SubscriptionSnapshot): Promise<void> {
  await writeChromeStorageLocal(SUBSCRIPTION_SNAPSHOT_STORAGE_KEY, snapshot)
}

export async function clearSubscriptionSnapshot(): Promise<void> {
  await removeChromeStorageLocal(SUBSCRIPTION_SNAPSHOT_STORAGE_KEY)
}

/**
 * 是否有效 Pro（本地快照；过期按 currentPeriodEnd 再判一次）。
 */
export async function isProActiveFromSnapshot(): Promise<boolean> {
  const snapshot = await getSubscriptionSnapshot()
  if (!snapshot?.isPro) {
    return false
  }
  if (snapshot.currentPeriodEnd) {
    const endMs = Date.parse(snapshot.currentPeriodEnd)
    if (!Number.isNaN(endMs) && endMs <= Date.now()) {
      return false
    }
  }
  return snapshot.status === 'active' && snapshot.tier === 'pro'
}

/**
 * Pro 失效时关闭云同步（Normative：同步 = Pro + 登录 + 开关）。
 */
export async function enforceSyncRequiresPro(): Promise<void> {
  const syncPrefs = await getSyncPrefs()
  if (!syncPrefs.enabled) {
    return
  }
  const snapshot = await getSubscriptionSnapshot()
  if (!snapshot) {
    // 无本地快照：可能尚未拉取成功，勿因 unknown 误关同步
    return
  }
  if (await isProActiveFromSnapshot()) {
    return
  }
  logger.info('Subscription', 'Pro 失效，关闭云同步')
  await patchSyncPrefs({ enabled: false })
  await ensureMemoryCloudSyncAlarm(false)
}

/**
 * 从 Worker 刷新订阅快照。
 * 未登录 → 写 Free；网络失败 → 保留旧快照（若有），否则抛错（不写 Free）。
 * 订阅变更通过事件机制通知 Background 层（避免 infrastructure → application 跨层）。
 * 并发调用合并为一次网络请求。
 */
let refreshSubscriptionInflight: Promise<SubscriptionSnapshot> | null = null

export async function refreshSubscriptionSnapshot(options?: {
  force?: boolean
}): Promise<SubscriptionSnapshot> {
  if (refreshSubscriptionInflight && !options?.force) {
    return refreshSubscriptionInflight
  }

  const run = doRefreshSubscriptionSnapshot(options).finally(() => {
    if (refreshSubscriptionInflight === run) {
      refreshSubscriptionInflight = null
    }
  })
  refreshSubscriptionInflight = run
  return run
}

async function doRefreshSubscriptionSnapshot(options?: {
  force?: boolean
}): Promise<SubscriptionSnapshot> {
  const startedAt = flowStart('Subscription', '刷新订阅快照')
  const binding = await getAccountBinding()
  const session = await getAuthSession()
  if (!binding || !session?.accessToken) {
    const free = createFreeSubscriptionSnapshot()
    await setSubscriptionSnapshot(free)
    await enforceSyncRequiresPro()
    flowOk('Subscription', '刷新订阅快照', startedAt, { reason: 'signed_out', isPro: false })
    // 通过事件通知 Background 层（由其调用 refreshClueLlmCompleterFromDevConfig）
    emitSubscriptionChanged({ snapshot: free, reason: 'signed_out' })
    return free
  }

  try {
    const remote = await fetchRemoteSubscriptionStatus(session.accessToken)
    const snapshot: SubscriptionSnapshot = {
      ...remote,
      fetchedAt: new Date().toISOString()
    }
    await setSubscriptionSnapshot(snapshot)
    await enforceSyncRequiresPro()
    flowOk('Subscription', '刷新订阅快照', startedAt, {
      isPro: snapshot.isPro,
      tier: snapshot.tier,
      force: Boolean(options?.force)
    })
    // 通过事件通知 Background 层（由其调用 refreshClueLlmCompleterFromDevConfig）
    emitSubscriptionChanged({ snapshot, reason: options?.force ? 'forced' : 'refreshed' })
    return snapshot
  } catch (error) {
    flowFail('Subscription', '刷新订阅快照', startedAt, error)
    const existing = await getSubscriptionSnapshot()
    if (existing) {
      logger.warn('Subscription', '拉取失败，沿用本地快照', {
        isPro: existing.isPro,
        fetchedAt: existing.fetchedAt
      })
      return existing
    }
    const code = error instanceof Error ? error.message : 'subscription_fetch_failed'
    throw new SubscriptionRefreshError(code)
  }
}
