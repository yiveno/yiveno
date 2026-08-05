/**
 * 账户登录与云同步 Background 编排（Phase C 铺路）。
 * 登录主路径：打开官网 → external handoff 写入 session（扩展不做 OAuth）。
 */

import { absorbLocalProfileIntoAccount } from '@/application/identity/absorb-local-profile-into-account'
import {
  clearOrphanOwnerBuckets,
  exportOrphanOwnerBuckets,
  summarizeOrphanOwnerBuckets
} from '@/application/identity/orphan-owner-buckets'
import { mergeMemoryItemsByUpdatedAt } from '@/core/memory/merge-memory-items-by-updated-at'
import { selectMemoryItemsToPush } from '@/core/memory/select-memory-items-to-push'
import type {
  AccountSyncErrorCode,
  AuthSignInResponse,
  AuthSignOutMode,
  AuthSignOutResponse,
  ClearOrphanOwnersResponse,
  DeleteAccountResponse,
  DeleteCloudMemoryResponse,
  ExportLocalMemoryResponse,
  ExportOrphanOwnersResponse,
  GetAuthStateResponse,
  GetSyncStatusResponse,
  RefreshAuthProfileResponse,
  RestoreLatestSyncBackupResponse,
  AckPrivacyNoticeResponse,
  RunIncrementalMemorySyncResponse,
  SetSyncEnabledResponse,
  SyncReplaceWithLocalResponse,
  SyncReplaceWithRemoteResponse
} from '@/core/messaging/account-sync-messages'
import { MemoryItemSchema, type MemoryItem } from '@/core/memory/memory-item'
import { refreshAuthSession, refreshAuthProfileFields } from '@/infrastructure/auth/extension-oauth'
import {
  clearAuthValidationTimestamp,
  revalidateAuthSession
} from '@/infrastructure/auth/auth-session-revalidate'
import {
  clearAuthSession,
  getAuthSession,
  setAuthSession
} from '@/infrastructure/identity/auth-session-service'
import {
  clearAccountBinding,
  getAccountBinding,
  getOrCreateLocalProfile,
  setAccountBinding
} from '@/infrastructure/identity/local-profile-service'
import { getSyncPrefs, patchSyncPrefs } from '@/infrastructure/identity/sync-prefs-service'
import {
  ackCurrentPrivacyNotice,
  clearPrivacyPrefs,
  getPrivacyPrefs
} from '@/infrastructure/identity/privacy-prefs-service'
import { hasAckedCurrentPrivacyNotice } from '@/core/identity/privacy-prefs'
import { memoryItemRepository } from '@/infrastructure/indexeddb/memory-item-repository'
import { flowFail, flowOk, flowStart } from '@/infrastructure/logging/flow-log'
import { logger } from '@/infrastructure/logging/logger'
import {
  getWebsiteBaseUrl,
  openWebsiteLoginPage,
  openWebsiteLogoutFromExtension
} from '@/infrastructure/browser/website-page'
import {
  deleteRemoteAccount,
  deleteRemoteCloudMemory,
  fetchRemoteSyncStatus,
  pullRemoteMemoryItems,
  pushRemoteMemoryItems,
  replaceRemoteWithLocalItems,
  restoreRemoteFromLatestBackup
} from '@/infrastructure/messaging/memory-sync-api-client'
import { ensureMemoryCloudSyncAlarm } from '@/infrastructure/sync/memory-cloud-sync-alarm'

/** access token 提前刷新余量（秒），避免边界过期。 */
const ACCESS_TOKEN_REFRESH_SKEW_SEC = 60

/** 增量同步互斥，避免闹钟与手动触发并发写。 */
let incrementalSyncInFlight: Promise<RunIncrementalMemorySyncResponse> | null = null

