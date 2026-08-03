/**
 * 接收官网回传的 Supabase session，写入本地 binding（不同步记忆）。
 */

import {
  ExternalAuthSessionHandoffSchema,
  type ExternalAuthHandoffResponse
} from '@/core/identity/external-auth-handoff'
import { setAuthSession } from '@/infrastructure/identity/auth-session-service'
import { setAccountBinding } from '@/infrastructure/identity/local-profile-service'
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
 * 应用官网 handoff 的 session。
 * 成功后 Settings 可通过 GET_AUTH_STATE 看到已登录。
 */
export async function applyExternalAuthSessionHandoff(
  message: unknown
): Promise<ExternalAuthHandoffResponse> {
  const startedAt = flowStart('Auth', '官网 session handoff')
  const parsed = ExternalAuthSessionHandoffSchema.safeParse(message)
  if (!parsed.success) {
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
    flowOk('Auth', '官网 session handoff', startedAt, { userId: session.userId })
    return { ok: true }
  } catch (error) {
    flowFail('Auth', '官网 session handoff', startedAt, error)
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'handoff_failed'
    }
  }
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

    void applyExternalAuthSessionHandoff(message).then(sendResponse)
    return true
  })
}
