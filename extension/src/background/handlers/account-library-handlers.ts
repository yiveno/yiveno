/**
 * 账户库维护 / 迁移 / 隐私 / 订阅 Background handlers（从 account-sync-handler 机械抽出）。
 */

import {
  deleteLoginMigrationExcerpts,
  exportLoginMigrationExcerpts,
  importLoginMigration,
  summarizeLoginMigrationForCurrentBinding
} from '@/application/identity/login-migration'
import {
  clearOrphanOwnerBuckets,
  exportOrphanOwnerBuckets
} from '@/application/identity/orphan-owner-buckets'
import { resetChromeBookmarkImportAfterLocalClear } from '@/application/capture/import-chrome-bookmarks-service'
import type {
  ClearLocalMemoryResponse,
  ClearLocalRecallAdaptationResponse,
  ClearOrphanOwnersResponse,
  DeleteAccountResponse,
  DeleteCloudMemoryResponse,
  ExportLocalMemoryResponse,
  ExportOrphanOwnersResponse,
  GetLoginMigrationStatusResponse,
  LoginMigrationAction,
  ResolveLoginMigrationResponse,
  GetSubscriptionStatusResponse,
  AckPrivacyNoticeResponse
} from '@/core/messaging/account-sync-messages'

import {
  getAccountBinding,
  getOrCreateLocalProfile
} from '@/infrastructure/identity/local-profile-service'
import { getSyncPrefs, patchSyncPrefs } from '@/infrastructure/identity/sync-prefs-service'
import {
  getSubscriptionSnapshot,
  refreshSubscriptionSnapshot
} from '@/infrastructure/identity/subscription-service'
import { updateUserSettings } from '@/infrastructure/settings/user-settings-service'
import { bumpMemoryLibraryRevision } from '@/infrastructure/storage/memory-library-revision-storage'
import { syncChromeBookmarkSyncListenersWithIngestSetting } from '@/background/listeners/chrome-bookmark-sync'
import {
  ackCurrentPrivacyNotice,
  clearPrivacyPrefs
} from '@/infrastructure/identity/privacy-prefs-service'
import { memoryItemRepository } from '@/infrastructure/indexeddb/memory-item-repository'
import { flowFail, flowOk, flowStart } from '@/infrastructure/logging/flow-log'
import { logger } from '@/infrastructure/logging/logger'
import {
  getWebsiteBaseUrl,
  openWebsiteLogoutFromExtension
} from '@/infrastructure/browser/website-page'

import {
  deleteRemoteAccount,
  deleteRemoteCloudMemory
} from '@/infrastructure/messaging/memory-sync-api-client'
import { ensureMemoryCloudSyncAlarm } from '@/infrastructure/sync/memory-cloud-sync-alarm'
import {
  clearLocalRecallAdaptationBuffers,
  finishSignOutSession,
  requireAccessToken
} from '@/background/handlers/account-sync-shared'

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
