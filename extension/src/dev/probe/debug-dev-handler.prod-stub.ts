/**
 * production 构建替身：DEV_* 探针 handler 不进 CWS 包。
 */

import type { BackgroundMessage } from '@/core/messaging/background-messages'
import type { DebugBackgroundResponse } from '@/core/messaging/debug-messages'

export async function handleDebugBackgroundMessage(
  message: Extract<BackgroundMessage, { type: `DEV_${string}` }>
): Promise<DebugBackgroundResponse> {
  return {
    ok: false,
    errorCode: 'DEV_ONLY',
    error: `${message.type} 仅开发构建可用`
  }
}
