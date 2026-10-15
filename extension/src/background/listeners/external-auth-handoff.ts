/**
 * 接收官网回传的登录 / 退出，写入或清理本地 binding。
 * 登录：不静默 absorb（ADR-018 门闸由 UI 处理）；退出：清账号桶痕迹（口径 A）。
 */

import { scheduleSilentMemoryEmbeddingMaintenance } from '@/application/memory/ensure-memory-embedding-maintenance'
import { clearAccountLibraryOnSignOut } from '@/application/identity/clear-account-library-on-sign-out'
import { ensureBackgroundBootstrapped } from '@/background/bootstrap-ready'
import { isExternallyConnectableOrigin } from '@/core/extension/externally-connectable-origins'
import {
  ExternalAuthHandoffMessageSchema,
  type ExternalAuthHandoffResponse
} from '@/core/identity/external-auth-handoff'
import {
  clearExtensionUninstallRevoke,
  registerExtensionUninstallRevoke
} from '@/infrastructure/auth/extension-uninstall-url'
import { mintWebsiteSessionFromExtensionAccess } from '@/infrastructure/auth/mint-website-session-from-extension'
import { readJwtSessionId } from '@/infrastructure/auth/read-jwt-session-id'
import { resolveWebsiteAuthProbeFromExternal } from '@/infrastructure/auth/website-auth-probe'
import {
  setAuthSession,
  clearAuthSession,
  getAuthSession
} from '@/infrastructure/identity/auth-session-service'
import {
  setAccountBinding,
  clearAccountBinding,
  getAccountBinding
} from '@/infrastructure/identity/local-profile-service'
import { patchSyncPrefs } from '@/infrastructure/identity/sync-prefs-service'
import {
  markAuthValidatedNow,
  clearAuthValidationTimestamp
} from '@/infrastructure/auth/auth-session-revalidate'
import { ensureAuthSessionLeaseAlarm } from '@/infrastructure/auth/auth-session-lease-alarm'
import { clearExtensionDisplacedNotice } from '@/infrastructure/storage/extension-displaced-notice-storage'
import {
  clearLastExtensionLeaseSessionId,
  isExtensionLeaseReclaimable,
  writeLastExtensionLeaseSessionId
} from '@/infrastructure/storage/last-extension-lease-session-storage'
import { flowFail, flowOk, flowStart } from '@/infrastructure/logging/flow-log'
import { logger } from '@/infrastructure/logging/logger'

let listenerRegistered = false

/** IDB / embedding 维护前须等 bootstrap（SW 禁止动态 import）。 */
async function ensureBootstrapReady(): Promise<void> {
  await ensureBackgroundBootstrapped()
}

/**
 * 应用官网登录 handoff 的 session。
 * 成功后写入 chrome.storage.local；UI 经 watchAuthSessionStorage 即时刷新并弹迁移门闸。
 */
export async function applyExternalAuthSessionHandoff(
  message: unknown
): Promise<ExternalAuthHandoffResponse> {
  const startedAt = flowStart('Auth', '官网 session handoff')
  const parsed = ExternalAuthHandoffMessageSchema.safeParse(message)
  if (!parsed.success || parsed.data.type !== 'YIVENO_AUTH_SESSION_HANDOFF') {
    flowFail('Auth', '官网 session handoff', startedAt, new Error('invalid_handoff_payload'))
    return { ok: false, error: 'invalid_handoff_payload' }
  }

  try {
    const { uninstallRevokeToken, ...session } = parsed.data.payload
    await setAuthSession(session)
    await setAccountBinding({
      accountId: session.userId,
      boundAt: new Date().toISOString()
    })
    // 记录本机 lease session_id（同机 Connect 认领孤儿租约；失败不阻断登录）
    const leaseSessionId = readJwtSessionId(session.accessToken)
    if (leaseSessionId) {
      try {
        await writeLastExtensionLeaseSessionId(leaseSessionId)
      } catch (error) {
        logger.warn('Auth', 'handoff 后写 lastLeaseSessionId 失败', error)
      }
    } else {
      logger.warn('Auth', 'handoff access token 无 session_id，跳过 lastLease 记录')
    }
    // 登记卸载 URL（best-effort；失败不阻断登录）
    await registerExtensionUninstallRevoke(uninstallRevokeToken)
    // 刚写入的 token 视为有效，避免立刻 refresh 与官网抢 refresh_token 被踢成未登录
    await markAuthValidatedNow()
    try {
      await clearExtensionDisplacedNotice()
    } catch (error) {
      logger.warn('Auth', 'handoff 后清除被挤掉软条标记失败', error)
    }
    try {
      await ensureAuthSessionLeaseAlarm(true)
    } catch (error) {
      logger.warn('Auth', 'handoff 后挂载租约探测闹钟失败', error)
    }
    // ADR-018：禁止静默 absorb；仅调度 embedding 维护（门闸由 Settings / Side Panel 弹）
    void ensureBootstrapReady()
      .then(() => {
        scheduleSilentMemoryEmbeddingMaintenance('auth_handoff', 800)
        flowOk('Auth', '官网 session handoff embedding 调度', startedAt, {
          userId: session.userId
        })
      })
      .catch(error => {
        flowFail('Auth', '官网 session handoff embedding 调度', startedAt, error, {
          userId: session.userId
        })
      })
    flowOk('Auth', '官网 session handoff', startedAt, {
      userId: session.userId,
      absorbDeferred: false,
      loginMigrationPendingUi: true,
      embeddingMaintenanceScheduled: true
    })
    return { ok: true }
  } catch (error) {
    flowFail('Auth', '官网 session handoff', startedAt, error)
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'handoff_failed'
    }
  }
}

