/**
 * 同浏览器官网 ↔ 扩展 UI Port 桥（ADR-019）。
 * 可见才主动推；不可见记脏，回前台再发。
 */

import { getLastConnectedExtensionId, getPendingExtensionId } from './extension-auth-handoff'

const PORT_NAME = 'yiveno-ui-bridge'
const CHANNEL = 'yiveno_ui_bridge' as const

type BridgeRole = 'website' | 'extension'

export type WebsiteAuthChangedPayload = {
  signedIn: boolean
  userId?: string
}

export type WebsiteProfileChangedPayload = {
  userId: string
  displayName?: string
  avatarUrl?: string
}

export type ExtensionAuthChangedPayload = {
  signedIn: boolean
  userId?: string
  displayName?: string
  avatarUrl?: string
}

export type RequestExtensionConnectPayload = {
  extensionId: string
}

export type WebsiteConnectResultStatus =
  'ok' | 'cancelled_displace' | 'failed' | 'no_session' | 'busy'

type ChromePort = {
  name: string
  postMessage: (message: unknown) => void
  disconnect: () => void
  onMessage: {
    addListener: (cb: (message: unknown) => void) => void
    removeListener: (cb: (message: unknown) => void) => void
  }
  onDisconnect: {
    addListener: (cb: () => void) => void
  }
}

type ChromeRuntimeConnect = {
  connect: (extensionId: string, connectInfo?: { name?: string }) => ChromePort
  lastError?: { message?: string }
}

function getChromeRuntime(): ChromeRuntimeConnect | null {
  const chromeApi = (globalThis as { chrome?: { runtime?: ChromeRuntimeConnect } }).chrome
  return chromeApi?.runtime ?? null
}

function resolveExtensionId(): string | null {
  return getPendingExtensionId() ?? getLastConnectedExtensionId()
}

function isDocumentVisible(): boolean {
  return typeof document === 'undefined' ? true : document.visibilityState === 'visible'
}

function wrap(msg: Record<string, unknown>): unknown {
  return { channel: CHANNEL, v: 1, msg }
}

let port: ChromePort | null = null
let connecting = false
let dirtyAuth: WebsiteAuthChangedPayload | null = null
let visibilityBound = false
const extensionAuthListeners = new Set<(payload: ExtensionAuthChangedPayload) => void>()
const requestConnectListeners = new Set<(payload: RequestExtensionConnectPayload) => void>()

function notifyExtensionAuthListeners(payload: ExtensionAuthChangedPayload): void {
  for (const listener of extensionAuthListeners) {
    try {
      listener(payload)
    } catch (error) {
      console.warn('[UiBridge] extension_auth listener failed', error)
    }
  }
}

function notifyRequestConnectListeners(payload: RequestExtensionConnectPayload): void {
  for (const listener of requestConnectListeners) {
    try {
      listener(payload)
    } catch (error) {
      console.warn('[UiBridge] request_extension_connect listener failed', error)
    }
  }
}

function handlePortMessage(raw: unknown): void {
  if (typeof raw !== 'object' || raw === null) {
    return
  }
  const envelope = raw as { channel?: unknown; v?: unknown; msg?: unknown }
  if (envelope.channel !== CHANNEL || envelope.v !== 1) {
    return
  }
  const msg = envelope.msg as { type?: unknown; payload?: unknown } | undefined
  if (!msg || typeof msg.type !== 'string') {
    return
  }
  if (msg.type === 'extension_auth_changed' && msg.payload && typeof msg.payload === 'object') {
    const p = msg.payload as Record<string, unknown>
    notifyExtensionAuthListeners({
      signedIn: p.signedIn === true,
      ...(typeof p.userId === 'string' ? { userId: p.userId } : {}),
      ...(typeof p.displayName === 'string' ? { displayName: p.displayName } : {}),
      ...(typeof p.avatarUrl === 'string' ? { avatarUrl: p.avatarUrl } : {})
    })
    return
  }
  if (msg.type === 'request_extension_connect' && msg.payload && typeof msg.payload === 'object') {
    const p = msg.payload as Record<string, unknown>
    const extensionId = typeof p.extensionId === 'string' ? p.extensionId.trim() : ''
    if (extensionId) {
      notifyRequestConnectListeners({ extensionId })
    }
  }
}

