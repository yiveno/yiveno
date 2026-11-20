/**
 * 官网已登录时：用本浏览器会话 mint+handoff 接到扩展。
 * 供 UI 桥零导航 Connect 与 `/account?connect_extension=1` 共用。
 */

import { getSession } from './auth'
import {
  clearExtensionConnectParams,
  extractProfileFromUserMetadata,
  registerAndHandoffDeviceToExtension,
  primeExtensionConnectPending
} from './extension-auth-handoff'
import { publishWebsiteConnectAck, publishWebsiteConnectResult } from './ui-bridge'

export type ExtensionConnectStatus = 'ok' | 'failed' | 'account_mismatch' | 'no_session' | 'busy'

let connectInFlight = false

/**
 * 执行一次 Connect（不踢官网会话；取消挤掉只清 pending）。
 * @param extensionId chrome.runtime.id
 * @param options.announceViaBridge 是否经 Port 发 ack/result（URL 回退路径可 false，扩展靠 handoff）
 */
export async function runExtensionConnectFromWebsite(
  extensionId: string,
  options: { announceViaBridge?: boolean } = {}
): Promise<ExtensionConnectStatus> {
  const announce = options.announceViaBridge !== false
  const trimmed = extensionId.trim()
  if (!trimmed) {
    if (announce) {
      publishWebsiteConnectResult('failed')
    }
    return 'failed'
  }

  if (connectInFlight) {
    if (announce) {
      publishWebsiteConnectAck()
      publishWebsiteConnectResult('busy')
    }
    return 'busy'
  }

  connectInFlight = true
  try {
    if (announce) {
      publishWebsiteConnectAck()
    }
    primeExtensionConnectPending(trimmed)

    const session = await getSession()
    if (!session?.access_token || !session.user?.id) {
      clearExtensionConnectParams()
      if (announce) {
        publishWebsiteConnectResult('no_session')
      }
      return 'no_session'
    }

    const profile = extractProfileFromUserMetadata(
      session.user.user_metadata as Record<string, unknown> | undefined
    )
    const result = await registerAndHandoffDeviceToExtension({
      websiteAccessToken: session.access_token,
      userId: session.user.id,
      ...(session.user.email ? { email: session.user.email } : {}),
      ...profile
    })

    if (result.status === 'account_mismatch') {
      clearExtensionConnectParams()
      if (announce) {
        publishWebsiteConnectResult('account_mismatch')
      }
      return 'account_mismatch'
    }

    if (result.status !== 'ok') {
      clearExtensionConnectParams()
      if (announce) {
        publishWebsiteConnectResult('failed')
      }
      return 'failed'
    }

    if (announce) {
      publishWebsiteConnectResult('ok')
    }
    return 'ok'
  } catch (error) {
    console.warn('[ExtensionConnect] 运行失败', error)
    clearExtensionConnectParams()
    if (announce) {
      publishWebsiteConnectResult('failed')
    }
    return 'failed'
  } finally {
    connectInFlight = false
  }
}
