/**
 * 官网 → Chrome 扩展登录 / 退出会话回传。
 * 依赖扩展 manifest externally_connectable；页面通过 chrome.runtime.sendMessage(extensionId, …)。
 *
 * Connect：Worker `device-register`（website_connect）→ `YIVENO_AUTH_DEVICE_HANDOFF`；
 * 禁止把官网 refresh 直接递给扩展。
 */

import {
  registerDeviceFromWebsite,
  rollbackIssuedDeviceToken,
  type RegisteredDeviceFromWebsite
} from './register-device-from-website'

/** device-register + handoff 结果 */
export type RegisterAndHandoffResult =
  { status: 'ok' } | { status: 'failed'; error?: string } | { status: 'account_mismatch' }

/** @deprecated 用 {@link RegisterAndHandoffResult} */
export type MintAndHandoffResult = RegisterAndHandoffResult

/** 本次从扩展打开登录时的临时 connect（OAuth 跳转用 sessionStorage）。 */
const STORAGE_EXTENSION_ID = 'yiveno_connect_extension_id'
const STORAGE_CONNECT_FLAG = 'yiveno_connect_extension'

/** 上次成功连接的扩展 id（localStorage，供账户页退出回传）。 */
const STORAGE_LAST_EXTENSION_ID = 'yiveno_last_extension_id'