function bindVisibilityFlush(): void {
  if (visibilityBound || typeof document === 'undefined') {
    return
  }
  visibilityBound = true
  document.addEventListener('visibilitychange', () => {
    if (!isDocumentVisible()) {
      return
    }
    void ensureUiBridgeConnected()
    if (dirtyAuth) {
      const pending = dirtyAuth
      dirtyAuth = null
      publishWebsiteAuthChanged(pending)
    }
  })
}

function attachPort(next: ChromePort): void {
  port = next
  next.onMessage.addListener(handlePortMessage)
  next.onDisconnect.addListener(() => {
    // 消费 bfcache / 页关闭等导致的 lastError，避免扩展错误页 Unchecked runtime.lastError
    const runtime = getChromeRuntime()
    void runtime?.lastError
    port = null
    connecting = false
  })
  try {
    next.postMessage(wrap({ type: 'bridge_hello', payload: { role: 'website' as BridgeRole } }))
  } catch (error) {
    console.warn('[UiBridge] hello failed', error)
  }
  if (dirtyAuth && isDocumentVisible()) {
    const pending = dirtyAuth
    dirtyAuth = null
    publishWebsiteAuthChanged(pending)
  }
}

/** 确保与扩展 Port 已连接（无 extension id / 无 chrome.runtime 则静默失败）。 */
export async function ensureUiBridgeConnected(): Promise<boolean> {
  bindVisibilityFlush()
  if (port) {
    return true
  }
  if (connecting) {
    return false
  }
  const extensionId = resolveExtensionId()
  const runtime = getChromeRuntime()
  if (!extensionId || !runtime?.connect) {
    return false
  }
  connecting = true
  try {
    const next = runtime.connect(extensionId, { name: PORT_NAME })
    void runtime.lastError
    attachPort(next)
    connecting = false
    return true
  } catch (error) {
    connecting = false
    console.warn('[UiBridge] connect failed', error)
    return false
  }
}

function postWhenReady(msg: Record<string, unknown>): void {
  if (!port) {
    void ensureUiBridgeConnected().then(ok => {
      if (ok && port) {
        try {
          port.postMessage(wrap(msg))
        } catch (error) {
          console.warn('[UiBridge] post after connect failed', error)
        }
      }
    })
    return
  }
  try {
    port.postMessage(wrap(msg))
  } catch (error) {
    console.warn('[UiBridge] post failed', error)
    port = null
    void ensureUiBridgeConnected()
  }
}

/**
 * 推送官网登录态。不可见时记脏，回前台再发。
 */
export function publishWebsiteAuthChanged(payload: WebsiteAuthChangedPayload): void {
  if (!isDocumentVisible()) {
    dirtyAuth = payload
    return
  }
  postWhenReady({
    type: 'website_auth_changed',
    payload: {
      signedIn: payload.signedIn,
      ...(payload.userId ? { userId: payload.userId } : {})
    }
  })
}

/** 推送官网资料变更（头像/昵称）；仅可见时发送。 */
export function publishWebsiteProfileChanged(payload: WebsiteProfileChangedPayload): void {
  if (!isDocumentVisible()) {
    return
  }
  postWhenReady({
    type: 'website_profile_changed',
    payload: {
      userId: payload.userId,
      ...(payload.displayName ? { displayName: payload.displayName } : {}),
      ...(payload.avatarUrl ? { avatarUrl: payload.avatarUrl } : {})
    }
  })
}

/** 订阅扩展登录态（官网 Nav / 账户页 UI）。 */
export function subscribeExtensionAuthChanged(
  listener: (payload: ExtensionAuthChangedPayload) => void
): () => void {
  extensionAuthListeners.add(listener)
  void ensureUiBridgeConnected()
  return () => {
    extensionAuthListeners.delete(listener)
  }
}

/** 订阅扩展发起的零导航 Connect 请求。 */
export function subscribeRequestExtensionConnect(
  listener: (payload: RequestExtensionConnectPayload) => void
): () => void {
  requestConnectListeners.add(listener)
  void ensureUiBridgeConnected()
  return () => {
    requestConnectListeners.delete(listener)
  }
}

/** 告知扩展：官网已接手本次 Connect。 */
export function publishWebsiteConnectAck(): void {
  postWhenReady({
    type: 'website_connect_ack',
    payload: {}
  })
}

/** 告知扩展：Connect 终态。 */
export function publishWebsiteConnectResult(status: WebsiteConnectResultStatus): void {
  postWhenReady({
    type: 'website_connect_result',
    payload: { status }
  })
}
