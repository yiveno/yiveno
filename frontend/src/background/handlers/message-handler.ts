import type {
  BackgroundMessage,
  BackgroundMessageResponse,
  GetLocalIdentityResponse
} from '@/core/messaging/background-messages'
import { logger } from '@/infrastructure/logging/logger'
import {
  getCurrentOwnerId,
  getOrCreateLocalProfile
} from '@/infrastructure/identity/local-profile-service'

function isBackgroundMessage(value: unknown): value is BackgroundMessage {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  return (
    'scope' in value &&
    value.scope === 'background' &&
    'type' in value &&
    typeof value.type === 'string'
  )
}

async function handleGetLocalIdentity(): Promise<GetLocalIdentityResponse> {
  try {
    const [profile, ownerId] = await Promise.all([getOrCreateLocalProfile(), getCurrentOwnerId()])
    return { ok: true, profile, ownerId }
  } catch (error) {
    logger.error('Background', '读取本地身份失败', error)
    return {
      ok: false,
      error: error instanceof Error ? error.message : '读取本地身份失败'
    }
  }
}

/**
 * 处理来自 Popup / Settings 的 Background 消息。
 * 异步 handler 需返回 true 以保持 sendResponse 通道。
 */
export function handleBackgroundMessage(
  message: unknown,
  sendResponse: (response: BackgroundMessageResponse) => void
): boolean {
  if (!isBackgroundMessage(message)) {
    return false
  }

  if (message.type === 'PING') {
    sendResponse({ ok: true })
    return true
  }

  if (message.type === 'GET_LOCAL_IDENTITY') {
    void handleGetLocalIdentity().then(sendResponse)
    return true
  }

  return false
}
