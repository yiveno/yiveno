/**
 * 官网 → Chrome 扩展登录 / 退出会话回传。
 * 依赖扩展 manifest externally_connectable；页面通过 chrome.runtime.sendMessage(extensionId, …)。
 *
 * 登录 handoff：必须先 Worker mint 扩展独立 session，再回传；禁止把官网 refresh 直接递给扩展。
 */

import { signOut } from './auth'
import { mintExtensionSession } from './mint-extension-session'

/** mint + handoff 结果（cancelled_displace 保留类型兼容；Connect 路径不再二次弹窗） */
export type MintAndHandoffResult =
  { status: 'ok' } | { status: 'cancelled_displace' } | { status: 'failed' }

/** 本次从扩展打开登录时的临时 connect（OAuth 跳转用 sessionStorage）。 */
const STORAGE_EXTENSION_ID = 'yiveno_connect_extension_id'
const STORAGE_CONNECT_FLAG = 'yiveno_connect_extension'

/** 上次成功连接的扩展 id（localStorage，供账户页退出回传）。 */
const STORAGE_LAST_EXTENSION_ID = 'yiveno_last_extension_id'

export interface ExtensionHandoffSession {
  accessToken: string
  refreshToken: string
  userId: string
  email?: string
  expiresAt?: number
  avatarUrl?: string
  displayName?: string
  /** Worker 下发的卸载一次性 revoke token */
  uninstallRevokeToken?: string
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

/**
 * 写入本次/持久扩展目标，供账户页补推 session（不仅退出用）。
 * 来自 URL `extension_id` 或扩展打开的登录页。
 */
export function primeExtensionHandoffTarget(extensionId: string): void {
  const trimmed = extensionId.trim()
  if (!trimmed) {
    return
  }
  sessionStorage.setItem(STORAGE_CONNECT_FLAG, '1')
  sessionStorage.setItem(STORAGE_EXTENSION_ID, trimmed)
  rememberConnectedExtensionId(trimmed)
}

/** 解析 handoff 目标：优先本次 connect，其次上次成功连接。 */
export function resolveExtensionHandoffTargetId(): string | null {
  return getPendingExtensionId() ?? getLastConnectedExtensionId()
}

/** 记住成功 handoff 的扩展 id，供日后官网退出回传。 */
export function rememberConnectedExtensionId(extensionId: string): void {
  const trimmed = extensionId.trim()
  if (!trimmed) {
    return
  }
  localStorage.setItem(STORAGE_LAST_EXTENSION_ID, trimmed)
}

/** 读取上次连接的扩展 id（退出 handoff 用）。 */
export function getLastConnectedExtensionId(): string | null {
  return localStorage.getItem(STORAGE_LAST_EXTENSION_ID)
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

/** 官网 UI 不应无限等 SW 唤醒 / 扩展内部归并。 */
const SEND_TO_EXTENSION_TIMEOUT_MS = 2500

function sendToExtension(extensionId: string, message: unknown): Promise<boolean> {
  const runtime = getChromeRuntime()
  if (!runtime?.sendMessage) {
    return Promise.resolve(false)
  }

  return new Promise(resolve => {
    let settled = false
    const finish = (ok: boolean): void => {
      if (settled) {
        return
      }
      settled = true
      resolve(ok)
    }

    const timer = window.setTimeout(() => {
      console.warn('[ExtensionHandoff] sendMessage timed out', SEND_TO_EXTENSION_TIMEOUT_MS)
      finish(false)
    }, SEND_TO_EXTENSION_TIMEOUT_MS)

    try {
      runtime.sendMessage(extensionId, message, response => {
        window.clearTimeout(timer)
        const err = runtime.lastError
        if (err) {
          console.warn('[ExtensionHandoff] sendMessage lastError', err.message)
          finish(false)
          return
        }
        const ok =
          typeof response === 'object' &&
          response !== null &&
          'ok' in response &&
          (response as { ok: unknown }).ok === true
        finish(ok)
      })
    } catch (error) {
      window.clearTimeout(timer)
      console.warn('[ExtensionHandoff] sendMessage failed', error)
      finish(false)
    }
  })
}

/**
 * 将已铸造的扩展 session 回传扩展。
 * 目标 id：本次 connect pending → 上次成功连接的扩展。
 * @returns true 表示扩展确认 ok
 */
export function handoffSessionToExtension(session: ExtensionHandoffSession): Promise<boolean> {
  const extensionId = resolveExtensionHandoffTargetId()
  if (!extensionId) {
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
      ...(session.displayName ? { displayName: session.displayName } : {}),
      ...(session.uninstallRevokeToken
        ? { uninstallRevokeToken: session.uninstallRevokeToken }
        : {})
    }
  }

  return sendToExtension(extensionId, message).then(ok => {
    if (ok) {
      rememberConnectedExtensionId(extensionId)
      clearExtensionConnectParams()
    }
    return ok
  })
}

/**
 * 放弃 connect 时清本机官网会话并回登录页（可带 connect 参数重试）。
 * Connect 路径不再二次弹窗；此函数供兼容分支 / 显式 abort。
 */
export async function abortWebsiteLoginAfterDisplaceCancel(): Promise<void> {
  const extensionId = getPendingExtensionId()
  try {
    await signOut()
  } catch (error) {
    console.warn('[ExtensionHandoff] 取消挤掉后清官网会话失败', error)
  }
  if (extensionId) {
    const params = new URLSearchParams()
    params.set('connect_extension', '1')
    params.set('extension_id', extensionId)
    window.location.replace(`/login?${params.toString()}`)
    return
  }
  window.location.replace('/login')
}

/**
 * 用官网 access token 铸造扩展独立会话并 handoff。
 * Connect / connect_extension 本身即同意挤掉旧扩展会话（409 时自动 confirmDisplace，不再二次弹窗）。
 * mint 失败不回退为共享官网 refresh。
 */
export async function mintAndHandoffSessionToExtension(input: {
  websiteAccessToken: string
  userId: string
  email?: string
  avatarUrl?: string
  displayName?: string
}): Promise<MintAndHandoffResult> {
  const extensionId = resolveExtensionHandoffTargetId()
  if (!extensionId) {
    return { status: 'failed' }
  }

  let minted = await mintExtensionSession(input.websiteAccessToken, { extensionId })
  if (minted.status === 'needs_displace_confirm') {
    // 用户已点 Connect / 走 connect_extension：直接挤掉前序扩展会话（含本机重装残留租约）
    console.info('[ExtensionHandoff] 已有扩展租约，Connect 路径自动 confirmDisplace')
    minted = await mintExtensionSession(input.websiteAccessToken, {
      confirmDisplace: true,
      extensionId
    })
  }

  if (minted.status !== 'ok') {
    console.warn('[ExtensionHandoff] mint 失败，跳过 handoff（不共享官网 refresh）')
    return { status: 'failed' }
  }
  if (minted.session.userId !== input.userId) {
    console.warn('[ExtensionHandoff] mint userId 与官网不一致，跳过 handoff')
    return { status: 'failed' }
  }
  const handed = await handoffSessionToExtension({
    accessToken: minted.session.accessToken,
    refreshToken: minted.session.refreshToken,
    userId: minted.session.userId,
    ...(minted.session.email
      ? { email: minted.session.email }
      : input.email
        ? { email: input.email }
        : {}),
    ...(minted.session.expiresAt != null ? { expiresAt: minted.session.expiresAt } : {}),
    ...(input.avatarUrl ? { avatarUrl: input.avatarUrl } : {}),
    ...(input.displayName ? { displayName: input.displayName } : {}),
    ...(minted.session.uninstallRevokeToken
      ? { uninstallRevokeToken: minted.session.uninstallRevokeToken }
      : {})
  })
  return handed ? { status: 'ok' } : { status: 'failed' }
}

/**
 * 官网退出后通知扩展清登录态（保留 Memory）。
 * 无上次 extension_id 或扩展未装时返回 false（不阻塞官网退出）。
 */
export function handoffSignOutToExtension(): Promise<boolean> {
  const extensionId = getLastConnectedExtensionId() ?? getPendingExtensionId()
  if (!extensionId) {
    return Promise.resolve(false)
  }

  return sendToExtension(extensionId, {
    type: 'YIVENO_AUTH_SIGN_OUT_HANDOFF',
    payload: { reason: 'website_sign_out' }
  })
}