/**
 * 遗留：旧官网页仍可能发 SIGN_OUT_HANDOFF。新产品路径官网退出不踢扩展；
 * 若收到则仍 keep_local 清扩展（兼容缓存页），并尽力释放远程租约。
 */
export async function applyExternalAuthSignOutHandoff(
  message: unknown
): Promise<ExternalAuthHandoffResponse> {
  const startedAt = flowStart('Auth', '官网 sign-out handoff（遗留）')
  const parsed = ExternalAuthHandoffMessageSchema.safeParse(message)
  if (!parsed.success || parsed.data.type !== 'YIVENO_AUTH_SIGN_OUT_HANDOFF') {
    flowFail('Auth', '官网 sign-out handoff', startedAt, new Error('invalid_sign_out_handoff'))
    return { ok: false, error: 'invalid_sign_out_handoff' }
  }

  try {
    const binding = await getAccountBinding()
    if (binding) {
      try {
        await ensureBootstrapReady()
        await clearAccountLibraryOnSignOut(binding.accountId)
      } catch (error) {
        logger.warn('Auth', '官网退出 handoff 清账号桶失败', error)
      }
    }
    // 官网退出：扩展 keep_local（口径 A 清账号桶）；销远程会话并清 revoke token
    const remoteReleased = await clearExtensionUninstallRevoke({ revokeRemote: true })
    // 远程租约已释放才清 lastLease；失败保留以便同机 Connect 静默认领
    if (remoteReleased) {
      try {
        await clearLastExtensionLeaseSessionId()
      } catch (error) {
        logger.warn('Auth', '官网退出后清 lastLeaseSessionId 失败', error)
      }
    }
    await clearAuthSession()
    await clearAccountBinding()
    await patchSyncPrefs({ enabled: false })
    await clearAuthValidationTimestamp()
    try {
      await ensureAuthSessionLeaseAlarm(false)
    } catch (error) {
      logger.warn('Auth', '官网退出后清除租约探测闹钟失败', error)
    }
    flowOk('Auth', '官网 sign-out handoff', startedAt, {
      reason: parsed.data.payload?.reason ?? 'website_sign_out',
      clearedAccountLibrary: Boolean(binding),
      remoteLeaseReleased: remoteReleased
    })
    return { ok: true }
  } catch (error) {
    flowFail('Auth', '官网 sign-out handoff', startedAt, error)
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'sign_out_handoff_failed'
    }
  }
}

/**
 * 官网询问：本机扩展是否已有登录态（只读；不 mint、不改存储）。
 */
export async function applyExtensionAuthStatusProbe(
  message: unknown
): Promise<ExternalAuthHandoffResponse> {
  const parsed = ExternalAuthHandoffMessageSchema.safeParse(message)
  if (!parsed.success || parsed.data.type !== 'YIVENO_EXTENSION_AUTH_STATUS_PROBE') {
    return { ok: false, error: 'invalid_status_probe' }
  }
  try {
    const session = await getAuthSession()
    const userId = session?.userId?.trim()
    if (!userId) {
      return { ok: true, signedIn: false }
    }
    return { ok: true, signedIn: true, userId }
  } catch (error) {
    logger.warn('Auth', '扩展登录态探测失败', error)
    return { ok: false, error: 'status_probe_failed' }
  }
}

/**
 * 官网请求：用扩展登录态铸官网会话（反向接通）。
 */
