/**
 * 账户/同步 handler 共用辅助（从 account-sync-handler 机械抽出）。
 */

import { filterCloudSyncableMemoryItems } from '@/core/memory/memory-item-type'
import { MemoryItemSchema, type MemoryItem } from '@/core/memory/memory-item'
import { clearAuthValidationTimestamp } from '@/infrastructure/auth/auth-session-revalidate'
import { clearExtensionUninstallRevoke } from '@/infrastructure/auth/extension-uninstall-url'
import { ensureAuthSessionLeaseAlarm } from '@/infrastructure/auth/auth-session-lease-alarm'
import { clearLastExtensionLeaseSessionId } from '@/infrastructure/storage/last-extension-lease-session-storage'
import { refreshAuthSession } from '@/infrastructure/auth/extension-oauth'
import {
  clearAuthSession,
  getAuthSession,
  setAuthSession
} from '@/infrastructure/identity/auth-session-service'
import {
  clearAccountBinding,
  getAccountBinding,
  setAccountBinding
} from '@/infrastructure/identity/local-profile-service'
import { patchSyncPrefs } from '@/infrastructure/identity/sync-prefs-service'
import { clearSubscriptionSnapshot } from '@/infrastructure/identity/subscription-service'
import { clearRecallTelemetryEvents } from '@/infrastructure/analytics/recall-telemetry-store'
import { clearRecallOutcomePairs } from '@/infrastructure/storage/recall-outcome-pairs-storage'
import { memoryItemRepository } from '@/infrastructure/indexeddb/memory-item-repository'
import { logger } from '@/infrastructure/logging/logger'
import { replaceRemoteWithLocalItems } from '@/infrastructure/messaging/memory-sync-api-client'
import { ensureMemoryCloudSyncAlarm } from '@/infrastructure/sync/memory-cloud-sync-alarm'

/** access token 提前刷新余量（秒），避免边界过期。 */
const ACCESS_TOKEN_REFRESH_SKEW_SEC = 60

/** 确保有可用 access token（未过期则复用；过期才 refresh，并保留头像等展示字段）。 */
export async function requireAccessToken(): Promise<{
  accessToken: string
  userId: string
} | null> {
  const session = await getAuthSession()
  if (!session) {
    return null
  }

  const nowSec = Math.floor(Date.now() / 1000)
  const stillValid =
    session.expiresAt != null && session.expiresAt > nowSec + ACCESS_TOKEN_REFRESH_SKEW_SEC
  if (stillValid) {
    return { accessToken: session.accessToken, userId: session.userId }
  }

  const refreshed = await refreshAuthSession(session.refreshToken, {
    ...(session.email ? { email: session.email } : {}),
    ...(session.avatarUrl ? { avatarUrl: session.avatarUrl } : {}),
    ...(session.displayName ? { displayName: session.displayName } : {})
  })
  if (refreshed) {
    await setAuthSession(refreshed)
    // refresh 后若 binding 缺失则补写（防御）
    const binding = await getAccountBinding()
    if (!binding) {
      await setAccountBinding({
        accountId: refreshed.userId,
        boundAt: new Date().toISOString()
      })
    }
    return { accessToken: refreshed.accessToken, userId: refreshed.userId }
  }

  // refresh 失败时仍尝试旧 token（调用方会收到 API 401）
  return { accessToken: session.accessToken, userId: session.userId }
}

export function parseCloudItems(rawItems: MemoryItem[]): MemoryItem[] {
  const items: MemoryItem[] = []
  let dropped = 0
  for (const raw of rawItems) {
    const parsed = MemoryItemSchema.safeParse(raw)
    if (parsed.success) {
      items.push(parsed.data)
    } else {
      dropped += 1
    }
  }
  if (dropped > 0) {
    logger.warn('MemorySync', '云端条目 Zod 校验丢弃', {
      rawCount: rawItems.length,
      kept: items.length,
      dropped
    })
  }
  return items
}

/** 清本机会话绑定、订阅快照与同步闹钟（退出 / 删账号共用）。 */
export async function finishSignOutSession(): Promise<void> {
  // 先读 session（清本机前）：有 revoke token 走卸载接口；否则 Bearer 释放租约
  const sessionBeforeClear = await getAuthSession()
  let remoteReleased = false
  try {
    remoteReleased = await clearExtensionUninstallRevoke({
      revokeRemote: true,
      ...(sessionBeforeClear?.accessToken
        ? { accessTokenFallback: sessionBeforeClear.accessToken }
        : {})
    })
  } catch (error) {
    logger.warn('Auth', '退出时卸载 revoke / 清 token 失败', error)
  }
  // 远程租约已释放才清 lastLease；失败保留 → 同机 Connect 可静默认领
  if (remoteReleased) {
    try {
      await clearLastExtensionLeaseSessionId()
    } catch (error) {
      logger.warn('Auth', '退出后清 lastLeaseSessionId 失败', error)
    }
  }
  await clearAuthSession()
  await clearAccountBinding()
  await clearSubscriptionSnapshot()
  await patchSyncPrefs({ enabled: false })
  await ensureMemoryCloudSyncAlarm(false)
  await clearAuthValidationTimestamp()
  try {
    await ensureAuthSessionLeaseAlarm(false)
  } catch (error) {
    logger.warn('Auth', '退出后清除租约探测闹钟失败', error)
  }
  // 扩展退出**不**清官网会话（与 Connect 显式接通对称：各自只退自己）
}

/**
 * 将当前账号桶摘录 flush 到云端（ADR-017 面）。
 * 失败抛错；调用方决定是否仍退出。
 */
export async function flushAccountExcerptsToCloud(accountId: string): Promise<number> {
  const items = await memoryItemRepository.listAllByOwnerId(accountId, {
    includeDeleted: true
  })
  const outbound = filterCloudSyncableMemoryItems(items)
  if (outbound.length === 0) {
    return 0
  }
  const token = await requireAccessToken()
  if (!token) {
    throw new Error('SYNC_NOT_AUTHENTICATED')
  }
  const result = await replaceRemoteWithLocalItems(token.accessToken, outbound, {
    allowDestructiveShrink: true
  })
  await patchSyncPrefs({
    enabled: true,
    lastPushedAt: new Date().toISOString()
  })
  return result.written
}

/**
 * 清本机 Outcome 对 + TTE 环（A 层缓冲；不碰 Memory）。
 * CLEAR_LOCAL_MEMORY / CLEAR_LOCAL_RECALL_ADAPTATION 共用。
 */
export async function clearLocalRecallAdaptationBuffers(): Promise<void> {
  await clearRecallOutcomePairs()
  await clearRecallTelemetryEvents()
}
