/**
 * 接收官网回传的 device handoff / 探测 / 反向接通请求。
 * device 写入：不静默 absorb（ADR-018 门闸由 UI 处理）。
 */

import { scheduleSilentMemoryEmbeddingMaintenance } from '@/application/memory/ensure-memory-embedding-maintenance'
import { ensureBackgroundBootstrapped } from '@/background/bootstrap-ready'
import { isExternallyConnectableOrigin } from '@/core/extension/externally-connectable-origins'
import {
  ExternalAuthHandoffMessageSchema,
  type ExternalAuthHandoffResponse
} from '@/core/identity/external-auth-handoff'
import { deviceSessionFromRegisterData } from '@/infrastructure/auth/device-register-api-client'
import { registerExtensionUninstallRevoke } from '@/infrastructure/auth/extension-uninstall-url'
import { requestWebsiteSessionFromExtension } from '@/infrastructure/auth/website-session-from-extension'
import { resolveWebsiteAuthProbeFromExternal } from '@/infrastructure/auth/website-auth-probe'
import { clearAnonExchange401Backoff } from '@/infrastructure/identity/anon-exchange-401-backoff-service'
import { clearAuthSession, getAuthSession } from '@/infrastructure/identity/auth-session-service'
import {
  getDeviceSession,
  setDeviceSession
} from '@/infrastructure/identity/device-session-service'
import {
  setAccountBinding,
  getAccountBinding
} from '@/infrastructure/identity/local-profile-service'
import { markAuthValidatedNow } from '@/infrastructure/auth/auth-session-revalidate'
import { maskDeviceTokenForLog } from '@/core/identity/device-session'
import { flowFail, flowOk, flowStart } from '@/infrastructure/logging/flow-log'
import { logger } from '@/infrastructure/logging/logger'

let listenerRegistered = false

/** IDB / embedding 维护前须等 bootstrap（SW 禁止动态 import）。 */
async function ensureBootstrapReady(): Promise<void> {
  await ensureBackgroundBootstrapped()
}

/**
 * 应用官网 Connect 回传的 device token。
 * 写入 `yiveno:device_session` + AccountBinding；UI 经 watchAuthSessionStorage 刷新并弹迁移门闸。
 * 同账号：只覆盖 token，不改 binding（幂等、不重弹门）。
 * 不同账号：拒绝覆盖（官网侧亦会 STATUS_PROBE 拦下）。
 */
