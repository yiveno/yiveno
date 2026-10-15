/**
 * 同浏览器官网 ↔ 扩展 UI Port 桥（ADR-019）。
 * 可见性：只写 storage / 广播；Panel DOM 由页面可见时自行读。
 */

import { AUTH_SESSION_STORAGE_KEY } from '@/core/identity/auth-session'
import { isExternallyConnectableOrigin } from '@/core/extension/externally-connectable-origins'
import {
  UI_BRIDGE_PORT_NAME,
  UiBridgeEnvelopeSchema,
  wrapUiBridgeMessage,
  type UiBridgeEnvelope,
  type UiBridgeInnerMessage
} from '@/core/identity/ui-bridge-messages'
import { writeWebsiteAuthUiState } from '@/infrastructure/auth/website-auth-ui-storage'
import { getAuthSession, setAuthSession } from '@/infrastructure/identity/auth-session-service'
import { logger } from '@/infrastructure/logging/logger'

const ports = new Set<chrome.runtime.Port>()
let listenerRegistered = false
let storageWatchRegistered = false

function postEnvelope(port: chrome.runtime.Port, msg: UiBridgeInnerMessage): void {
  try {
    port.postMessage(wrapUiBridgeMessage(msg))
  } catch (error) {
    logger.warn('Auth', 'UI 桥 postMessage 失败', error)
  }
}

function broadcast(msg: UiBridgeInnerMessage): void {
  for (const port of ports) {
    postEnvelope(port, msg)
  }
}

async function buildExtensionAuthChangedMessage(): Promise<UiBridgeInnerMessage> {
  const session = await getAuthSession()
  if (!session?.userId) {
    return { type: 'extension_auth_changed', payload: { signedIn: false } }
  }
  return {
    type: 'extension_auth_changed',
    payload: {
      signedIn: true,
      userId: session.userId,
      ...(session.displayName?.trim() ? { displayName: session.displayName.trim() } : {}),
      ...(session.avatarUrl?.trim() ? { avatarUrl: session.avatarUrl.trim() } : {})
    }
  }
}

async function applyWebsiteAuthChanged(payload: {
  signedIn: boolean
  userId?: string | undefined
}): Promise<void> {
  // 登出也写行（signedIn:false），避免删键后 Side Panel 每次回落 probe
  await writeWebsiteAuthUiState({
    signedIn: payload.signedIn,
    ...(payload.signedIn && payload.userId ? { userId: payload.userId } : {}),
    at: Date.now()
  })
  logger.info('Auth', 'UI 桥：官网登录态', {
    signedIn: payload.signedIn,
    hasUserId: Boolean(payload.userId)
  })
}

async function applyWebsiteProfileChanged(payload: {
  userId: string
  displayName?: string | undefined
  avatarUrl?: string | undefined
}): Promise<void> {
  const session = await getAuthSession()
  if (!session || session.userId !== payload.userId) {
    logger.info('Auth', 'UI 桥：资料变更与扩展账号不一致，忽略', {
      payloadUserId: payload.userId,
      localUserId: session?.userId ?? null
    })
    return
  }
  const next = {
    ...session,
    ...(payload.displayName !== undefined ? { displayName: payload.displayName } : {}),
    ...(payload.avatarUrl !== undefined ? { avatarUrl: payload.avatarUrl } : {})
  }
  await setAuthSession(next)
  logger.info('Auth', 'UI 桥：已更新扩展展示资料', {
    userId: payload.userId,
    hasDisplayName: Boolean(payload.displayName),
    hasAvatarUrl: Boolean(payload.avatarUrl)
  })
}

/** Connect 等待：官网 ack / 终态（AUTH_CONNECT_WEBSITE）。 */
type ConnectWaiter = {
  acked: boolean
  onAck: () => void
  onResult: (status: string) => void
}

let connectWaiter: ConnectWaiter | null = null

/** 注册本次 Connect 等待（单飞）。 */
export function beginUiBridgeConnectWait(handlers: {
  onAck: () => void
  onResult: (status: string) => void
}): void {
  connectWaiter = {
    acked: false,
    onAck: handlers.onAck,
    onResult: handlers.onResult
  }
}

