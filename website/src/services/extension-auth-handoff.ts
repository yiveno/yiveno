/**
 * 官网 → Chrome 扩展登录 / 退出会话回传。
 * 依赖扩展 manifest externally_connectable；页面通过 chrome.runtime.sendMessage(extensionId, …)。
 *
 * 登录 handoff：必须先 Worker mint 扩展独立 session，再回传；禁止把官网 refresh 直接递给扩展。
 */

import { signOut } from './auth'
import { confirmDisplaceExtensionSession } from './confirm-displace-extension-session'
import { mintExtensionSession, type MintedExtensionSession } from './mint-extension-session'
import { rollbackMintedExtensionSession } from './rollback-minted-extension-session'

/** mint + handoff 结果（取消挤掉弹窗 → cancelled_displace） */
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

/**
 * UI 桥 / 账户页 Connect：无 URL 时写入本次 pending（供 mintAndHandoff 读取）。
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
 * @deprecated 勿再用于账户页——会把 `extension_id` 当成 Connect 并触发 mint。
 * 请用 {@link rememberConnectedExtensionId}；Connect 只靠 `connect_extension=1`。
 */
export function primeExtensionHandoffTarget(extensionId: string): void {
  rememberConnectedExtensionId(extensionId)
}

/**
 * 解析 handoff 目标：优先本次 connect，其次上次成功连接。
 * 用于退出回传 / 已铸造 session 的 sendMessage 目标；
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

/**
 * 探测本机扩展是否已登录为指定 userId（Connect 前短路用）。
 * 探测失败 / 未装扩展 → false（继续走 mint）。
 */
export async function probeExtensionAlreadySignedInAs(
  extensionId: string,
  userId: string
): Promise<boolean> {
  const expected = userId.trim()
  if (!extensionId.trim() || !expected) {
    return false
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
    return false
  }
  const signedIn = (response as { signedIn?: unknown }).signedIn === true
  const responseUserId =
    typeof (response as { userId?: unknown }).userId === 'string'
      ? (response as { userId: string }).userId.trim()
      : ''
  return signedIn && responseUserId === expected
}

/**
 * 探测本机扩展能否静默认领 409 租约（本地 lastLeaseSessionId 匹配且未登录）。
 * 探测失败 → false（保守弹窗）。
 */
