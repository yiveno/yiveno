/**
 * 官网 → Chrome 扩展登录会话回传。
 * 依赖扩展 manifest externally_connectable；页面通过 chrome.runtime.sendMessage(extensionId, …)。
 */

const STORAGE_EXTENSION_ID = 'yiveno_connect_extension_id'
const STORAGE_CONNECT_FLAG = 'yiveno_connect_extension'

export interface ExtensionHandoffSession {
  accessToken: string
  refreshToken: string
  userId: string
  email?: string
  expiresAt?: number
  avatarUrl?: string
  displayName?: string
}

/** 读取非空字符串。 */
function readNonEmptyString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined
}

/**
 * 从 Supabase user_metadata 提取头像 / 展示名（Google: avatar_url | picture）。
 */
export function extractProfileFromUserMetadata(
  metadata: Record<string, unknown> | null | undefined
): { avatarUrl?: string; displayName?: string } {
  if (!metadata) {
    return {}
  }
  const avatarUrl =
    readNonEmptyString(metadata.avatar_url) ??
    readNonEmptyString(metadata.picture) ??
    readNonEmptyString(metadata.avatarUrl)
  const displayName =
    readNonEmptyString(metadata.name) ??
    readNonEmptyString(metadata.full_name) ??
    readNonEmptyString(metadata.display_name) ??
    readNonEmptyString(metadata.displayName)
  return {
    ...(avatarUrl ? { avatarUrl } : {}),
    ...(displayName ? { displayName } : {})
  }
}

/** 从当前 URL 读取并持久化 connect 参数（OAuth 跳转后仍可用）。 */
export function captureExtensionConnectParamsFromUrl(
  search: string = window.location.search
): void {
  const params = new URLSearchParams(search)
  const connect = params.get('connect_extension')
  const extensionId = params.get('extension_id')?.trim()
  if (connect === '1' && extensionId) {
    sessionStorage.setItem(STORAGE_CONNECT_FLAG, '1')
    sessionStorage.setItem(STORAGE_EXTENSION_ID, extensionId)
  }
}

export function clearExtensionConnectParams(): void {
  sessionStorage.removeItem(STORAGE_CONNECT_FLAG)
  sessionStorage.removeItem(STORAGE_EXTENSION_ID)
}

export function getPendingExtensionId(): string | null {
  if (sessionStorage.getItem(STORAGE_CONNECT_FLAG) !== '1') {
    return null
  }
  return sessionStorage.getItem(STORAGE_EXTENSION_ID)
}

type ChromeRuntimeMessenger = {
  sendMessage: (
    extensionId: string,
    message: unknown,
    responseCallback?: (response: unknown) => void
  ) => void
  lastError?: { message?: string }
}

function getChromeRuntime(): ChromeRuntimeMessenger | null {
  const chromeApi = (globalThis as { chrome?: { runtime?: ChromeRuntimeMessenger } }).chrome
  return chromeApi?.runtime ?? null
}

/**
 * 将当前 Supabase session 回传扩展。
 * @returns true 表示扩展确认 ok
 */
export function handoffSessionToExtension(session: ExtensionHandoffSession): Promise<boolean> {
  const extensionId = getPendingExtensionId()
  const runtime = getChromeRuntime()
  if (!extensionId || !runtime?.sendMessage) {
    return Promise.resolve(false)
  }

  const message = {
    type: 'YIVENO_AUTH_SESSION_HANDOFF',
    payload: {
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
      userId: session.userId,
      ...(session.email ? { email: session.email } : {}),
      ...(session.expiresAt != null ? { expiresAt: session.expiresAt } : {}),
      ...(session.avatarUrl ? { avatarUrl: session.avatarUrl } : {}),
      ...(session.displayName ? { displayName: session.displayName } : {})
    }
  }

  return new Promise(resolve => {
    try {
      runtime.sendMessage(extensionId, message, response => {
        const err = runtime.lastError
        if (err) {
          console.warn('[ExtensionHandoff] sendMessage lastError', err.message)
          resolve(false)
          return
        }
        const ok =
          typeof response === 'object' &&
          response !== null &&
          'ok' in response &&
          (response as { ok: unknown }).ok === true
        if (ok) {
          clearExtensionConnectParams()
        }
        resolve(ok)
      })
    } catch (error) {
      console.warn('[ExtensionHandoff] sendMessage failed', error)
      resolve(false)
    }
  })
}