/** 清除 Connect 等待。 */
export function clearUiBridgeConnectWait(): void {
  connectWaiter = null
}

/** 当前是否有官网 Port（零导航前提）。 */
export function getUiBridgePortCount(): number {
  return ports.size
}

/** 向所有官网 Port 广播 request_extension_connect。 */
export function broadcastRequestExtensionConnect(extensionId: string): number {
  const msg: UiBridgeInnerMessage = {
    type: 'request_extension_connect',
    payload: { extensionId }
  }
  broadcast(msg)
  return ports.size
}

async function handleInnerMessage(msg: UiBridgeInnerMessage): Promise<void> {
  switch (msg.type) {
    case 'bridge_hello':
      return
    case 'website_auth_changed':
      await applyWebsiteAuthChanged(msg.payload)
      return
    case 'website_profile_changed':
      await applyWebsiteProfileChanged(msg.payload)
      return
    case 'extension_auth_changed':
      // 扩展不消费自己发出的镜像
      return
    case 'request_extension_connect':
      // 扩展自己发出的请求，忽略
      return
    case 'website_connect_ack':
      if (connectWaiter && !connectWaiter.acked) {
        connectWaiter.acked = true
        connectWaiter.onAck()
      }
      return
    case 'website_connect_result':
      if (connectWaiter) {
        const waiter = connectWaiter
        connectWaiter = null
        waiter.onResult(msg.payload.status)
      }
      return
    default: {
      const _exhaustive: never = msg
      void _exhaustive
    }
  }
}

function handlePortMessage(raw: unknown): void {
  const parsed = UiBridgeEnvelopeSchema.safeParse(raw)
  if (!parsed.success) {
    logger.warn('Auth', 'UI 桥信封无效', { issues: parsed.error.issues.length })
    return
  }
  void handleInnerMessage(parsed.data.msg)
}

async function onPortConnected(port: chrome.runtime.Port): Promise<void> {
  if (port.name !== UI_BRIDGE_PORT_NAME) {
    try {
      port.disconnect()
    } catch {
      // ignore
    }
    return
  }
  const senderUrl = port.sender?.url
  if (!isExternallyConnectableOrigin(senderUrl)) {
    logger.warn('Auth', 'UI 桥拒绝非官网 Port', { url: senderUrl ?? null })
    try {
      port.disconnect()
    } catch {
      // ignore
    }
    return
  }

  ports.add(port)
  port.onMessage.addListener(handlePortMessage)
  port.onDisconnect.addListener(() => {
    // 消费 bfcache / 页关闭等导致的 lastError，避免 Unchecked runtime.lastError 红点
    void chrome.runtime.lastError
    ports.delete(port)
  })

  postEnvelope(port, { type: 'bridge_hello', payload: { role: 'extension' } })
  postEnvelope(port, await buildExtensionAuthChangedMessage())
  logger.info('Auth', 'UI 桥 Port 已连接', { ports: ports.size })
}

function registerStorageBroadcast(): void {
  if (storageWatchRegistered) {
    return
  }
  storageWatchRegistered = true
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !(AUTH_SESSION_STORAGE_KEY in changes)) {
      return
    }
    void buildExtensionAuthChangedMessage().then(msg => {
      broadcast(msg)
    })
  })
}

/** 注册 onConnectExternal（幂等）。 */
export function registerUiBridgeListener(): void {
  if (listenerRegistered) {
    return
  }
  listenerRegistered = true
  registerStorageBroadcast()
  chrome.runtime.onConnectExternal.addListener(port => {
    void onPortConnected(port)
  })
}

/** 测试用。 */
export function resetUiBridgeListenerForTests(): void {
  listenerRegistered = false
  storageWatchRegistered = false
  ports.clear()
  connectWaiter = null
}

/** 测试 / 诊断：当前 Port 数。 */
export function getUiBridgePortCountForTests(): number {
  return ports.size
}

/** 测试：直接处理信封。 */
export async function applyUiBridgeEnvelopeForTests(envelope: UiBridgeEnvelope): Promise<void> {
  const parsed = UiBridgeEnvelopeSchema.parse(envelope)
  await handleInnerMessage(parsed.msg)
}
