/**
 * Offscreen Document 消息分发：PING 探活 + 语音听写。
 */

import {
  isOffscreenRunSpeechDictationMessage,
  type OffscreenSpeechDictationResponse
} from '@/core/messaging/offscreen-speech'
import { runOffscreenSpeechDictation } from '@/offscreen/run-speech-dictation'

/** Offscreen Document 探活消息。 */
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
 * 处理 runtime 消息；命中时 sendResponse 并返回 true 保持通道（MV3 约定）。
 */
export function handleOffscreenRuntimeMessage(
  message: unknown,
  sendResponse: (response: { ok: true } | OffscreenSpeechDictationResponse) => void
): boolean {
  if (isOffscreenPingMessage(message)) {
    sendResponse({ ok: true })
    return true
  }

  if (isOffscreenRunSpeechDictationMessage(message)) {
    void runOffscreenSpeechDictation(message.payload.lang)
      .then(response => {
        sendResponse(response)
      })
      .catch(error => {
        sendResponse({
          ok: false,
          error: 'failed',
          message: error instanceof Error ? error.message : String(error)
        })
      })
    return true
  }

  return false
}
