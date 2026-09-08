/**
 * 接收官网回传的登录 / 退出，写入或清理本地 binding（退出默认保留 Memory）。
 */

import { absorbLocalProfileIntoAccount } from '@/application/identity/absorb-local-profile-into-account'
import { scheduleSilentMemoryEmbeddingMaintenance } from '@/application/memory/ensure-memory-embedding-maintenance'
import { ensureBackgroundBootstrapped } from '@/background/bootstrap-ready'
import { isExternallyConnectableOrigin } from '@/core/extension/externally-connectable-origins'
import {
  ExternalAuthHandoffMessageSchema,
  type ExternalAuthHandoffResponse
} from '@/core/identity/external-auth-handoff'
import { setAuthSession, clearAuthSession } from '@/infrastructure/identity/auth-session-service'
import {
  setAccountBinding,
  clearAccountBinding
} from '@/infrastructure/identity/local-profile-service'
import { patchSyncPrefs } from '@/infrastructure/identity/sync-prefs-service'
import {
  markAuthValidatedNow,
  clearAuthValidationTimestamp
} from '@/infrastructure/auth/auth-session-revalidate'
import { flowFail, flowOk, flowStart } from '@/infrastructure/logging/flow-log'
import { logger } from '@/infrastructure/logging/logger'

let listenerRegistered = false

/** IDB 归并 / embedding 维护前须等 bootstrap（SW 禁止动态 import）。 */
async function ensureBootstrapReady(): Promise<void> {
  await ensureBackgroundBootstrapped()
}

/**
 * 应用官网登录 handoff 的 session。
 * 成功后写入 chrome.storage.local；UI 经 watchAuthSessionStorage 即时刷新。
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
    const session = parsed.data.payload
    await setAuthSession(session)
    await setAccountBinding({
      accountId: session.userId,
      boundAt: new Date().toISOString()
    })
    // 刚写入的 token 视为有效，避免立刻 refresh 与官网抢 refresh_token 被踢成未登录
    await markAuthValidatedNow()
    // 归并不阻塞官网 sendMessage：全库 remap 可能很慢，否则「Connecting to the extension…」会卡住。
    void ensureBootstrapReady()
      .then(() => absorbLocalProfileIntoAccount(session.userId))
      .then(remapped => {
        scheduleSilentMemoryEmbeddingMaintenance('auth_handoff', 800)
        flowOk('Auth', '官网 session handoff 本地档归并', startedAt, {
          userId: session.userId,
          remappedLocalProfileItems: remapped
        })
      })
      .catch(error => {
        flowFail('Auth', '官网 session handoff 本地档归并', startedAt, error, {
          userId: session.userId
        })
      })
    flowOk('Auth', '官网 session handoff', startedAt, {
      userId: session.userId,
      absorbDeferred: true,
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
 * 官网已退出：扩展清 session/binding，关同步开关，保留本地 Memory（等同 keep_local）。
 */
export async function applyExternalAuthSignOutHandoff(
  message: unknown
): Promise<ExternalAuthHandoffResponse> {
  const startedAt = flowStart('Auth', '官网 sign-out handoff')
  const parsed = ExternalAuthHandoffMessageSchema.safeParse(message)
  if (!parsed.success || parsed.data.type !== 'YIVENO_AUTH_SIGN_OUT_HANDOFF') {
    flowFail('Auth', '官网 sign-out handoff', startedAt, new Error('invalid_sign_out_handoff'))
    return { ok: false, error: 'invalid_sign_out_handoff' }
  }

  try {
    await clearAuthSession()
    await clearAccountBinding()
    await patchSyncPrefs({ enabled: false })
    await clearAuthValidationTimestamp()
    flowOk('Auth', '官网 sign-out handoff', startedAt, {
      reason: parsed.data.payload?.reason ?? 'website_sign_out'
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

/** 按 type 分发官网 external 消息。 */
export async function applyExternalAuthHandoff(
  message: unknown
): Promise<ExternalAuthHandoffResponse> {
  const parsed = ExternalAuthHandoffMessageSchema.safeParse(message)
  if (!parsed.success) {
    return { ok: false, error: 'invalid_handoff_payload' }
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
