import type { LocalProfile } from '@/core/identity/local-profile'
import { BACKGROUND_MESSAGE_SCOPE } from '@/core/messaging/constants'
import type {
  MemoryBackgroundMessage,
  MemoryBackgroundResponse
} from '@/core/messaging/memory-messages'
import type {
  RecallBackgroundMessage,
  RecallBackgroundResponse
} from '@/core/messaging/recall-messages'

export { BACKGROUND_MESSAGE_SCOPE }

/** 读取本地身份与当前 ownerId。 */
export type GetLocalIdentityMessage = {
  scope: typeof BACKGROUND_MESSAGE_SCOPE
  type: 'GET_LOCAL_IDENTITY'
}

export type GetLocalIdentityResponse =
  | {
      ok: true
      profile: LocalProfile
      ownerId: string
    }
  | {
      ok: false
      error: string
    }

/** Background 存活探测。 */
export type PingBackgroundMessage = {
  scope: typeof BACKGROUND_MESSAGE_SCOPE
  type: 'PING'
}

export type PingBackgroundResponse = {
  ok: true
}

export type BackgroundMessage =
  | GetLocalIdentityMessage
  | PingBackgroundMessage
  | MemoryBackgroundMessage
  | RecallBackgroundMessage

export type BackgroundMessageResponse =
  | GetLocalIdentityResponse
  | PingBackgroundResponse
  | MemoryBackgroundResponse
  | RecallBackgroundResponse

/** 判断是否为 Background scope 消息。 */
export function isBackgroundScopedMessage(
  value: unknown
): value is { scope: typeof BACKGROUND_MESSAGE_SCOPE; type: string } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'scope' in value &&
    value.scope === BACKGROUND_MESSAGE_SCOPE &&
    'type' in value &&
    typeof value.type === 'string'
  )
}
