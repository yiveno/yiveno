import { z } from 'zod'

import type { LocalProfile } from '@/core/identity/local-profile'
import { BACKGROUND_MESSAGE_SCOPE } from '@/core/messaging/constants'
import type {
  CommandsBackgroundMessage,
  CommandsBackgroundResponse
} from '@/core/messaging/commands-messages'
import type {
  ImportBackgroundMessage,
  ImportBackgroundResponse
} from '@/core/messaging/import-messages'
import type {
  MemoryBackgroundMessage,
  MemoryBackgroundResponse
} from '@/core/messaging/memory-messages'
import type {
  RecallBackgroundMessage,
  RecallBackgroundResponse
} from '@/core/messaging/recall-messages'
import type {
  SettingsBackgroundMessage,
  SettingsBackgroundResponse
} from '@/core/messaging/settings-messages'

export { BACKGROUND_MESSAGE_SCOPE }

/** 本地身份读取失败。 */
export const IdentityErrorCodeSchema = z.enum(['IDENTITY_READ_FAILED'])

export type IdentityErrorCode = z.infer<typeof IdentityErrorCodeSchema>

/** 消息分发层失败（未知 type / 未捕获异常）。 */
export const DispatchErrorCodeSchema = z.enum(['UNKNOWN_MESSAGE_TYPE', 'MESSAGE_DISPATCH_FAILED'])

export type DispatchErrorCode = z.infer<typeof DispatchErrorCodeSchema>

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
      errorCode: IdentityErrorCode
      error?: string
    }

/** Background 存活探测。 */
export type PingBackgroundMessage = {
  scope: typeof BACKGROUND_MESSAGE_SCOPE
  type: 'PING'
}

export type PingBackgroundResponse = {
  ok: true
}

/** 消息分发失败响应（不对应单一业务 type）。 */
export type BackgroundDispatchErrorResponse = {
  ok: false
  errorCode: DispatchErrorCode
  error?: string
}

export type BackgroundMessage =
  | GetLocalIdentityMessage
  | PingBackgroundMessage
  | MemoryBackgroundMessage
  | RecallBackgroundMessage
  | ImportBackgroundMessage
  | CommandsBackgroundMessage
  | SettingsBackgroundMessage

export type BackgroundMessageResponse =
  | GetLocalIdentityResponse
  | PingBackgroundResponse
  | MemoryBackgroundResponse
  | RecallBackgroundResponse
  | ImportBackgroundResponse
  | CommandsBackgroundResponse
  | SettingsBackgroundResponse
  | BackgroundDispatchErrorResponse

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
