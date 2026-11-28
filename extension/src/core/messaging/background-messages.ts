import { z } from 'zod'

import type {
  AccountSyncBackgroundMessage,
  AccountSyncBackgroundResponse
} from '@/core/messaging/account-sync-messages'
import { BACKGROUND_MESSAGE_SCOPE } from '@/core/messaging/constants'
import type {
  CommandsBackgroundMessage,
  CommandsBackgroundResponse
} from '@/core/messaging/commands-messages'
import type {
  DebugBackgroundMessage,
  DebugBackgroundResponse
} from '@/core/messaging/debug-messages'
import type {
  ImportBackgroundMessage,
  ImportBackgroundResponse
} from '@/core/messaging/import-messages'
import type { McpBackgroundMessage, McpBackgroundResponse } from '@/core/messaging/mcp-messages'
import type {
  MemoryBackgroundMessage,
  MemoryBackgroundResponse
} from '@/core/messaging/memory-messages'
import type {
  GetRecallPageContextResponse,
  PortraitMutationResponse,
  RecallBackgroundMessage,
  RecallBackgroundResponse,
  RecallCancelResponse,
  ResolveClueUrlDisplayResponse
} from '@/core/messaging/recall-messages'
import type {
  SettingsBackgroundMessage,
  SettingsBackgroundResponse
} from '@/core/messaging/settings-messages'
import type {
  DualThreadBackgroundMessage,
  DualThreadBackgroundResponse
} from '@/core/messaging/dual-thread-messages'
import type {
  DailyReviewBackgroundMessage,
  DailyReviewBackgroundResponse
} from '@/core/messaging/daily-review-messages'

export { BACKGROUND_MESSAGE_SCOPE }

/** 消息分发层失败（未知 type / 未捕获异常）。 */
export const DispatchErrorCodeSchema = z.enum([
  'UNKNOWN_MESSAGE_TYPE', // 未知消息 type
  'MESSAGE_DISPATCH_FAILED' // 分发未捕获异常
])

export type DispatchErrorCode = z.infer<typeof DispatchErrorCodeSchema>

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
  | PingBackgroundMessage
  | MemoryBackgroundMessage
  | RecallBackgroundMessage
  | McpBackgroundMessage
  | ImportBackgroundMessage
  | CommandsBackgroundMessage
  | SettingsBackgroundMessage
  | DualThreadBackgroundMessage
  | DailyReviewBackgroundMessage
  | AccountSyncBackgroundMessage
  | DebugBackgroundMessage

export type BackgroundMessageResponse =
  | PingBackgroundResponse
  | MemoryBackgroundResponse
  | RecallBackgroundResponse
  | RecallCancelResponse
  | GetRecallPageContextResponse
  | ResolveClueUrlDisplayResponse
  | PortraitMutationResponse
  | McpBackgroundResponse
  | ImportBackgroundResponse
  | CommandsBackgroundResponse
  | SettingsBackgroundResponse
  | DualThreadBackgroundResponse
  | DailyReviewBackgroundResponse
  | AccountSyncBackgroundResponse
  | DebugBackgroundResponse
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
