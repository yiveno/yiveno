/**
 * 账户登录与云同步 Background 编排（Phase C 铺路）。
 * 登录主路径：打开官网 → external handoff 写入 session（扩展不做 OAuth）。
 */

import { absorbLocalProfileIntoAccount } from '@/application/identity/absorb-local-profile-into-account'
import type {
  AuthSignInResponse,
  AuthSignOutMode,
  AuthSignOutResponse,
  GetAuthStateResponse,
  GetSyncStatusResponse,
  SetSyncEnabledResponse,
  SyncReplaceWithLocalResponse,
  SyncReplaceWithRemoteResponse
} from '@/core/messaging/account-sync-messages'
import { MemoryItemSchema, type MemoryItem } from '@/core/memory/memory-item'
import { refreshAuthSession } from '@/infrastructure/auth/extension-oauth'
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
import { memoryItemRepository } from '@/infrastructure/indexeddb/memory-item-repository'
import { flowFail, flowOk, flowStart } from '@/infrastructure/logging/flow-log'
import { logger } from '@/infrastructure/logging/logger'
import {
  getWebsiteBaseUrl,
  openWebsiteLoginPage,
  openWebsiteLogoutFromExtension
} from '@/infrastructure/browser/website-page'
import {
  fetchRemoteSyncStatus,
  pullRemoteMemoryItems,
  replaceRemoteWithLocalItems
} from '@/infrastructure/messaging/memory-sync-api-client'

/** access token 提前刷新余量（秒），避免边界过期。 */
const ACCESS_TOKEN_REFRESH_SKEW_SEC = 60

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
  for (const raw of rawItems) {
    const parsed = MemoryItemSchema.safeParse(raw)
    if (parsed.success) {
      items.push(parsed.data)
    }
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
          const result = await replaceRemoteWithLocalItems(token.accessToken, items)
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
        session = null
        flowOk('Auth', 'GET_AUTH_STATE', startedAt, {
          signedIn: false,
          reason: 'revalidate_invalid'
        })
        return {
          ok: true,
          signedIn: false,
          binding: null,
          syncPrefs: await getSyncPrefs()
        }
      }
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

/** GET_SYNC_STATUS */
export async function handleGetSyncStatus(): Promise<GetSyncStatusResponse> {
  const startedAt = flowStart('MemorySync', 'GET_SYNC_STATUS')
  try {
    const [binding, syncPrefs, profile] = await Promise.all([
      getAccountBinding(),
      getSyncPrefs(),
      getOrCreateLocalProfile()
    ])

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
        localCount
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
        needsConflictChoice: false
      }
    }

    const token = await requireAccessToken()
    if (!token) {
      return { ok: false, errorCode: 'SYNC_NOT_AUTHENTICATED' }
    }

    const remote = await fetchRemoteSyncStatus(token.accessToken)
    const needsConflictChoice = syncPrefs.enabled && localCount > 0 && remote.remoteCount > 0

    flowOk('MemorySync', 'GET_SYNC_STATUS', startedAt, {
      localCount,
      remoteCount: remote.remoteCount,
      needsConflictChoice
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
      needsConflictChoice
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

    const syncPrefs = await patchSyncPrefs({ enabled })

    if (!enabled) {
      flowOk('MemorySync', 'SET_SYNC_ENABLED', startedAt, { enabled: false })
      return {
        ok: true,
        syncPrefs,
        needsConflictChoice: false,
        localCount: 0,
        remoteCount: 0
      }
    }

    // 开启同步：空侧自动对齐；两边都有则交由 UI 选 A/B
    const statusBefore = await handleGetSyncStatus()
    if (!statusBefore.ok) {
      return statusBefore
    }

    if (statusBefore.localCount > 0 && statusBefore.remoteCount === 0) {
      const replaced = await handleSyncReplaceWithLocal()
      if (!replaced.ok) {
        return {
          ok: false,
          errorCode: replaced.errorCode,
          ...(replaced.error ? { error: replaced.error } : {})
        }
      }
    } else if (statusBefore.localCount === 0 && statusBefore.remoteCount > 0) {
      const replaced = await handleSyncReplaceWithRemote()
      if (!replaced.ok) {
        return {
          ok: false,
          errorCode: replaced.errorCode,
          ...(replaced.error ? { error: replaced.error } : {})
        }
      }
    }

    const status = await handleGetSyncStatus()
    if (!status.ok) {
      return status
    }

    flowOk('MemorySync', 'SET_SYNC_ENABLED', startedAt, {
      enabled,
      needsConflictChoice: status.needsConflictChoice
    })

    return {
      ok: true,
      syncPrefs,
      needsConflictChoice: status.needsConflictChoice,
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

/** SYNC_REPLACE_WITH_LOCAL — 策略 A */
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
    const result = await replaceRemoteWithLocalItems(token.accessToken, items)
    await patchSyncPrefs({
      enabled: true,
      lastPushedAt: new Date().toISOString()
    })

    flowOk('MemorySync', 'SYNC_REPLACE_WITH_LOCAL', startedAt, result)
    return { ok: true, written: result.written, backupId: result.backupId }
  } catch (error) {
    flowFail('MemorySync', 'SYNC_REPLACE_WITH_LOCAL', startedAt, error)
    return {
      ok: false,
      errorCode: 'SYNC_REPLACE_LOCAL_FAILED',
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
