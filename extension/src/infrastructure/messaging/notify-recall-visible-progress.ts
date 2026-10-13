import type { RecallVisibleProgressMessage } from '@/core/messaging/ui-messages'
import { UI_MESSAGE_SCOPE } from '@/core/messaging/ui-messages'
import type { RecallVisibleProgressStage } from '@/core/recall/visible-progress'
import { logger } from '@/infrastructure/logging/logger'

/**
 * 向已打开的扩展页广播 Recall 可见进展阶段。
 * 无接收方时 Chrome 会 reject，属正常，静默忽略。
 */
export function notifyRecallVisibleProgress(input: {
  progressRequestId: string
  stage: RecallVisibleProgressStage
}): void {
  const message: RecallVisibleProgressMessage = {
    scope: UI_MESSAGE_SCOPE,
    type: 'RECALL_VISIBLE_PROGRESS',
    payload: {
      progressRequestId: input.progressRequestId,
      stage: input.stage
    }
  }
  try {
    void chrome.runtime.sendMessage(message).catch(() => {
      // 无监听页：忽略
    })
  } catch {
    // 测试环境或 runtime 不可用：忽略
  }
  logger.info('Recall', '可见进展阶段', {
    progressRequestId: input.progressRequestId,
    stage: input.stage
  })
}