/** 确保有可用 access token（未过期则复用；过期才 refresh，并保留头像等展示字段）。 */
async function requireAccessToken(): Promise<{ accessToken: string; userId: string } | null> {
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

function parseCloudItems(rawItems: MemoryItem[]): MemoryItem[] {
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

/**
 * AUTH_SIGN_IN — 打开官网登录页并带上 extension_id。
 * 真正写入 AccountBinding 由官网 handoff 完成。
 */
export async function handleAuthSignIn(): Promise<AuthSignInResponse> {
  const startedAt = flowStart('Auth', 'AUTH_SIGN_IN（打开官网）')
  try {
    const loginUrl = new URL('/login', getWebsiteBaseUrl())
    loginUrl.searchParams.set('connect_extension', '1')
    loginUrl.searchParams.set('extension_id', chrome.runtime.id)

    await openWebsiteLoginPage(loginUrl.toString())
    flowOk('Auth', 'AUTH_SIGN_IN（打开官网）', startedAt, {
      website: getWebsiteBaseUrl()
    })
    return { ok: true, openedWebsite: true }
  } catch (error) {
    flowFail('Auth', 'AUTH_SIGN_IN（打开官网）', startedAt, error)
    return {
      ok: false,
      errorCode: 'AUTH_SIGN_IN_FAILED',
      ...(error instanceof Error ? { error: error.message } : {})
    }
  }
}

/**
 * 结束登录态：清 session / binding，并关闭同步开关。
 * 不修改 IndexedDB（由调用方按 mode 先行处理）。
 */
async function finishSignOutSession(): Promise<void> {
  await clearAuthSession()
  await clearAccountBinding()
  await patchSyncPrefs({ enabled: false })
  await ensureMemoryCloudSyncAlarm(false)
  await clearAuthValidationTimestamp()
  // 对称清官网 session；失败不回滚扩展已退出
  try {
    await openWebsiteLogoutFromExtension()
  } catch (error) {
    logger.warn('Auth', '扩展退出后打开官网 /logout 失败', error)
  }
}

/**
 * AUTH_SIGN_OUT — 按 mode 决定是否清理本机当前账号 Memory。
 * - keep_local：仅退登录，保留 accountId 桶（默认）
 * - clear_local：删除本机当前 accountId 桶后退出（不动 localProfileId）
 * - sync_then_clear_local：remap 后若有数据则覆盖云端，再清账号桶并退出；本机无数据则不写空云端
 */
export async function handleAuthSignOut(mode: AuthSignOutMode): Promise<AuthSignOutResponse> {
  const startedAt = flowStart('Auth', 'AUTH_SIGN_OUT', { mode })
  try {
    const binding = await getAccountBinding()
    if (!binding) {
      await finishSignOutSession()
      flowOk('Auth', 'AUTH_SIGN_OUT', startedAt, { mode, clearedCount: 0, signedIn: false })
      return { ok: true, mode, clearedCount: 0, syncedCount: 0 }
    }

    let clearedCount = 0
    let syncedCount = 0

    if (mode === 'sync_then_clear_local') {
      const profile = await getOrCreateLocalProfile()
      await memoryItemRepository.remapOwnerId(profile.localProfileId, binding.accountId)
      const items = await memoryItemRepository.listAllByOwnerId(binding.accountId, {
        includeDeleted: true
      })
      if (items.length > 0) {
        const token = await requireAccessToken()
        if (!token) {
          flowFail('Auth', 'AUTH_SIGN_OUT', startedAt, new Error('SYNC_NOT_AUTHENTICATED'))
          return { ok: false, errorCode: 'SYNC_NOT_AUTHENTICATED' }
        }
        try {
          const result = await replaceRemoteWithLocalItems(token.accessToken, items, {
            allowDestructiveShrink: true
          })
          syncedCount = result.written
          await patchSyncPrefs({
            enabled: true,
            lastPushedAt: new Date().toISOString()
          })
        } catch (error) {
          flowFail('Auth', 'AUTH_SIGN_OUT', startedAt, error)
          return {
            ok: false,
            errorCode: 'SYNC_REPLACE_LOCAL_FAILED',
            ...(error instanceof Error ? { error: error.message } : {})
          }
        }
      }
      clearedCount = items.length
      await memoryItemRepository.replaceOwnerItems(binding.accountId, [])
    } else if (mode === 'clear_local') {
      const items = await memoryItemRepository.listAllByOwnerId(binding.accountId, {
        includeDeleted: true
      })
      clearedCount = items.length
      await memoryItemRepository.replaceOwnerItems(binding.accountId, [])
    }

    await finishSignOutSession()
    flowOk('Auth', 'AUTH_SIGN_OUT', startedAt, { mode, clearedCount, syncedCount })
    return { ok: true, mode, clearedCount, syncedCount }
  } catch (error) {
    flowFail('Auth', 'AUTH_SIGN_OUT', startedAt, error)
    return {
      ok: false,
      errorCode: 'AUTH_SIGN_OUT_FAILED',
      ...(error instanceof Error ? { error: error.message } : {})
    }
  }
}

/**
 * GET_AUTH_STATE — 读本地 session；节流后用 refresh 探测是否仍有效（官网退出兜底）。
 * 失效则按 keep_local 清登录态（保留 Memory）。
 */
export async function handleGetAuthState(): Promise<GetAuthStateResponse> {
  const startedAt = flowStart('Auth', 'GET_AUTH_STATE')
  try {
    const [binding, syncPrefs] = await Promise.all([getAccountBinding(), getSyncPrefs()])
    let session = await getAuthSession()

    if (binding && session) {
      const revalidated = await revalidateAuthSession(session)
      if (revalidated.status === 'valid') {
        if (
          revalidated.session.accessToken !== session.accessToken ||
          revalidated.session.refreshToken !== session.refreshToken ||
          revalidated.session.avatarUrl !== session.avatarUrl
        ) {
          await setAuthSession(revalidated.session)
        }
        session = revalidated.session
      } else if (revalidated.status === 'invalid') {
        await clearAuthSession()
        await clearAccountBinding()
        await patchSyncPrefs({ enabled: false })
        await ensureMemoryCloudSyncAlarm(false)
        session = null
        flowOk('Auth', 'GET_AUTH_STATE', startedAt, {
          signedIn: false,
          reason: 'revalidate_invalid',
          detail: revalidated.reason
        })
        return {
          ok: true,
          signedIn: false,
          binding: null,
          syncPrefs: await getSyncPrefs()
        }
      }
      // uncertain / skipped：保留本地 session，不误踢
    }

    const stillBound = await getAccountBinding()
    // 已登录会话兜底：历史登录若未归并，打开 Popup/设置时补一次（幂等）
    if (stillBound && session) {
      await absorbLocalProfileIntoAccount(stillBound.accountId)
    }

    flowOk('Auth', 'GET_AUTH_STATE', startedAt, {
      signedIn: Boolean(stillBound && session),
      syncEnabled: syncPrefs.enabled,
      hasAvatar: Boolean(session?.avatarUrl)
    })
    return {
      ok: true,
      signedIn: Boolean(stillBound && session),
      binding: stillBound,
      syncPrefs: stillBound ? syncPrefs : await getSyncPrefs(),
      ...(session?.email ? { email: session.email } : {}),
      ...(session?.avatarUrl ? { avatarUrl: session.avatarUrl } : {}),
      ...(session?.displayName ? { displayName: session.displayName } : {})
    }
  } catch (error) {
    flowFail('Auth', 'GET_AUTH_STATE', startedAt, error)
    return {
      ok: false,
      errorCode: 'AUTH_STATE_READ_FAILED',
      ...(error instanceof Error ? { error: error.message } : {})
    }
  }
}

/**
 * REFRESH_AUTH_PROFILE — 主动 getUser 刷新头像/展示名（Settings / Header 缺图自愈）。
 * 不替代登录；失败保留原 session。
 */
export async function handleRefreshAuthProfile(): Promise<RefreshAuthProfileResponse> {
  const startedAt = flowStart('Auth', 'REFRESH_AUTH_PROFILE')
  try {
    const [binding, session] = await Promise.all([getAccountBinding(), getAuthSession()])
    if (!binding || !session) {
      return { ok: false, errorCode: 'SYNC_NOT_AUTHENTICATED' }
    }

    // access 将过期时先 refresh，再 getUser
    const token = await requireAccessToken()
    if (!token) {
      return { ok: false, errorCode: 'SYNC_NOT_AUTHENTICATED' }
    }
    const latestSession = (await getAuthSession()) ?? session
    const updated = await refreshAuthProfileFields(latestSession)
    if (!updated) {
      flowFail('Auth', 'REFRESH_AUTH_PROFILE', startedAt, new Error('getUser_failed'))
      return { ok: false, errorCode: 'AUTH_PROFILE_REFRESH_FAILED' }
    }

    await setAuthSession(updated)
    flowOk('Auth', 'REFRESH_AUTH_PROFILE', startedAt, {
      hasAvatar: Boolean(updated.avatarUrl),
      hasDisplayName: Boolean(updated.displayName)
    })
    return {
      ok: true,
      ...(updated.email ? { email: updated.email } : {}),
      ...(updated.avatarUrl ? { avatarUrl: updated.avatarUrl } : {}),
      ...(updated.displayName ? { displayName: updated.displayName } : {})
    }
  } catch (error) {
    flowFail('Auth', 'REFRESH_AUTH_PROFILE', startedAt, error)
    return {
      ok: false,
      errorCode: 'AUTH_PROFILE_REFRESH_FAILED',
      ...(error instanceof Error ? { error: error.message } : {})
    }
  }
}

/** GET_SYNC_STATUS */
export async function handleGetSyncStatus(): Promise<GetSyncStatusResponse> {
  const startedAt = flowStart('MemorySync', 'GET_SYNC_STATUS')
  try {
    const [binding, syncPrefs, profile, orphans, privacyPrefs] = await Promise.all([
      getAccountBinding(),
      getSyncPrefs(),
      getOrCreateLocalProfile(),
      summarizeOrphanOwnerBuckets(),
      getPrivacyPrefs()
    ])
    const privacyNoticeAcked = hasAckedCurrentPrivacyNotice(privacyPrefs)

    const accountOwnerCount = binding
      ? (await memoryItemRepository.listAllByOwnerId(binding.accountId)).length
      : 0
    const localProfileOwnerCount = (
      await memoryItemRepository.listAllByOwnerId(profile.localProfileId)
    ).length
    const localCount =
      binding && binding.accountId !== profile.localProfileId
        ? accountOwnerCount + localProfileOwnerCount
        : binding
          ? accountOwnerCount
          : localProfileOwnerCount

    if (!binding) {
      flowOk('MemorySync', 'GET_SYNC_STATUS', startedAt, {
        signedIn: false,
        localCount,
        orphanBucketCount: orphans.orphanBucketCount
      })
      return {
        ok: true,
        signedIn: false,
        syncEnabled: syncPrefs.enabled,
        localCount,
        accountOwnerCount: 0,
        localProfileOwnerCount,
        remoteCount: 0,
        latestRemoteUpdatedAt: null,
        needsConflictChoice: false,
        orphanBucketCount: orphans.orphanBucketCount,
        orphanActiveCount: orphans.orphanActiveCount,
        privacyNoticeAcked,
        ...(syncPrefs.lastPulledAt ? { lastPulledAt: syncPrefs.lastPulledAt } : {}),
        ...(syncPrefs.lastPushedAt ? { lastPushedAt: syncPrefs.lastPushedAt } : {})
      }
    }

    const token = await requireAccessToken()
    if (!token) {
      return { ok: false, errorCode: 'SYNC_NOT_AUTHENTICATED' }
    }

    const remote = await fetchRemoteSyncStatus(token.accessToken)
    // 开同步已改为自动并集，不再要求用户选 A/B
    const needsConflictChoice = false

    flowOk('MemorySync', 'GET_SYNC_STATUS', startedAt, {
      localCount,
      remoteCount: remote.remoteCount,
      needsConflictChoice,
      orphanBucketCount: orphans.orphanBucketCount,
      privacyNoticeAcked
    })

    return {
      ok: true,
      signedIn: true,
      syncEnabled: syncPrefs.enabled,
      localCount,
      accountOwnerCount,
      localProfileOwnerCount,
      remoteCount: remote.remoteCount,
      latestRemoteUpdatedAt: remote.latestUpdatedAt,
      needsConflictChoice,
      orphanBucketCount: orphans.orphanBucketCount,
      orphanActiveCount: orphans.orphanActiveCount,
      privacyNoticeAcked,
      ...(syncPrefs.lastPulledAt ? { lastPulledAt: syncPrefs.lastPulledAt } : {}),
      ...(syncPrefs.lastPushedAt ? { lastPushedAt: syncPrefs.lastPushedAt } : {})
    }
  } catch (error) {
    flowFail('MemorySync', 'GET_SYNC_STATUS', startedAt, error)
    return {
      ok: false,
      errorCode: 'SYNC_STATUS_FAILED',
      ...(error instanceof Error ? { error: error.message } : {})
    }
  }
}

/** SET_SYNC_ENABLED */
export async function handleSetSyncEnabled(enabled: boolean): Promise<SetSyncEnabledResponse> {
  const startedAt = flowStart('MemorySync', 'SET_SYNC_ENABLED', { enabled })
  try {
    const binding = await getAccountBinding()
    if (!binding) {
      return { ok: false, errorCode: 'SYNC_NOT_AUTHENTICATED' }
    }

    // 开同步前必须已确认当前隐私说明版本
    if (enabled) {
      const privacyPrefs = await getPrivacyPrefs()
      if (!hasAckedCurrentPrivacyNotice(privacyPrefs)) {
        flowFail('MemorySync', 'SET_SYNC_ENABLED', startedAt, new Error('PRIVACY_NOTICE_REQUIRED'))
        return { ok: false, errorCode: 'PRIVACY_NOTICE_REQUIRED' }
      }
    }

    const syncPrefs = await patchSyncPrefs({ enabled })

    if (!enabled) {
      await ensureMemoryCloudSyncAlarm(false)
      flowOk('MemorySync', 'SET_SYNC_ENABLED', startedAt, { enabled: false })
      return {
        ok: true,
        syncPrefs,
        needsConflictChoice: false,
        localCount: 0,
        remoteCount: 0
      }
    }

    // 开启同步：空侧自动对齐；两边都有 → 按 id 并集（updatedAt 较新胜）写回两侧
    // 对齐失败则关回同步，避免「开关已开、云端已被半写」的假成功态
    const failOpen = async (
      errorCode: AccountSyncErrorCode,
      error?: string
    ): Promise<SetSyncEnabledResponse> => {
      await patchSyncPrefs({ enabled: false })
      return {
        ok: false,
        errorCode,
        ...(error ? { error } : {})
      }
    }

    const statusBefore = await handleGetSyncStatus()
    if (!statusBefore.ok) {
      return failOpen(statusBefore.errorCode, statusBefore.error)
    }

    if (statusBefore.localCount > 0 && statusBefore.remoteCount === 0) {
      const replaced = await handleSyncReplaceWithLocal()
      if (!replaced.ok) {
        return failOpen(replaced.errorCode, replaced.error)
      }
    } else if (statusBefore.localCount === 0 && statusBefore.remoteCount > 0) {
      const replaced = await handleSyncReplaceWithRemote()
      if (!replaced.ok) {
        return failOpen(replaced.errorCode, replaced.error)
      }
    } else if (statusBefore.localCount > 0 && statusBefore.remoteCount > 0) {
      const merged = await handleSyncMergeLocalAndRemote()
      if (!merged.ok) {
        return failOpen(merged.errorCode, merged.error)
      }
    }

    const status = await handleGetSyncStatus()
    if (!status.ok) {
      await ensureMemoryCloudSyncAlarm(true)
      return {
        ok: false,
        errorCode: status.errorCode,
        ...(status.error ? { error: status.error } : {})
      }
    }

    await ensureMemoryCloudSyncAlarm(true)

    flowOk('MemorySync', 'SET_SYNC_ENABLED', startedAt, {
      enabled,
      needsConflictChoice: false,
      localCount: status.localCount,
      remoteCount: status.remoteCount
    })

    return {
      ok: true,
      syncPrefs: await getSyncPrefs(),
      needsConflictChoice: false,
      localCount: status.localCount,
      remoteCount: status.remoteCount
    }
  } catch (error) {
    flowFail('MemorySync', 'SET_SYNC_ENABLED', startedAt, error)
    return {
      ok: false,
      errorCode: 'SYNC_PREFS_UPDATE_FAILED',
      ...(error instanceof Error ? { error: error.message } : {})
    }
  }
}

/**
 * 本机 ∪ 云端按 id 合并，写回本机与云端（开同步双边都有时）。
 * 同 id：updatedAt 较新胜；相等保留云端。孤儿桶不动。
 * 先写云端再写本机；pull 空但 status 有数则中止，防止 454→5。
 */
export async function handleSyncMergeLocalAndRemote(): Promise<
  | { ok: true; mergedCount: number; backupId: string }
  | { ok: false; errorCode: AccountSyncErrorCode; error?: string }
> {
  const startedAt = flowStart('MemorySync', 'SYNC_MERGE_LOCAL_REMOTE')
  try {
    const [binding, profile, token] = await Promise.all([
      getAccountBinding(),
      getOrCreateLocalProfile(),
      requireAccessToken()
    ])
    if (!binding || !token) {
      return { ok: false, errorCode: 'SYNC_NOT_AUTHENTICATED' }
    }

    const remoteStatus = await fetchRemoteSyncStatus(token.accessToken)
    await memoryItemRepository.remapOwnerId(profile.localProfileId, binding.accountId)
    const localItems = await memoryItemRepository.listAllByOwnerId(binding.accountId, {
      includeDeleted: true
    })
    const remoteRaw = await pullRemoteMemoryItems(token.accessToken)
    const remoteItems = parseCloudItems(remoteRaw)

    // status 显示有云端数据，但 pull/解析后为空 → 禁止继续（否则会用本机 5 条盖掉云）
    if (remoteStatus.remoteCount > 0 && remoteItems.length === 0) {
      flowFail('MemorySync', 'SYNC_MERGE_LOCAL_REMOTE', startedAt, new Error('pull_empty_mismatch'))
      return {
        ok: false,
        errorCode: 'SYNC_MERGE_FAILED',
        error: 'pull_empty_mismatch'
      }
    }
    if (remoteRaw.length > 0 && remoteItems.length < remoteRaw.length) {
      flowFail('MemorySync', 'SYNC_MERGE_LOCAL_REMOTE', startedAt, new Error('pull_parse_dropped'))
      return {
        ok: false,
        errorCode: 'SYNC_MERGE_FAILED',
        error: `pull_parse_dropped:${remoteRaw.length - remoteItems.length}`
      }
    }

    const merged = mergeMemoryItemsByUpdatedAt(localItems, remoteItems, binding.accountId)
    if (merged.length < remoteItems.length || merged.length < localItems.length) {
      flowFail('MemorySync', 'SYNC_MERGE_LOCAL_REMOTE', startedAt, new Error('merge_shrunk'))
      return { ok: false, errorCode: 'SYNC_MERGE_FAILED', error: 'merge_shrunk' }
    }

    // 先盖云（服务端还会拒绝缩量），成功后再写本机
    const result = await replaceRemoteWithLocalItems(token.accessToken, merged)
    await memoryItemRepository.replaceOwnerItems(binding.accountId, merged)
    const now = new Date().toISOString()
    await patchSyncPrefs({
      enabled: true,
      lastPushedAt: now,
      lastPulledAt: now
    })

    flowOk('MemorySync', 'SYNC_MERGE_LOCAL_REMOTE', startedAt, {
      localCount: localItems.length,
      remoteCount: remoteItems.length,
      mergedCount: merged.length,
      backupId: result.backupId
    })
    return { ok: true, mergedCount: merged.length, backupId: result.backupId }
  } catch (error) {
    flowFail('MemorySync', 'SYNC_MERGE_LOCAL_REMOTE', startedAt, error)
    return {
      ok: false,
      errorCode: 'SYNC_MERGE_FAILED',
      ...(error instanceof Error ? { error: error.message } : {})
    }
  }
}

/**
 * 增量云同步：pull(since) → LWW 写入本机 → push 水位后变更。
 * 定时闹钟与设置「立即同步」共用；不走整侧 replace。
 */
export async function handleIncrementalMemorySync(): Promise<RunIncrementalMemorySyncResponse> {
  if (incrementalSyncInFlight) {
    return incrementalSyncInFlight
  }

  incrementalSyncInFlight = runIncrementalMemorySync().finally(() => {
    incrementalSyncInFlight = null
  })
  return incrementalSyncInFlight
}

async function runIncrementalMemorySync(): Promise<RunIncrementalMemorySyncResponse> {
  const startedAt = flowStart('MemorySync', 'INCREMENTAL_SYNC')
  try {
    const [binding, syncPrefs, profile, token] = await Promise.all([
      getAccountBinding(),
      getSyncPrefs(),
      getOrCreateLocalProfile(),
      requireAccessToken()
    ])

    if (!binding || !token) {
      return { ok: false, errorCode: 'SYNC_NOT_AUTHENTICATED' }
    }
    if (!syncPrefs.enabled) {
      flowOk('MemorySync', 'INCREMENTAL_SYNC', startedAt, { skipped: true, reason: 'disabled' })
      return {
        ok: false,
        errorCode: 'SYNC_INCREMENTAL_FAILED',
        error: 'sync_disabled'
      }
    }

    await memoryItemRepository.remapOwnerId(profile.localProfileId, binding.accountId)
    const localBefore = await memoryItemRepository.listAllByOwnerId(binding.accountId, {
      includeDeleted: true
    })

    const since = syncPrefs.lastPulledAt
    const remoteRaw = await pullRemoteMemoryItems(token.accessToken, {
      ...(since ? { since } : {})
    })
    const remoteItems = parseCloudItems(remoteRaw)

    // 全量 pull：status 有数但解析为空 → 中止（防再演 454→5）
    if (!since) {
      const remoteStatus = await fetchRemoteSyncStatus(token.accessToken)
      if (remoteStatus.remoteCount > 0 && remoteItems.length === 0) {
        flowFail('MemorySync', 'INCREMENTAL_SYNC', startedAt, new Error('pull_empty_mismatch'))
        return {
          ok: false,
          errorCode: 'SYNC_INCREMENTAL_FAILED',
          error: 'pull_empty_mismatch'
        }
      }
    }
    if (remoteRaw.length > 0 && remoteItems.length < remoteRaw.length) {
      flowFail('MemorySync', 'INCREMENTAL_SYNC', startedAt, new Error('pull_parse_dropped'))
      return {
        ok: false,
        errorCode: 'SYNC_INCREMENTAL_FAILED',
        error: `pull_parse_dropped:${remoteRaw.length - remoteItems.length}`
      }
    }

    const merged = mergeMemoryItemsByUpdatedAt(localBefore, remoteItems, binding.accountId)
    // 增量：只写回相对本机有变化的条目（含软删）
    const localById = new Map(localBefore.map(item => [item.id, item]))
    const changedLocally = merged.filter(item => {
      const prev = localById.get(item.id)
      return !prev || prev.updatedAt !== item.updatedAt || prev.deletedAt !== item.deletedAt
    })
    if (changedLocally.length > 0) {
      await memoryItemRepository.putMany(changedLocally)
    }

    const toPush = selectMemoryItemsToPush(merged, syncPrefs.lastPushedAt)
    const pushResult = await pushRemoteMemoryItems(token.accessToken, toPush)

    const now = new Date().toISOString()
    const nextPulledAt =
      remoteItems.length > 0
        ? remoteItems.reduce(
            (max, item) => (item.updatedAt > max ? item.updatedAt : max),
            remoteItems[0]!.updatedAt
          )
        : (since ?? now)
    const nextPushedAt =
      toPush.length > 0
        ? toPush.reduce(
            (max, item) => (item.updatedAt > max ? item.updatedAt : max),
            toPush[0]!.updatedAt
          )
        : (syncPrefs.lastPushedAt ?? now)

    await patchSyncPrefs({
      lastPulledAt: nextPulledAt,
      lastPushedAt: nextPushedAt
    })

    flowOk('MemorySync', 'INCREMENTAL_SYNC', startedAt, {
      pulled: remoteItems.length,
      changedLocally: changedLocally.length,
      pushed: pushResult.written,
      mergedLocal: merged.length,
      since: since ?? null,
      lastPulledAt: nextPulledAt,
      lastPushedAt: nextPushedAt
    })

    return {
      ok: true,
      pulled: remoteItems.length,
      pushed: pushResult.written,
      mergedLocal: merged.length,
      lastPulledAt: nextPulledAt,
      lastPushedAt: nextPushedAt
    }
  } catch (error) {
    flowFail('MemorySync', 'INCREMENTAL_SYNC', startedAt, error)
    return {
      ok: false,
      errorCode: 'SYNC_INCREMENTAL_FAILED',
      ...(error instanceof Error ? { error: error.message } : {})
    }
  }
}

/** SYNC_REPLACE_WITH_LOCAL — 策略 A（本机空库且云端有数时拒绝，防误清空云） */
export async function handleSyncReplaceWithLocal(): Promise<SyncReplaceWithLocalResponse> {
  const startedAt = flowStart('MemorySync', 'SYNC_REPLACE_WITH_LOCAL')
  try {
    const [binding, profile, token] = await Promise.all([
      getAccountBinding(),
      getOrCreateLocalProfile(),
      requireAccessToken()
    ])
    if (!binding || !token) {
      return { ok: false, errorCode: 'SYNC_NOT_AUTHENTICATED' }
    }

    await memoryItemRepository.remapOwnerId(profile.localProfileId, binding.accountId)
    const items = await memoryItemRepository.listAllByOwnerId(binding.accountId, {
      includeDeleted: true
    })

    // 本机无任何条目（含软删）时：云端有数 → 拒；两边皆空 → 跳过写云（无备份）
    if (items.length === 0) {
      const remote = await fetchRemoteSyncStatus(token.accessToken)
      if (remote.remoteCount > 0) {
        flowFail(
          'MemorySync',
          'SYNC_REPLACE_WITH_LOCAL',
          startedAt,
          new Error('SYNC_REPLACE_LOCAL_EMPTY')
        )
        return { ok: false, errorCode: 'SYNC_REPLACE_LOCAL_EMPTY' }
      }
      await patchSyncPrefs({ enabled: true })
      flowOk('MemorySync', 'SYNC_REPLACE_WITH_LOCAL', startedAt, {
        written: 0,
        skippedEmptyBoth: true
      })
      return { ok: true, written: 0, backupId: '' }
    }

    const result = await replaceRemoteWithLocalItems(token.accessToken, items)
    await patchSyncPrefs({
      enabled: true,
      lastPushedAt: new Date().toISOString()
    })

    flowOk('MemorySync', 'SYNC_REPLACE_WITH_LOCAL', startedAt, result)
    return { ok: true, written: result.written, backupId: result.backupId }
  } catch (error) {
    flowFail('MemorySync', 'SYNC_REPLACE_WITH_LOCAL', startedAt, error)
    const remoteDenied = error instanceof Error && error.message === 'empty_local_replace_denied'
    return {
      ok: false,
      errorCode: remoteDenied ? 'SYNC_REPLACE_LOCAL_EMPTY' : 'SYNC_REPLACE_LOCAL_FAILED',
      ...(error instanceof Error ? { error: error.message } : {})
    }
  }
}

/** SYNC_REPLACE_WITH_REMOTE — 策略 B */
export async function handleSyncReplaceWithRemote(): Promise<SyncReplaceWithRemoteResponse> {
  const startedAt = flowStart('MemorySync', 'SYNC_REPLACE_WITH_REMOTE')
  try {
    const [binding, profile, token] = await Promise.all([
      getAccountBinding(),
      getOrCreateLocalProfile(),
      requireAccessToken()
    ])
    if (!binding || !token) {
      return { ok: false, errorCode: 'SYNC_NOT_AUTHENTICATED' }
    }

    const remoteRaw = await pullRemoteMemoryItems(token.accessToken)
    const remoteItems = parseCloudItems(remoteRaw).map(item => ({
      ...item,
      ownerId: binding.accountId
    }))

    // 清掉本机 localProfile 残留与账号库，再写入云端全集
    await memoryItemRepository.replaceOwnerItems(profile.localProfileId, [])
    const written = await memoryItemRepository.replaceOwnerItems(binding.accountId, remoteItems)
    await patchSyncPrefs({
      enabled: true,
      lastPulledAt: new Date().toISOString()
    })

    flowOk('MemorySync', 'SYNC_REPLACE_WITH_REMOTE', startedAt, { written })
    return { ok: true, written }
  } catch (error) {
    flowFail('MemorySync', 'SYNC_REPLACE_WITH_REMOTE', startedAt, error)
    return {
      ok: false,
      errorCode: 'SYNC_REPLACE_REMOTE_FAILED',
      ...(error instanceof Error ? { error: error.message } : {})
    }
  }
}

/**
 * RESTORE_LATEST_SYNC_BACKUP — 恢复云端最近一次 replace 前快照，再拉回本机。
 * 用于误开同步把云端盖小后的自救。
 */
export async function handleRestoreLatestSyncBackup(): Promise<RestoreLatestSyncBackupResponse> {
  const startedAt = flowStart('MemorySync', 'RESTORE_LATEST_SYNC_BACKUP')
  try {
    const [binding, token] = await Promise.all([getAccountBinding(), requireAccessToken()])
    if (!binding || !token) {
      return { ok: false, errorCode: 'SYNC_NOT_AUTHENTICATED' }
    }

    const restored = await restoreRemoteFromLatestBackup(token.accessToken)
    const pulled = await handleSyncReplaceWithRemote()
    if (!pulled.ok) {
      flowFail('MemorySync', 'RESTORE_LATEST_SYNC_BACKUP', startedAt, new Error(pulled.errorCode))
      return {
        ok: false,
        errorCode: pulled.errorCode,
        ...(pulled.error ? { error: pulled.error } : {})
      }
    }

    flowOk('MemorySync', 'RESTORE_LATEST_SYNC_BACKUP', startedAt, {
      backupId: restored.backupId,
      restored: restored.restored,
      localWritten: pulled.written
    })
    return {
      ok: true,
      backupId: restored.backupId,
      restored: restored.restored,
      localWritten: pulled.written
    }
  } catch (error) {
    flowFail('MemorySync', 'RESTORE_LATEST_SYNC_BACKUP', startedAt, error)
    return {
      ok: false,
      errorCode: 'SYNC_RESTORE_BACKUP_FAILED',
      ...(error instanceof Error ? { error: error.message } : {})
    }
  }
}

/** EXPORT_ORPHAN_OWNERS — 导出换号残留桶（含软删） */
export async function handleExportOrphanOwners(): Promise<ExportOrphanOwnersResponse> {
  const startedAt = flowStart('Identity', 'EXPORT_ORPHAN_OWNERS')
  try {
    const items = await exportOrphanOwnerBuckets()
    const orphanBucketCount = new Set(items.map(item => item.ownerId)).size
    flowOk('Identity', 'EXPORT_ORPHAN_OWNERS', startedAt, {
      orphanBucketCount,
      itemCount: items.length
    })
    return {
      ok: true,
      orphanBucketCount,
      items
    }
  } catch (error) {
    flowFail('Identity', 'EXPORT_ORPHAN_OWNERS', startedAt, error)
    return {
      ok: false,
      errorCode: 'ORPHAN_EXPORT_FAILED',
      ...(error instanceof Error ? { error: error.message } : {})
    }
  }
}

/** CLEAR_ORPHAN_OWNERS — 硬删换号残留桶 */
export async function handleClearOrphanOwners(): Promise<ClearOrphanOwnersResponse> {
  const startedAt = flowStart('Identity', 'CLEAR_ORPHAN_OWNERS')
  try {
    const result = await clearOrphanOwnerBuckets()
    flowOk('Identity', 'CLEAR_ORPHAN_OWNERS', startedAt, result)
    return { ok: true, ...result }
  } catch (error) {
    flowFail('Identity', 'CLEAR_ORPHAN_OWNERS', startedAt, error)
    return {
      ok: false,
      errorCode: 'ORPHAN_CLEAR_FAILED',
      ...(error instanceof Error ? { error: error.message } : {})
    }
  }
}

/** ACK_PRIVACY_NOTICE — 确认当前版本隐私说明 */
export async function handleAckPrivacyNotice(): Promise<AckPrivacyNoticeResponse> {
  const startedAt = flowStart('Privacy', 'ACK_PRIVACY_NOTICE')
  try {
    const prefs = await ackCurrentPrivacyNotice()
    flowOk('Privacy', 'ACK_PRIVACY_NOTICE', startedAt, {
      noticeAckedAt: prefs.noticeAckedAt,
      noticeAckedVersion: prefs.noticeAckedVersion
    })
    return {
      ok: true,
      privacyNoticeAcked: true,
      noticeAckedAt: prefs.noticeAckedAt!
    }
  } catch (error) {
    flowFail('Privacy', 'ACK_PRIVACY_NOTICE', startedAt, error)
    return {
      ok: false,
      errorCode: 'PRIVACY_ACK_FAILED',
      ...(error instanceof Error ? { error: error.message } : {})
    }
  }
}

/**
 * DELETE_CLOUD_MEMORY — 删除云端 Memory + backups；关同步；不动本机 IDB。
 */
export async function handleDeleteCloudMemory(): Promise<DeleteCloudMemoryResponse> {
  const startedAt = flowStart('Privacy', 'DELETE_CLOUD_MEMORY')
  try {
    const token = await requireAccessToken()
    if (!token) {
      return { ok: false, errorCode: 'SYNC_NOT_AUTHENTICATED' }
    }

    const result = await deleteRemoteCloudMemory(token.accessToken)
    await patchSyncPrefs({ enabled: false })
    await ensureMemoryCloudSyncAlarm(false)

    flowOk('Privacy', 'DELETE_CLOUD_MEMORY', startedAt, result)
    return { ok: true, ...result }
  } catch (error) {
    flowFail('Privacy', 'DELETE_CLOUD_MEMORY', startedAt, error)
    return {
      ok: false,
      errorCode: 'CLOUD_DELETE_FAILED',
      ...(error instanceof Error ? { error: error.message } : {})
    }
  }
}

/**
 * DELETE_ACCOUNT — 注销 Auth + 清云端 Memory；清本机 accountId 桶；退登。
 * 不动 localProfileId；订阅/支付由服务端按政策保留。
 */
export async function handleDeleteAccount(): Promise<DeleteAccountResponse> {
  const startedAt = flowStart('Privacy', 'DELETE_ACCOUNT')
  try {
    const binding = await getAccountBinding()
    const token = await requireAccessToken()
    if (!binding || !token) {
      return { ok: false, errorCode: 'SYNC_NOT_AUTHENTICATED' }
    }

    const remote = await deleteRemoteAccount(token.accessToken)

    const items = await memoryItemRepository.listAllByOwnerId(binding.accountId, {
      includeDeleted: true
    })
    const clearedLocalCount = items.length
    await memoryItemRepository.replaceOwnerItems(binding.accountId, [])

    await clearPrivacyPrefs()
    await finishSignOutSession()

    flowOk('Privacy', 'DELETE_ACCOUNT', startedAt, {
      ...remote,
      clearedLocalCount
    })
    return {
      ok: true,
      deletedItems: remote.deletedItems,
      deletedBackups: remote.deletedBackups,
      clearedLocalCount
    }
  } catch (error) {
    flowFail('Privacy', 'DELETE_ACCOUNT', startedAt, error)
    return {
      ok: false,
      errorCode: 'ACCOUNT_DELETE_FAILED',
      ...(error instanceof Error ? { error: error.message } : {})
    }
  }
}

/**
 * EXPORT_LOCAL_MEMORY — 导出当前 owner 本机全部 Memory（含软删）。
 */
export async function handleExportLocalMemory(): Promise<ExportLocalMemoryResponse> {
  const startedAt = flowStart('Privacy', 'EXPORT_LOCAL_MEMORY')
  try {
    const ownerId =
      (await getAccountBinding())?.accountId ?? (await getOrCreateLocalProfile()).localProfileId
    const items = await memoryItemRepository.listAllByOwnerId(ownerId, {
      includeDeleted: true
    })
    flowOk('Privacy', 'EXPORT_LOCAL_MEMORY', startedAt, {
      ownerId,
      itemCount: items.length
    })
    return { ok: true, ownerId, items }
  } catch (error) {
    flowFail('Privacy', 'EXPORT_LOCAL_MEMORY', startedAt, error)
    return {
      ok: false,
      errorCode: 'LOCAL_EXPORT_FAILED',
      ...(error instanceof Error ? { error: error.message } : {})
    }
  }
}
