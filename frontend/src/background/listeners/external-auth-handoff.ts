/**
 * 接收官网回传的登录 / 退出，写入或清理本地 binding（退出默认保留 Memory）。
 */

import { absorbLocalProfileIntoAccount } from '@/application/identity/absorb-local-profile-into-account'
import { scheduleSilentMemoryEmbeddingMaintenance } from '@/application/memory/ensure-memory-embedding-maintenance'
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

/** 允许回传的官网来源（与 manifest externally_connectable 对齐）。 */
function isAllowedExternalSender(url: string | undefined): boolean {
  if (!url) {
    return false
  }
  try {
    const { origin } = new URL(url)
    return (
      origin === 'https://yiveno.com' ||
      origin === 'https://www.yiveno.com' ||
      origin === 'http://localhost:3001' ||
      origin === 'https://localhost:3001' ||
      origin === 'http://localhost:3002' ||
      origin === 'https://localhost:3002'
    )
  } catch {
    return false
  }
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
    void absorbLocalProfileIntoAccount(session.userId)
      .then(remapped => {
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
    // Hybrid 依赖存量 embedding；不阻塞官网 sendMessage。无感维护（摘录优先）。
    scheduleSilentMemoryEmbeddingMaintenance('auth_handoff', 800)
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
  chrome.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
    if (!isAllowedExternalSender(sender.url)) {
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