export async function probeExtensionLeaseReclaimable(
  extensionId: string,
  existingSessionId: string
): Promise<boolean> {
  const sid = existingSessionId.trim()
  if (!extensionId.trim() || !sid) {
    return false
  }
  const response = await sendToExtensionRaw(extensionId, {
    type: 'YIVENO_EXTENSION_LEASE_RECLAIM_PROBE',
    payload: { existingSessionId: sid }
  })
  if (
    typeof response !== 'object' ||
    response === null ||
    (response as { ok?: unknown }).ok !== true
  ) {
    return false
  }
  return (response as { reclaimable?: unknown }).reclaimable === true
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

  return sendToExtensionWaking(extensionId, message).then(ok => {
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
 * 将已铸造的扩展 session handoff 到扩展（禁止共享官网 refresh）。
 * handoff 失败 → 立刻用本次 revoke token 回滚远端会话/租约（防活租约孤儿）。
 */
async function handoffMintedSession(
  input: {
    userId: string
    email?: string
    avatarUrl?: string
    displayName?: string
  },
  session: MintedExtensionSession
): Promise<boolean> {
  if (session.userId !== input.userId) {
    console.warn('[ExtensionHandoff] mint userId 与官网不一致，跳过 handoff 并回滚')
    await rollbackMintedExtensionSession(session.uninstallRevokeToken)
    return false
  }
  const ok = await handoffSessionToExtension({
    accessToken: session.accessToken,
    refreshToken: session.refreshToken,
    userId: session.userId,
    ...(session.email ? { email: session.email } : input.email ? { email: input.email } : {}),
    ...(session.expiresAt != null ? { expiresAt: session.expiresAt } : {}),
    ...(input.avatarUrl ? { avatarUrl: input.avatarUrl } : {}),
    ...(input.displayName ? { displayName: input.displayName } : {}),
    ...(session.uninstallRevokeToken ? { uninstallRevokeToken: session.uninstallRevokeToken } : {})
  })
  if (!ok) {
    console.warn('[ExtensionHandoff] handoff 失败，回滚刚铸造的扩展会话')
    await rollbackMintedExtensionSession(session.uninstallRevokeToken)
  }
  return ok
}

/**
 * 用官网 access token 铸造扩展独立会话并 handoff。
 * **仅**本次 `connect_extension`（sessionStorage pending）可 mint；`last_extension_id` 不够格。
 * 扩展已是同一 userId → 跳过 mint（避免同机已连通仍弹挤掉）。
 * 已有扩展租约：本机 lastLease 可认领 → 静默 `confirmDisplace`；否则自定义弹窗（真·他端）。
 * mint 失败不回退为共享官网 refresh。
 */
export async function mintAndHandoffSessionToExtension(input: {
  websiteAccessToken: string
  userId: string
  email?: string
  avatarUrl?: string
  displayName?: string
  /** 即将弹出挤掉确认时回调（AuthCallback 更新状态文案） */
  onNeedsDisplaceConfirm?: () => void
}): Promise<MintAndHandoffResult> {
  const extensionId = getPendingExtensionId()
  if (!extensionId) {
    console.warn('[ExtensionHandoff] 无本次 connect_extension，跳过 mint（不静默 remint）')
    return { status: 'failed' }
  }

  // 同机已连通同一账号：零 mint、零挤掉弹窗
  if (await probeExtensionAlreadySignedInAs(extensionId, input.userId)) {
    console.warn('[ExtensionHandoff] 扩展已是同一账号，跳过 mint')
    rememberConnectedExtensionId(extensionId)
    clearExtensionConnectParams()
    return { status: 'ok' }
  }

  const minted = await mintExtensionSession(input.websiteAccessToken, { extensionId })
  if (minted.status === 'needs_displace_confirm') {
    const runConfirmDisplace = async (): Promise<boolean> => {
      const displaced = await mintExtensionSession(input.websiteAccessToken, {
        confirmDisplace: true,
        extensionId
      })
      if (displaced.status !== 'ok') {
        console.warn('[ExtensionHandoff] confirmDisplace mint 失败', displaced.status)
        return false
      }
      const handed = await handoffMintedSession(input, displaced.session)
      if (!handed) {
        console.warn('[ExtensionHandoff] confirmDisplace 后 handoff 失败')
        return false
      }
      return true
    }

    // 同机孤儿租约（本安装上次 handoff 的 session 仍占 KV）→ 静默挤掉，不弹窗
    // 真·他端（他 Profile / 他设备）→ 弹窗确认。extensionId 不能区分 Profile。
    const canReclaim =
      minted.existingSessionId != null &&
      (await probeExtensionLeaseReclaimable(extensionId, minted.existingSessionId))
    if (canReclaim) {
      console.warn('[ExtensionHandoff] 本机可认领孤儿租约，静默 confirmDisplace')
      const ok = await runConfirmDisplace()
      return ok ? { status: 'ok' } : { status: 'failed' }
    }

    console.warn('[ExtensionHandoff] 他端占租约，打开自定义挤掉确认')
    input.onNeedsDisplaceConfirm?.()
    const confirmed = await confirmDisplaceExtensionSession(runConfirmDisplace)
    return confirmed ? { status: 'ok' } : { status: 'cancelled_displace' }
  }

  if (minted.status !== 'ok') {
    console.warn('[ExtensionHandoff] mint 失败，跳过 handoff（不共享官网 refresh）')
    return { status: 'failed' }
  }
  const handed = await handoffMintedSession(input, minted.session)
  return handed ? { status: 'ok' } : { status: 'failed' }
}