/** 官网 → 扩展 device handoff 载荷（与扩展 ExternalAuthDeviceHandoffSchema 对齐）。 */
export type ExtensionDeviceHandoffPayload = {
  deviceToken: string
  deviceId: string
  userId: string
  isAnonymous: boolean
  email?: string
  avatarUrl?: string
  displayName?: string
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

/**
 * UI 桥 / 账户页 Connect：无 URL 时写入本次 pending（供 registerAndHandoff 读取）。
 */
export function primeExtensionConnectPending(extensionId: string): void {
  const trimmed = extensionId.trim()
  if (!trimmed) {
    return
  }
  sessionStorage.setItem(STORAGE_CONNECT_FLAG, '1')
  sessionStorage.setItem(STORAGE_EXTENSION_ID, trimmed)
  rememberConnectedExtensionId(trimmed)
}

export function getPendingExtensionId(): string | null {
  if (sessionStorage.getItem(STORAGE_CONNECT_FLAG) !== '1') {
    return null
  }
  return sessionStorage.getItem(STORAGE_EXTENSION_ID)
}

/**
 * 解析 handoff 目标：优先本次 connect，其次上次成功连接。
 * 用于已铸造 session 的 sendMessage 目标；
 * **mint 新扩展会话**须走 `getPendingExtensionId()`（禁止仅凭 last id 静默 remint）。
 */
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

/**
 * 官网 → 扩展 sendMessage 超时。
 * OAuth 回跳后 SW 常冷启动；2.5s 易误判失败 → 官网已登录 + 仅 ConnectBar。
 */
const SEND_TO_EXTENSION_TIMEOUT_MS = 8000

/** sendMessage 原始响应（超时 / lastError → null）。 */
function sendToExtensionRaw(extensionId: string, message: unknown): Promise<unknown | null> {
  const runtime = getChromeRuntime()
  if (!runtime?.sendMessage) {
    return Promise.resolve(null)
  }

  return new Promise(resolve => {
    let settled = false
    const finish = (value: unknown | null): void => {
      if (settled) {
        return
      }
      settled = true
      resolve(value)
    }

    const timer = window.setTimeout(() => {
      console.warn('[ExtensionHandoff] sendMessage timed out', SEND_TO_EXTENSION_TIMEOUT_MS)
      finish(null)
    }, SEND_TO_EXTENSION_TIMEOUT_MS)

    try {
      runtime.sendMessage(extensionId, message, response => {
        window.clearTimeout(timer)
        const err = runtime.lastError
        if (err) {
          console.warn('[ExtensionHandoff] sendMessage lastError', err.message)
          finish(null)
          return
        }
        finish(response)
      })
    } catch (error) {
      window.clearTimeout(timer)
      console.warn('[ExtensionHandoff] sendMessage failed', error)
      finish(null)
    }
  })
}

function isExtensionOkResponse(response: unknown): boolean {
  return (
    typeof response === 'object' &&
    response !== null &&
    'ok' in response &&
    (response as { ok: unknown }).ok === true
  )
}

function sendToExtension(extensionId: string, message: unknown): Promise<boolean> {
  return sendToExtensionRaw(extensionId, message).then(isExtensionOkResponse)
}

/** 先 probe 唤醒 SW，失败再短等重试一次（handoff 专用）。 */
async function sendToExtensionWaking(extensionId: string, message: unknown): Promise<boolean> {
  await sendToExtensionRaw(extensionId, {
    type: 'YIVENO_EXTENSION_AUTH_STATUS_PROBE',
    payload: {}
  })
  if (await sendToExtension(extensionId, message)) {
    return true
  }
  console.warn('[ExtensionHandoff] 首次 handoff 未成功，400ms 后重试')
  await new Promise<void>(resolve => {
    window.setTimeout(resolve, 400)
  })
  return sendToExtension(extensionId, message)
}

export type ExtensionAuthStatusProbeResult =
  | { kind: 'unreachable' }
  | { kind: 'signed_out' }
  | { kind: 'same_account'; userId: string }
  | { kind: 'other_account'; userId: string }

/**
 * 探测本机扩展登录态（Connect 前短路 / 冲突检测）。
 * 探测失败 / 未装扩展 → unreachable（可继续 register）。
 */
export async function probeExtensionAuthStatus(
  extensionId: string,
  expectedUserId: string
): Promise<ExtensionAuthStatusProbeResult> {
  const expected = expectedUserId.trim()
  if (!extensionId.trim() || !expected) {
    return { kind: 'unreachable' }
  }
  const response = await sendToExtensionRaw(extensionId, {
    type: 'YIVENO_EXTENSION_AUTH_STATUS_PROBE',
    payload: { expectedUserId: expected }
  })
  if (
    typeof response !== 'object' ||
    response === null ||
    (response as { ok?: unknown }).ok !== true
  ) {
    return { kind: 'unreachable' }
  }
  const signedIn = (response as { signedIn?: unknown }).signedIn === true
  const responseUserId =
    typeof (response as { userId?: unknown }).userId === 'string'
      ? (response as { userId: string }).userId.trim()
      : ''
  if (!signedIn || !responseUserId) {
    return { kind: 'signed_out' }
  }
  if (responseUserId === expected) {
    return { kind: 'same_account', userId: responseUserId }
  }
  return { kind: 'other_account', userId: responseUserId }
}

/**
 * 将 device-register 结果回传扩展（外部消息通道）。
 * @returns true 表示扩展确认 ok
 */
export function handoffDeviceToExtension(payload: ExtensionDeviceHandoffPayload): Promise<boolean> {
  const extensionId = resolveExtensionHandoffTargetId()
  if (!extensionId) {
    return Promise.resolve(false)
  }

  const message = {
    type: 'YIVENO_AUTH_DEVICE_HANDOFF',
    payload: {
      deviceToken: payload.deviceToken,
      deviceId: payload.deviceId,
      userId: payload.userId,
      isAnonymous: payload.isAnonymous,
      ...(payload.email ? { email: payload.email } : {}),
      ...(payload.avatarUrl ? { avatarUrl: payload.avatarUrl } : {}),
      ...(payload.displayName ? { displayName: payload.displayName } : {}),
      ...(payload.uninstallRevokeToken
        ? { uninstallRevokeToken: payload.uninstallRevokeToken }
        : {})
    }
  }

  return sendToExtensionWaking(extensionId, message).then(ok => {
    if (ok) {
      rememberConnectedExtensionId(extensionId)
      clearExtensionConnectParams()
    }
    return ok
  })
}

function deviceHandoffPayloadFromRegister(
  data: RegisteredDeviceFromWebsite,
  profile: { email?: string; avatarUrl?: string; displayName?: string }
): ExtensionDeviceHandoffPayload {
  return {
    deviceToken: data.deviceToken,
    deviceId: data.deviceId,
    userId: data.userId,
    isAnonymous: data.isAnonymous,
    ...(data.email ? { email: data.email } : profile.email ? { email: profile.email } : {}),
    ...(data.avatarUrl
      ? { avatarUrl: data.avatarUrl }
      : profile.avatarUrl
        ? { avatarUrl: profile.avatarUrl }
        : {}),
    ...(data.displayName
      ? { displayName: data.displayName }
      : profile.displayName
        ? { displayName: profile.displayName }
        : {}),
    ...(data.uninstallRevokeToken ? { uninstallRevokeToken: data.uninstallRevokeToken } : {})
  }
}

/**
 * 用官网 access 注册 device token 并 handoff 到扩展。
 * **仅**本次 `connect_extension` pending 可 register；`last_extension_id` 不够格。
 * 扩展已是同一 userId → 跳过 register。
 * 扩展已是**另一**账号 → 不静默覆盖（返回 account_mismatch）。
 * register/handoff 失败不共享官网 refresh；handoff 失败尽力 revoke 刚发的 device。
 */
export async function registerAndHandoffDeviceToExtension(input: {
  websiteAccessToken: string
  userId: string
  email?: string
  avatarUrl?: string
  displayName?: string
}): Promise<RegisterAndHandoffResult> {
  const extensionId = getPendingExtensionId()
  if (!extensionId) {
    console.warn('[ExtensionHandoff] 无本次 connect_extension，跳过 device-register')
    return { status: 'failed', error: 'missing_connect_pending' }
  }

  const probed = await probeExtensionAuthStatus(extensionId, input.userId)
  if (probed.kind === 'same_account') {
    console.warn('[ExtensionHandoff] 扩展已是同一账号，跳过 device-register')
    rememberConnectedExtensionId(extensionId)
    clearExtensionConnectParams()
    return { status: 'ok' }
  }
  if (probed.kind === 'other_account') {
    console.warn('[ExtensionHandoff] 扩展已登录其它账号，拒绝覆盖', {
      extensionUserId: probed.userId,
      websiteUserId: input.userId
    })
    return { status: 'account_mismatch' }
  }

  const registered = await registerDeviceFromWebsite(input.websiteAccessToken, { extensionId })
  if (registered.status === 'unauthorized') {
    console.warn('[ExtensionHandoff] device-register 401', registered.error)
    return { status: 'failed', error: registered.error }
  }
  if (registered.status !== 'ok') {
    console.warn('[ExtensionHandoff] device-register 失败', registered.error)
    return { status: 'failed', error: registered.error }
  }

  if (registered.data.userId !== input.userId) {
    console.warn('[ExtensionHandoff] register userId 与官网不一致，回滚')
    await rollbackIssuedDeviceToken(registered.data.deviceToken)
    return { status: 'failed', error: 'user_id_mismatch' }
  }

  const payload = deviceHandoffPayloadFromRegister(registered.data, {
    ...(input.email ? { email: input.email } : {}),
    ...(input.avatarUrl ? { avatarUrl: input.avatarUrl } : {}),
    ...(input.displayName ? { displayName: input.displayName } : {})
  })
  const handed = await handoffDeviceToExtension(payload)
  if (!handed) {
    console.warn('[ExtensionHandoff] device handoff 失败，回滚刚发的 device token')
    await rollbackIssuedDeviceToken(registered.data.deviceToken)
    return { status: 'failed', error: 'handoff_failed' }
  }
  return { status: 'ok' }
}

/** @deprecated 用 {@link registerAndHandoffDeviceToExtension} */
export const mintAndHandoffSessionToExtension = registerAndHandoffDeviceToExtension
