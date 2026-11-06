/**
 * 账户登录与云同步 Background 编排（Phase C 铺路）。
 * 登录主路径：打开官网 → external handoff 写入 session（扩展不做 OAuth）。
 */

import {
  deleteLoginMigrationExcerpts,
  exportLoginMigrationExcerpts,
  importLoginMigration,
  summarizeLoginMigrationForCurrentBinding
} from '@/application/identity/login-migration'
import {
  clearOrphanOwnerBuckets,
  exportOrphanOwnerBuckets,
  summarizeOrphanOwnerBuckets
} from '@/application/identity/orphan-owner-buckets'
import { clearAccountLibraryOnSignOut } from '@/application/identity/clear-account-library-on-sign-out'
import { resetChromeBookmarkImportAfterLocalClear } from '@/application/capture/import-chrome-bookmarks-service'
import { filterCloudSyncableMemoryItems } from '@/core/memory/cloud-syncable-memory-item'
import { mergeMemoryItemsByUpdatedAt } from '@/core/memory/merge-memory-items-by-updated-at'
import { selectMemoryItemsToPush } from '@/core/memory/select-memory-items-to-push'
import type {
  AccountSyncErrorCode,
  AuthConnectWebsiteResponse,
  AuthSignInResponse,
  AuthSignOutMode,
  AuthSignOutResponse,
  ClearLocalMemoryResponse,
  ClearLocalRecallAdaptationResponse,
  ClearOrphanOwnersResponse,
  DeleteAccountResponse,
  DeleteCloudMemoryResponse,
  ExportLocalMemoryResponse,
  ExportOrphanOwnersResponse,
  GetAuthStateResponse,
  GetLoginMigrationStatusResponse,
  LoginMigrationAction,
  ProbeWebsiteSignedInResponse,
  ResolveLoginMigrationResponse,
  GetSubscriptionStatusResponse,
  GetSyncStatusResponse,
  RefreshAuthProfileResponse,
  RestoreLatestSyncBackupResponse,
  AckPrivacyNoticeResponse,
  RunIncrementalMemorySyncResponse,
  SetSyncEnabledResponse,
  SetMcpReadOnlyResponse,
  SyncReplaceWithLocalResponse,
  SyncReplaceWithRemoteResponse
} from '@/core/messaging/account-sync-messages'
import { MemoryItemSchema, type MemoryItem } from '@/core/memory/memory-item'
import { putMcpReadOnlyRemote } from '@/infrastructure/mcp/mcp-api-client'
import {
  clearAuthValidationTimestamp,
  revalidateAuthSession
} from '@/infrastructure/auth/auth-session-revalidate'
import { clearExtensionUninstallRevoke } from '@/infrastructure/auth/extension-uninstall-url'
import { readJwtSessionId } from '@/infrastructure/auth/read-jwt-session-id'
import { probeWebsiteSignedIn } from '@/infrastructure/auth/website-auth-probe'
import { ensureAuthSessionLeaseAlarm } from '@/infrastructure/auth/auth-session-lease-alarm'
import { maybeWriteExtensionDisplacedNotice } from '@/infrastructure/storage/extension-displaced-notice-storage'
import {
  clearLastExtensionLeaseSessionId,
  writeLastExtensionLeaseSessionId
} from '@/infrastructure/storage/last-extension-lease-session-storage'
import {
  beginSuppressDisplacedNotice,
  endSuppressDisplacedNotice
} from '@/infrastructure/storage/suppress-displaced-notice-storage'
import { refreshAuthProfileFields, refreshAuthSession } from '@/infrastructure/auth/extension-oauth'
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
  clearSubscriptionSnapshot,
  getSubscriptionSnapshot,
  isProActiveFromSnapshot,
  refreshSubscriptionSnapshot
} from '@/infrastructure/identity/subscription-service'
import { clearRecallTelemetryEvents } from '@/infrastructure/analytics/recall-telemetry-store'
import { updateUserSettings } from '@/infrastructure/settings/user-settings-service'
import { clearRecallOutcomePairs } from '@/infrastructure/storage/recall-outcome-pairs-storage'
import { bumpMemoryLibraryRevision } from '@/infrastructure/storage/memory-library-revision-storage'
import { syncChromeBookmarkSyncListenersWithIngestSetting } from '@/background/listeners/chrome-bookmark-sync'
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
  openWebsiteAccountConnectPage,
  openWebsiteLoginPage,
  openWebsiteLogoutFromExtension
} from '@/infrastructure/browser/website-page'
import {
  beginUiBridgeConnectWait,
  broadcastRequestExtensionConnect,
  clearUiBridgeConnectWait,
  getUiBridgePortCount
} from '@/background/listeners/ui-bridge'
import { AUTH_SESSION_STORAGE_KEY } from '@/core/identity/auth-session'
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
 * **未登录 / Settings Sign in** 用本入口；已登录 Connect 软条用 {@link handleAuthConnectWebsite}。
 */
