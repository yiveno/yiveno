/**
 * 本机订阅快照读写 + 刷新（Background 唯一写入口）。
 */

import {
  SUBSCRIPTION_SNAPSHOT_STORAGE_KEY,
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
  if (await isProActiveFromSnapshot()) {
    return
  }
  logger.info('Subscription', 'Pro 失效，关闭云同步')
  await patchSyncPrefs({ enabled: false })
  await ensureMemoryCloudSyncAlarm(false)
}

/**
 * 从 Worker 刷新订阅快照。
 * 未登录 → 写 Free；网络失败 → 保留旧快照（若有）或 Free。
 * 成功后若非 Pro 则关闭同步，并触发线索 LLM 重挂（由调用方或本函数动态 import）。
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
    void import('@/application/recall/refresh-clue-llm-completer').then(m =>
      m.refreshClueLlmCompleterFromDevConfig().catch(() => undefined)
    )
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
    void import('@/application/recall/refresh-clue-llm-completer').then(m =>
      m.refreshClueLlmCompleterFromDevConfig().catch(() => undefined)
    )
    return snapshot
  } catch (error) {
    flowFail('Subscription', '刷新订阅快照', startedAt, error)
    const existing = await getSubscriptionSnapshot()
    if (existing) {
      return existing
    }
    const free = createFreeSubscriptionSnapshot()
    await setSubscriptionSnapshot(free)
    return free
  }
}
