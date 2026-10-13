/** Offscreen Document 探活消息（占位，embedding 接入前仅 PING）。 */
export interface OffscreenPingMessage {
  scope: 'offscreen'
  type: 'PING'
}

/** 是否为 offscreen 探活 PING。 */
export function isOffscreenPingMessage(message: unknown): message is OffscreenPingMessage {
  return (
    typeof message === 'object' &&
    message !== null &&
    'scope' in message &&
    message.scope === 'offscreen' &&
    'type' in message &&
    message.type === 'PING'
  )
}

/**
 * 处理 runtime 消息；命中 PING 时 sendResponse 并返回 true 保持通道（MV3 约定）。
 */
export function handleOffscreenRuntimeMessage(
  message: unknown,
  sendResponse: (response: { ok: true }) => void
): boolean {
  if (!isOffscreenPingMessage(message)) {
    return false
  }

  sendResponse({ ok: true })
  return true
}