export async function handleAuthSignIn(): Promise<AuthSignInResponse> {
  const startedAt = flowStart('Auth', 'AUTH_SIGN_IN（打开官网）')
  try {
    // 登录页 mint 可能先撤旧扩展会话再 handoff：抑制自挤误报 elsewhere
    try {
      await beginSuppressDisplacedNotice()
    } catch (error) {
      logger.warn('Auth', 'Sign in 打开 displaced 抑制窗失败', error)
    }
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

/** 等官网 ack 的最长时间；超时则打开账户页回退。 */
const CONNECT_ACK_TIMEOUT_MS = 2000
/** 等 mint/handoff / 挤掉确认的最长时间。 */
const CONNECT_DONE_TIMEOUT_MS = 60_000

/**
 * AUTH_CONNECT_WEBSITE — 官网已登录时把会话接到扩展。
 * 1) UI 桥 `request_extension_connect`（零导航）
 * 2) 无 ack → 打开 `/account?connect_extension=1`
 * 等到 website_connect_result / handoff 写 session / 超时。
 */
export async function handleAuthConnectWebsite(): Promise<AuthConnectWebsiteResponse> {
  const startedAt = flowStart('Auth', 'AUTH_CONNECT_WEBSITE')
  const extensionId = chrome.runtime.id

  // 已是登录态：幂等成功
  const existing = await getAuthSession()
  if (existing?.userId) {
    flowOk('Auth', 'AUTH_CONNECT_WEBSITE', startedAt, { alreadySignedIn: true })
    return { ok: true, path: 'bridge' }
  }

  // 本机即将 mint：禁止把自挤误报成「别处登录」
  try {
    await beginSuppressDisplacedNotice()
  } catch (error) {
    logger.warn('Auth', 'Connect 打开 displaced 抑制窗失败', error)
  }

  let path: 'bridge' | 'account_tab' = 'bridge'
  let settled = false
  let ackTimer: ReturnType<typeof setTimeout> | undefined
  let doneTimer: ReturnType<typeof setTimeout> | undefined

  const outcome = await new Promise<AuthConnectWebsiteResponse>(resolve => {
    const finish = (response: AuthConnectWebsiteResponse): void => {
      if (settled) {
        return
      }
      settled = true
      clearUiBridgeConnectWait()
      chrome.storage.onChanged.removeListener(onStorageChanged)
      if (ackTimer !== undefined) {
        clearTimeout(ackTimer)
      }
      if (doneTimer !== undefined) {
        clearTimeout(doneTimer)
      }
      resolve(response)
    }

    const onStorageChanged = (
      changes: Record<string, chrome.storage.StorageChange>,
      area: string
    ): void => {
      if (area !== 'local' || !(AUTH_SESSION_STORAGE_KEY in changes)) {
        return
      }
      const next = changes[AUTH_SESSION_STORAGE_KEY]?.newValue
      if (next && typeof next === 'object' && next !== null && 'userId' in next) {
        finish({ ok: true, path })
      }
    }
    chrome.storage.onChanged.addListener(onStorageChanged)

    beginUiBridgeConnectWait({
      onAck: () => {
        path = 'bridge'
        if (ackTimer !== undefined) {
          clearTimeout(ackTimer)
        }
        logger.info('Auth', 'Connect：官网已 ack（零导航）')
      },
      onResult: status => {
        if (status === 'ok') {
          finish({ ok: true, path })
          return
        }
        if (status === 'cancelled_displace') {
          finish({
            ok: false,
            errorCode: 'AUTH_CONNECT_WEBSITE_FAILED',
            cancelled: true
          })
          return
        }
        finish({
          ok: false,
          errorCode: 'AUTH_CONNECT_WEBSITE_FAILED',
          error: status
        })
      }
    })

    const portCount = broadcastRequestExtensionConnect(extensionId)
    logger.info('Auth', 'Connect：已广播 request_extension_connect', { portCount })

    ackTimer = setTimeout(() => {
      if (settled) {
        return
      }
      // 无 Port 或官网未 ack → 账户页原地 mint
      path = 'account_tab'
      void openWebsiteAccountConnectPage()
        .then(() => {
          logger.info('Auth', 'Connect：无 ack，已打开账户页回退')
        })
        .catch(error => {
          logger.warn('Auth', 'Connect：打开账户页失败', error)
          finish({
            ok: false,
            errorCode: 'AUTH_CONNECT_WEBSITE_FAILED',
            ...(error instanceof Error ? { error: error.message } : {})
          })
        })
    }, CONNECT_ACK_TIMEOUT_MS)

    doneTimer = setTimeout(() => {
      finish({
        ok: false,
        errorCode: 'AUTH_CONNECT_WEBSITE_FAILED',
        error: 'timeout'
      })
    }, CONNECT_DONE_TIMEOUT_MS)

    // 无任何 Port：立刻走账户页（不必干等 ack）
    if (getUiBridgePortCount() === 0) {
      if (ackTimer !== undefined) {
        clearTimeout(ackTimer)
      }
      path = 'account_tab'
      void openWebsiteAccountConnectPage().catch(error => {
        logger.warn('Auth', 'Connect：无 Port 时打开账户页失败', error)
        finish({
          ok: false,
          errorCode: 'AUTH_CONNECT_WEBSITE_FAILED',
          ...(error instanceof Error ? { error: error.message } : {})
        })
      })
    }
  })

  try {
    await endSuppressDisplacedNotice()
  } catch (error) {
    logger.warn('Auth', 'Connect 结束 displaced 抑制窗失败', error)
  }

  if (outcome.ok) {
    flowOk('Auth', 'AUTH_CONNECT_WEBSITE', startedAt, { path: outcome.path })
  } else {
    flowFail('Auth', 'AUTH_CONNECT_WEBSITE', startedAt, outcome.error ?? outcome.errorCode)
  }
  return outcome
}

/**
 * PROBE_WEBSITE_SIGNED_IN — 后台打开官网 probe 页，探测是否已有网站会话。
 */
export async function handleProbeWebsiteSignedIn(): Promise<ProbeWebsiteSignedInResponse> {
  const startedAt = flowStart('Auth', 'PROBE_WEBSITE_SIGNED_IN')
  try {
    const websiteSignedIn = await probeWebsiteSignedIn()
    flowOk('Auth', 'PROBE_WEBSITE_SIGNED_IN', startedAt, { websiteSignedIn })
    return { ok: true, websiteSignedIn }
  } catch (error) {
    flowFail('Auth', 'PROBE_WEBSITE_SIGNED_IN', startedAt, error)
    return {
      ok: false,
      errorCode: 'WEBSITE_AUTH_PROBE_FAILED',
      ...(error instanceof Error ? { error: error.message } : {})
    }
  }
}

/**
 * 结束登录态：清 session / binding，并关闭同步开关。
 * 不修改 IndexedDB（由调用方按 mode 先行处理）。
 */
async function finishSignOutSession(): Promise<void> {
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
async function flushAccountExcerptsToCloud(accountId: string): Promise<number> {
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
 * AUTH_SIGN_OUT（ADR-018 · 口径 A）
 * - keep_local：默认——书签回本地档，删除账号桶其余 Memory（摘录等）后退出
 * - flush_then_keep：先 flush 摘录上云，失败则不退出；成功后再同 keep_local 清账号桶
 * - clear_local：整桶清空账号桶（含已归属书签，不回迁）后退出
 * - sync_then_clear_local：遗留路径——先覆盖云端再清账号桶
 */
export async function handleAuthSignOut(mode: AuthSignOutMode): Promise<AuthSignOutResponse> {
  const startedAt = flowStart('Auth', 'AUTH_SIGN_OUT', { mode })
  try {
    const binding = await getAccountBinding()
    if (!binding) {
      await finishSignOutSession()
      flowOk('Auth', 'AUTH_SIGN_OUT', startedAt, {
        mode,
        clearedCount: 0,
        syncedCount: 0,
        releasedToLocalCount: 0,
        signedIn: false
      })
      return {
        ok: true,
        mode,
        clearedCount: 0,
        syncedCount: 0,
        releasedToLocalCount: 0
      }
    }

    let clearedCount = 0
    let syncedCount = 0
    let releasedToLocalCount = 0

    if (mode === 'flush_then_keep') {
      try {
        syncedCount = await flushAccountExcerptsToCloud(binding.accountId)
      } catch (error) {
        const code =
          error instanceof Error && error.message === 'SYNC_NOT_AUTHENTICATED'
            ? 'SYNC_NOT_AUTHENTICATED'
            : 'SYNC_REPLACE_LOCAL_FAILED'
        flowFail('Auth', 'AUTH_SIGN_OUT', startedAt, error)
        return {
          ok: false,
          errorCode: code,
          ...(error instanceof Error ? { error: error.message } : {})
        }
      }
      {
        const cleared = await clearAccountLibraryOnSignOut(binding.accountId)
        clearedCount = cleared.clearedCount
        releasedToLocalCount = cleared.remappedBookmarks
      }
    } else if (mode === 'keep_local') {
      {
        const cleared = await clearAccountLibraryOnSignOut(binding.accountId)
        clearedCount = cleared.clearedCount
        releasedToLocalCount = cleared.remappedBookmarks
      }
    } else if (mode === 'sync_then_clear_local') {
      const profile = await getOrCreateLocalProfile()
      await memoryItemRepository.remapOwnerId(profile.localProfileId, binding.accountId)
      const items = await memoryItemRepository.listAllByOwnerId(binding.accountId, {
        includeDeleted: true
      })
      const outbound = filterCloudSyncableMemoryItems(items)
      if (outbound.length > 0) {
        try {
          syncedCount = await flushAccountExcerptsToCloud(binding.accountId)
        } catch (error) {
          const code =
            error instanceof Error && error.message === 'SYNC_NOT_AUTHENTICATED'
              ? 'SYNC_NOT_AUTHENTICATED'
              : 'SYNC_REPLACE_LOCAL_FAILED'
          flowFail('Auth', 'AUTH_SIGN_OUT', startedAt, error)
          return {
            ok: false,
            errorCode: code,
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
    flowOk('Auth', 'AUTH_SIGN_OUT', startedAt, {
      mode,
      clearedCount,
      syncedCount,
      releasedToLocalCount
    })
    return { ok: true, mode, clearedCount, syncedCount, releasedToLocalCount }
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
 * 失效则按 keep_local 清登录态（清账号桶痕迹；本地档无主摘录保留）。
 */
export async function handleGetAuthState(): Promise<GetAuthStateResponse> {
  const startedAt = flowStart('Auth', 'GET_AUTH_STATE')
  try {
    const [binding, syncPrefs] = await Promise.all([getAccountBinding(), getSyncPrefs()])
    let session = await getAuthSession()
    /** 本次 revalidate 结果；无 binding/session 时不拉订阅。 */
    let authRevalidateStatus: 'skipped' | 'valid' | 'invalid' | 'uncertain' | 'none' = 'none'

    if (binding && session) {
      // force：每次打开都做租约探测（Worker KV）；refresh 仍短节流，避免 Supabase rate limit。
      // 被挤掉优先靠 lease，不依赖 token 端是否限流。
      const revalidated = await revalidateAuthSession(session, { force: true })
      authRevalidateStatus = revalidated.status
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
        // 会话作废：尽力 flush + 清账号桶后 keep_local 退登。
        // elsewhere 软条：仅 lease displaced 且非本机 Connect 编排（立意：别处登录）。
        const displacedAccountId = binding.accountId
        const accessBeforeClear = session.accessToken
        try {
          await flushAccountExcerptsToCloud(displacedAccountId)
        } catch (error) {
          logger.warn('Auth', '会话作废退登前 flush 失败（仍清本机账号桶）', error)
        }
        try {
          await clearAccountLibraryOnSignOut(displacedAccountId)
        } catch (error) {
          logger.warn('Auth', '会话作废退登清账号桶失败', error)
        }
        // 尽力释放本机扩展远程会话（防孤儿租约）。uninstall-revoke / session-release
        // 仅当 KV 仍指向本 session 才清租约 → 他端已占不会误清。
        // 远程失败：写 lastLease 供同机 Connect 静默认领。
        let remoteReleased = false
        try {
          remoteReleased = await clearExtensionUninstallRevoke({
            revokeRemote: true,
            ...(accessBeforeClear.trim() ? { accessTokenFallback: accessBeforeClear } : {})
          })
        } catch (error) {
          logger.warn('Auth', '会话作废退登远程释放失败', error)
        }
        if (remoteReleased) {
          try {
            await clearLastExtensionLeaseSessionId()
          } catch (error) {
            logger.warn('Auth', '会话作废退登清 lastLeaseSessionId 失败', error)
          }
        } else {
          const leaseSid = readJwtSessionId(accessBeforeClear)
          if (leaseSid) {
            try {
              await writeLastExtensionLeaseSessionId(leaseSid)
            } catch (error) {
              logger.warn('Auth', '会话作废退登写 lastLeaseSessionId 失败', error)
            }
          }
        }
        await clearAuthSession()
        await clearAccountBinding()
        await clearSubscriptionSnapshot()
        await patchSyncPrefs({ enabled: false })
        await ensureMemoryCloudSyncAlarm(false)
        await clearAuthValidationTimestamp()
        let wroteDisplacedNotice = false
        try {
          wroteDisplacedNotice = await maybeWriteExtensionDisplacedNotice(revalidated.reason)
        } catch (error) {
          logger.warn('Auth', '写 elsewhere 软条标记失败', error)
        }
        try {
          await ensureAuthSessionLeaseAlarm(false)
        } catch (error) {
          logger.warn('Auth', '会话作废退登清除租约探测闹钟失败', error)
        }
        session = null
        flowOk('Auth', 'GET_AUTH_STATE', startedAt, {
          signedIn: false,
          reason: 'revalidate_invalid',
          detail: revalidated.reason,
          wroteDisplacedNotice,
          openedLogin: false,
          releasedLibrary: true
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
    // ADR-018：禁止静默 absorb；未归属摘录由登录迁移门闸处理
    if (stillBound && session) {
      // 仅 token 可信时后台刷新订阅，避免 uncertain 用旧 access 刷 invalid_token
      if (authRevalidateStatus === 'valid' || authRevalidateStatus === 'skipped') {
        void refreshSubscriptionSnapshot().catch(() => undefined)
      }
    } else if (!stillBound || !session) {
      await clearSubscriptionSnapshot()
    }

    const signedIn = Boolean(stillBound && session)
    try {
      await ensureAuthSessionLeaseAlarm(signedIn)
    } catch (error) {
      logger.warn('Auth', '对齐租约探测闹钟失败', error)
    }

    flowOk('Auth', 'GET_AUTH_STATE', startedAt, {
      signedIn,
      syncEnabled: syncPrefs.enabled,
      hasAvatar: Boolean(session?.avatarUrl)
    })
    return {
      ok: true,
      signedIn,
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

/** SET_MCP_READ_ONLY：本机已由 Settings 写入；此处同步云端 KV 门禁。 */
export async function handleSetMcpReadOnly(enabled: boolean): Promise<SetMcpReadOnlyResponse> {
  const startedAt = flowStart('Mcp', 'SET_MCP_READ_ONLY', { enabled })
  try {
    const session = await getAuthSession()
    if (!session?.accessToken) {
      flowOk('Mcp', 'SET_MCP_READ_ONLY', startedAt, { reason: 'not_signed_in', enabled })
      // 未登录仅本机门禁；云端 MCP 不可用
      return { ok: true, enabled }
    }
    const remote = await putMcpReadOnlyRemote({
      accessToken: session.accessToken,
      enabled
    })
    if (!remote.ok) {
      flowFail('Mcp', 'SET_MCP_READ_ONLY', startedAt, new Error(remote.error))
      return { ok: false, errorCode: 'MCP_REMOTE_UPDATE_FAILED', error: remote.error }
    }
    flowOk('Mcp', 'SET_MCP_READ_ONLY', startedAt, { enabled })
    return { ok: true, enabled }
  } catch (error) {
    flowFail('Mcp', 'SET_MCP_READ_ONLY', startedAt, error)
    return {
      ok: false,
      errorCode: 'MCP_REMOTE_UPDATE_FAILED',
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

    // 开同步须有效 Pro（Normative：同步 = Pro + 登录 + 开关）
    if (enabled) {
      if (!(await isProActiveFromSnapshot())) {
        flowFail('MemorySync', 'SET_SYNC_ENABLED', startedAt, new Error('SYNC_PRO_REQUIRED'))
        return { ok: false, errorCode: 'SYNC_PRO_REQUIRED' }
      }
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
    const remoteParsed = parseCloudItems(remoteRaw)

    // status 显示有云端数据，但 pull/Zod 解析后为空 → 禁止继续（否则会用本机 5 条盖掉云）
    if (remoteStatus.remoteCount > 0 && remoteParsed.length === 0) {
      flowFail('MemorySync', 'SYNC_MERGE_LOCAL_REMOTE', startedAt, new Error('pull_empty_mismatch'))
      return {
        ok: false,
        errorCode: 'SYNC_MERGE_FAILED',
        error: 'pull_empty_mismatch'
      }
    }
    if (remoteRaw.length > 0 && remoteParsed.length < remoteRaw.length) {
      flowFail('MemorySync', 'SYNC_MERGE_LOCAL_REMOTE', startedAt, new Error('pull_parse_dropped'))
      return {
        ok: false,
        errorCode: 'SYNC_MERGE_FAILED',
        error: `pull_parse_dropped:${remoteRaw.length - remoteParsed.length}`
      }
    }

    // ADR-017：仅摘录参与云侧并集；本机 bookmark 保留在 merged 内但不出站
    const remoteItems = filterCloudSyncableMemoryItems(remoteParsed)
    const merged = mergeMemoryItemsByUpdatedAt(localItems, remoteItems, binding.accountId)
    if (merged.length < remoteItems.length || merged.length < localItems.length) {
      flowFail('MemorySync', 'SYNC_MERGE_LOCAL_REMOTE', startedAt, new Error('merge_shrunk'))
      return { ok: false, errorCode: 'SYNC_MERGE_FAILED', error: 'merge_shrunk' }
    }

    const outbound = filterCloudSyncableMemoryItems(merged)
    // 先盖云（ADR-017 允许相对历史 bookmark 缩量），成功后再写本机全集
    const result = await replaceRemoteWithLocalItems(token.accessToken, outbound, {
      allowDestructiveShrink: true
    })
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
    const remoteParsed = parseCloudItems(remoteRaw)

    // 全量 pull：status 有数但 Zod 解析为空 → 中止（防再演 454→5）；类型策略过滤不算解析失败
    if (!since) {
      const remoteStatus = await fetchRemoteSyncStatus(token.accessToken)
      if (remoteStatus.remoteCount > 0 && remoteParsed.length === 0) {
        flowFail('MemorySync', 'INCREMENTAL_SYNC', startedAt, new Error('pull_empty_mismatch'))
        return {
          ok: false,
          errorCode: 'SYNC_INCREMENTAL_FAILED',
          error: 'pull_empty_mismatch'
        }
      }
    }
    if (remoteRaw.length > 0 && remoteParsed.length < remoteRaw.length) {
      flowFail('MemorySync', 'INCREMENTAL_SYNC', startedAt, new Error('pull_parse_dropped'))
      return {
        ok: false,
        errorCode: 'SYNC_INCREMENTAL_FAILED',
        error: `pull_parse_dropped:${remoteRaw.length - remoteParsed.length}`
      }
    }

    const remoteItems = filterCloudSyncableMemoryItems(remoteParsed)
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
    const outbound = filterCloudSyncableMemoryItems(items)

    // 本机同步面为空时：云端有数 → 拒；两边皆空 → 跳过写云（无备份）
    if (outbound.length === 0) {
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

    // ADR-017：出站仅摘录；允许缩量摘除云端历史 bookmark
    const result = await replaceRemoteWithLocalItems(token.accessToken, outbound, {
      allowDestructiveShrink: true
    })
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

    await memoryItemRepository.remapOwnerId(profile.localProfileId, binding.accountId)
    const localItems = await memoryItemRepository.listAllByOwnerId(binding.accountId, {
      includeDeleted: true
    })
    const remoteRaw = await pullRemoteMemoryItems(token.accessToken)
    const remoteParsed = parseCloudItems(remoteRaw).map(item => ({
      ...item,
      ownerId: binding.accountId
    }))
    // ADR-017：只应用远程摘录；与本机并集以保留本机书签
    const remoteItems = filterCloudSyncableMemoryItems(remoteParsed)
    const merged = mergeMemoryItemsByUpdatedAt(localItems, remoteItems, binding.accountId)

    await memoryItemRepository.replaceOwnerItems(profile.localProfileId, [])
    const written = await memoryItemRepository.replaceOwnerItems(binding.accountId, merged)
    await patchSyncPrefs({
      enabled: true,
      lastPulledAt: new Date().toISOString()
    })

    flowOk('MemorySync', 'SYNC_REPLACE_WITH_REMOTE', startedAt, {
      written,
      remoteSyncable: remoteItems.length,
      remoteParsed: remoteParsed.length
    })
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

/** GET_LOGIN_MIGRATION_STATUS — 登录后是否须弹迁移门闸（ADR-018）。 */
export async function handleGetLoginMigrationStatus(): Promise<GetLoginMigrationStatusResponse> {
  const startedAt = flowStart('Identity', 'GET_LOGIN_MIGRATION_STATUS')
  try {
    const summary = await summarizeLoginMigrationForCurrentBinding()
    flowOk('Identity', 'GET_LOGIN_MIGRATION_STATUS', startedAt, {
      pending: summary.pending,
      excerptCount: summary.excerptCount
    })
    return {
      ok: true,
      pending: summary.pending,
      excerptCount: summary.excerptCount,
      sourceOwnerIds: summary.sourceOwnerIds,
      localBookmarkCount: summary.localBookmarkCount
    }
  } catch (error) {
    flowFail('Identity', 'GET_LOGIN_MIGRATION_STATUS', startedAt, error)
    return {
      ok: false,
      errorCode: 'LOGIN_MIGRATION_STATUS_FAILED',
      ...(error instanceof Error ? { error: error.message } : {})
    }
  }
}

/** RESOLVE_LOGIN_MIGRATION — Import / Export / Delete 三选一。 */
export async function handleResolveLoginMigration(
  action: LoginMigrationAction
): Promise<ResolveLoginMigrationResponse> {
  const startedAt = flowStart('Identity', 'RESOLVE_LOGIN_MIGRATION', { action })
  try {
    const binding = await getAccountBinding()
    if (!binding) {
      return { ok: false, errorCode: 'SYNC_NOT_AUTHENTICATED' }
    }
    const accountId = binding.accountId

    if (action === 'import') {
      const result = await importLoginMigration(accountId)
      flowOk('Identity', 'RESOLVE_LOGIN_MIGRATION', startedAt, { action, ...result })
      return { ok: true, action: 'import', ...result }
    }
    if (action === 'export') {
      const items = await exportLoginMigrationExcerpts(accountId)
      flowOk('Identity', 'RESOLVE_LOGIN_MIGRATION', startedAt, {
        action,
        itemCount: items.length
      })
      return { ok: true, action: 'export', items }
    }
    const deleted = await deleteLoginMigrationExcerpts(accountId)
    flowOk('Identity', 'RESOLVE_LOGIN_MIGRATION', startedAt, { action, ...deleted })
    return { ok: true, action: 'delete', ...deleted }
  } catch (error) {
    flowFail('Identity', 'RESOLVE_LOGIN_MIGRATION', startedAt, error)
    return {
      ok: false,
      errorCode: 'LOGIN_MIGRATION_FAILED',
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
    // 注销账号：本浏览器官网会话也应清掉（与普通「只退扩展」解耦不同）
    try {
      await openWebsiteLogoutFromExtension()
    } catch (error) {
      logger.warn('Privacy', '删除账号后打开官网 /logout 失败', error)
    }

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

/**
 * 清本机 Outcome 对 + TTE 环（A 层缓冲；不碰 Memory）。
 * CLEAR_LOCAL_MEMORY / CLEAR_LOCAL_RECALL_ADAPTATION 共用。
 */
async function clearLocalRecallAdaptationBuffers(): Promise<void> {
  await clearRecallOutcomePairs()
  await clearRecallTelemetryEvents()
}

/**
 * CLEAR_LOCAL_MEMORY — 硬清当前 owner 本机 Memory。
 * 不动 Chrome 原生书签；关书签灌库；若同步开着则关同步（云端副本需用户另删）；
 * 并清 Outcome 对 / TTE 环。
 */
export async function handleClearLocalMemory(): Promise<ClearLocalMemoryResponse> {
  const startedAt = flowStart('Data', 'CLEAR_LOCAL_MEMORY')
  try {
    const ownerId =
      (await getAccountBinding())?.accountId ?? (await getOrCreateLocalProfile()).localProfileId
    const existing = await memoryItemRepository.listAllByOwnerId(ownerId, {
      includeDeleted: true
    })
    const clearedCount = existing.length

    await memoryItemRepository.replaceOwnerItems(ownerId, [])
    await clearLocalRecallAdaptationBuffers()
    void bumpMemoryLibraryRevision().catch(error => {
      logger.warn('Data', '库修订信号更新失败', error)
    })

    await updateUserSettings({ chromeBookmarkIngestEnabled: false })
    await syncChromeBookmarkSyncListenersWithIngestSetting(false)
    // Memory 已空：抹掉 completed 导入进度，避免再开灌库时误以为已灌满
    await resetChromeBookmarkImportAfterLocalClear()

    const syncPrefs = await getSyncPrefs()
    let syncDisabled = false
    if (syncPrefs.enabled) {
      await patchSyncPrefs({ enabled: false })
      await ensureMemoryCloudSyncAlarm(false)
      syncDisabled = true
    }

    flowOk('Data', 'CLEAR_LOCAL_MEMORY', startedAt, {
      ownerId,
      clearedCount,
      syncDisabled
    })
    logger.info('Data', '已清除本机记忆（未改 Chrome 原生书签）', {
      ownerId,
      clearedCount,
      syncDisabled
    })
    return {
      ok: true,
      ownerId,
      clearedCount,
      bookmarkIngestDisabled: true,
      syncDisabled
    }
  } catch (error) {
    flowFail('Data', 'CLEAR_LOCAL_MEMORY', startedAt, error)
    return {
      ok: false,
      errorCode: 'LOCAL_CLEAR_FAILED',
      ...(error instanceof Error ? { error: error.message } : {})
    }
  }
}

/**
 * CLEAR_LOCAL_RECALL_ADAPTATION — 仅清 Outcome 对 + TTE 环，保留记忆库。
 */
export async function handleClearLocalRecallAdaptation(): Promise<ClearLocalRecallAdaptationResponse> {
  const startedAt = flowStart('Data', 'CLEAR_LOCAL_RECALL_ADAPTATION')
  try {
    await clearLocalRecallAdaptationBuffers()
    flowOk('Data', 'CLEAR_LOCAL_RECALL_ADAPTATION', startedAt, {
      outcomePairsCleared: true,
      telemetryCleared: true
    })
    logger.info('Data', '已清除本机 Recall 适应信号（未改记忆库）')
    return {
      ok: true,
      outcomePairsCleared: true,
      telemetryCleared: true
    }
  } catch (error) {
    flowFail('Data', 'CLEAR_LOCAL_RECALL_ADAPTATION', startedAt, error)
    return {
      ok: false,
      errorCode: 'LOCAL_RECALL_ADAPTATION_CLEAR_FAILED',
      ...(error instanceof Error ? { error: error.message } : {})
    }
  }
}

function buildSubscriptionUrls(accountId: string | null): {
  upgradeUrl: string | null
  manageUrl: string | null
} {
  return {
    upgradeUrl: accountId ? `${getWebsiteBaseUrl()}/pricing` : null,
    manageUrl: `${getWebsiteBaseUrl()}/account`
  }
}

/**
 * GET_SUBSCRIPTION_STATUS — 读本机订阅快照；无缓存或 refresh 时拉 Worker。
 */
export async function handleGetSubscriptionStatus(payload?: {
  refresh?: boolean
}): Promise<GetSubscriptionStatusResponse> {
  const startedAt = flowStart('Subscription', 'GET_SUBSCRIPTION_STATUS', {
    refresh: Boolean(payload?.refresh)
  })
  try {
    const binding = await getAccountBinding()
    let snapshot = await getSubscriptionSnapshot()
    if (!snapshot || payload?.refresh) {
      snapshot = await refreshSubscriptionSnapshot({ force: Boolean(payload?.refresh) })
    }
    const urls = buildSubscriptionUrls(binding?.accountId ?? null)
    flowOk('Subscription', 'GET_SUBSCRIPTION_STATUS', startedAt, {
      isPro: snapshot.isPro,
      tier: snapshot.tier
    })
    return {
      ok: true,
      snapshot,
      upgradeUrl: urls.upgradeUrl,
      manageUrl: urls.manageUrl
    }
  } catch (error) {
    flowFail('Subscription', 'GET_SUBSCRIPTION_STATUS', startedAt, error)
    return {
      ok: false,
      errorCode: 'SUBSCRIPTION_STATUS_FAILED',
      ...(error instanceof Error ? { error: error.message } : {})
    }
  }
}