export async function applyExternalAuthDeviceHandoff(
  message: unknown
): Promise<ExternalAuthHandoffResponse> {
  const startedAt = flowStart('Auth', '官网 device handoff')
  const parsed = ExternalAuthHandoffMessageSchema.safeParse(message)
  if (!parsed.success || parsed.data.type !== 'YIVENO_AUTH_DEVICE_HANDOFF') {
    flowFail('Auth', '官网 device handoff', startedAt, new Error('invalid_handoff_payload'))
    return { ok: false, error: 'invalid_handoff_payload' }
  }

  try {
    const { uninstallRevokeToken, ...registerFields } = parsed.data.payload
    const incomingUserId = registerFields.userId

    const existingDevice = await getDeviceSession()
    const existingBinding = await getAccountBinding()
    const existingUserId =
      existingDevice?.userId?.trim() || existingBinding?.accountId?.trim() || ''

    if (existingUserId && existingUserId !== incomingUserId) {
      logger.warn('Auth', 'device handoff 拒绝覆盖其它账号', {
        existingUserId,
        incomingUserId
      })
      flowFail('Auth', '官网 device handoff', startedAt, new Error('account_mismatch'), {
        existingUserId,
        incomingUserId
      })
      return { ok: false, error: 'account_mismatch' }
    }

    const sameAccount = Boolean(existingUserId && existingUserId === incomingUserId)
    const deviceSession = deviceSessionFromRegisterData({
      deviceToken: registerFields.deviceToken,
      deviceId: registerFields.deviceId,
      userId: registerFields.userId,
      isAnonymous: registerFields.isAnonymous,
      email: registerFields.email ?? null,
      displayName: registerFields.displayName ?? null,
      avatarUrl: registerFields.avatarUrl ?? null
    })
    await setDeviceSession(deviceSession)
    // 迁出旧 Supabase 会话键，避免双凭证
    await clearAuthSession()
    // AN2.1：device 已建立则清匿名 401 熔断（best-effort；失败不得拖垮 handoff / 触发官网回滚）
    void clearAnonExchange401Backoff().catch(() => undefined)

    if (!sameAccount) {
      await setAccountBinding({
        accountId: incomingUserId,
        boundAt: new Date().toISOString()
      })
    }

    if (uninstallRevokeToken) {
      await registerExtensionUninstallRevoke(uninstallRevokeToken)
    }
    await markAuthValidatedNow()

    if (!sameAccount) {
      // ADR-018：禁止静默 absorb；门闸由 Settings / Side Panel 在 binding 变更后弹
      void ensureBootstrapReady()
        .then(() => {
          scheduleSilentMemoryEmbeddingMaintenance('auth_handoff', 800)
          flowOk('Auth', '官网 device handoff embedding 调度', startedAt, {
            userId: incomingUserId
          })
        })
        .catch(error => {
          flowFail('Auth', '官网 device handoff embedding 调度', startedAt, error, {
            userId: incomingUserId
          })
        })
    }

    flowOk('Auth', '官网 device handoff', startedAt, {
      userId: incomingUserId,
      deviceId: registerFields.deviceId,
      tokenSuffix: maskDeviceTokenForLog(registerFields.deviceToken),
      sameAccount,
      absorbDeferred: false,
      loginMigrationPendingUi: !sameAccount
    })
    return { ok: true }
  } catch (error) {
    flowFail('Auth', '官网 device handoff', startedAt, error)
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'handoff_failed'
    }
  }
}

/**
 * 官网询问：本机扩展是否已有登录态（只读；不改存储）。
 * 优先 device session；迁移窗回退旧 auth_session。
 */
export async function applyExtensionAuthStatusProbe(
  message: unknown
): Promise<ExternalAuthHandoffResponse> {
  const parsed = ExternalAuthHandoffMessageSchema.safeParse(message)
  if (!parsed.success || parsed.data.type !== 'YIVENO_EXTENSION_AUTH_STATUS_PROBE') {
    return { ok: false, error: 'invalid_status_probe' }
  }
  try {
    const device = await getDeviceSession()
    if (device?.userId?.trim()) {
      return {
        ok: true,
        signedIn: true,
        userId: device.userId.trim(),
        ...(device.email?.trim() ? { email: device.email.trim() } : {}),
        ...(device.displayName?.trim() ? { displayName: device.displayName.trim() } : {})
      }
    }
    const session = await getAuthSession()
    const userId = session?.userId?.trim()
    if (!session || !userId) {
      return { ok: true, signedIn: false }
    }
    return {
      ok: true,
      signedIn: true,
      userId,
      ...(session.email?.trim() ? { email: session.email.trim() } : {}),
      ...(session.displayName?.trim() ? { displayName: session.displayName.trim() } : {})
    }
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
  const issued = await requestWebsiteSessionFromExtension()
  if (issued.status === 'email_required') {
    return { ok: false, error: 'email_required' }
  }
  if (issued.status !== 'ok') {
    return {
      ok: false,
      error: issued.status === 'not_signed_in' ? 'not_signed_in' : issued.error
    }
  }
  return {
    ok: true,
    accessToken: issued.session.accessToken,
    refreshToken: issued.session.refreshToken,
    userId: issued.session.userId,
    ...(issued.session.email ? { email: issued.session.email } : {}),
    ...(issued.session.expiresAt != null ? { expiresAt: issued.session.expiresAt } : {})
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
  if (parsed.data.type === 'YIVENO_WEBSITE_SESSION_REQUEST') {
    return applyWebsiteSessionRequest(message)
  }
  return applyExternalAuthDeviceHandoff(message)
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
