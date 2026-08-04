/**
 * 接收官网回传的登录 / 退出，写入或清理本地 binding（退出默认保留 Memory）。
 */

import { absorbLocalProfileIntoAccount } from '@/application/identity/absorb-local-profile-into-account'
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
import { clearAuthValidationTimestamp } from '@/infrastructure/auth/auth-session-revalidate'
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
 * 成功后 Settings / 顶栏可通过 GET_AUTH_STATE 看到已登录。
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
    await clearAuthValidationTimestamp()
    // 登录后立刻归并未登录期间的本地档，避免 Recall 只看见 accountId 桶而「隐身」
    const remapped = await absorbLocalProfileIntoAccount(session.userId)
    flowOk('Auth', '官网 session handoff', startedAt, {
      userId: session.userId,
      remappedLocalProfileItems: remapped
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