export async function applyWebsiteSessionRequest(
  message: unknown
): Promise<ExternalAuthHandoffResponse> {
  const parsed = ExternalAuthHandoffMessageSchema.safeParse(message)
  if (!parsed.success || parsed.data.type !== 'YIVENO_WEBSITE_SESSION_REQUEST') {
    return { ok: false, error: 'invalid_website_session_request' }
  }
  const minted = await mintWebsiteSessionFromExtensionAccess()
  if (!minted) {
    return { ok: false, error: 'website_session_mint_failed' }
  }
  return {
    ok: true,
    accessToken: minted.accessToken,
    refreshToken: minted.refreshToken,
    userId: minted.userId,
    ...(minted.email ? { email: minted.email } : {}),
    ...(minted.expiresAt != null ? { expiresAt: minted.expiresAt } : {})
  }
}

/**
 * 官网询问：409 租约是否为本机上次 handoff 的孤儿会话（可静默 confirmDisplace）。
 * 已登录 → 不可认领（应由 STATUS_PROBE 短路）；无匹配 lastLease → 真他端，须弹窗。
 */
export async function applyExtensionLeaseReclaimProbe(
  message: unknown
): Promise<ExternalAuthHandoffResponse> {
  const parsed = ExternalAuthHandoffMessageSchema.safeParse(message)
  if (!parsed.success || parsed.data.type !== 'YIVENO_EXTENSION_LEASE_RECLAIM_PROBE') {
    return { ok: false, error: 'invalid_reclaim_probe' }
  }
  try {
    const session = await getAuthSession()
    if (session?.userId?.trim()) {
      return { ok: true, reclaimable: false, signedIn: true, userId: session.userId.trim() }
    }
    const reclaimable = await isExtensionLeaseReclaimable(parsed.data.payload.existingSessionId)
    logger.info('Auth', '扩展租约认领探测', {
      reclaimable,
      existingSessionIdPreview: parsed.data.payload.existingSessionId.trim().slice(0, 8)
    })
    return { ok: true, reclaimable, signedIn: false }
  } catch (error) {
    logger.warn('Auth', '扩展租约认领探测失败', error)
    return { ok: false, error: 'reclaim_probe_failed' }
  }
}

/** 按 type 分发官网 external 消息。 */
export async function applyExternalAuthHandoff(
  message: unknown
): Promise<ExternalAuthHandoffResponse> {
  const parsed = ExternalAuthHandoffMessageSchema.safeParse(message)
  if (!parsed.success) {
    return { ok: false, error: 'invalid_handoff_payload' }
  }
  if (parsed.data.type === 'YIVENO_WEBSITE_AUTH_PROBE') {
    const handled = resolveWebsiteAuthProbeFromExternal(message)
    return handled ? { ok: true } : { ok: false, error: 'probe_not_waiting' }
  }
  if (parsed.data.type === 'YIVENO_EXTENSION_AUTH_STATUS_PROBE') {
    return applyExtensionAuthStatusProbe(message)
  }
  if (parsed.data.type === 'YIVENO_EXTENSION_LEASE_RECLAIM_PROBE') {
    return applyExtensionLeaseReclaimProbe(message)
  }
  if (parsed.data.type === 'YIVENO_WEBSITE_SESSION_REQUEST') {
    return applyWebsiteSessionRequest(message)
  }
  if (parsed.data.type === 'YIVENO_AUTH_SIGN_OUT_HANDOFF') {
    return applyExternalAuthSignOutHandoff(message)
  }
  return applyExternalAuthSessionHandoff(message)
}

/** 注册 chrome.runtime.onMessageExternal。 */
export function registerExternalAuthHandoffListener(): void {
  if (listenerRegistered) {
    return
  }
  listenerRegistered = true

  chrome.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
    if (!isExternallyConnectableOrigin(sender.url)) {
      logger.warn('Auth', '拒绝非官网来源的 external 消息', {
        url: sender.url ?? null
      })
      sendResponse({ ok: false, error: 'forbidden_origin' })
      return false
    }

    void applyExternalAuthHandoff(message).then(sendResponse)
    return true
  })
}

/** 当前是否已挂上 external handoff 监听（测试 / 诊断用）。 */
export function isExternalAuthHandoffListenerRegistered(): boolean {
  return listenerRegistered
}

/** 测试用：重置监听器注册状态（不调用 Chrome remove，需配合 mock）。 */
export function resetExternalAuthHandoffListenerForTests(): void {
  listenerRegistered = false
}
