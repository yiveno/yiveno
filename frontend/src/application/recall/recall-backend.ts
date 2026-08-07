import type { RecallDialogContext } from '@/core/messaging/recall-messages'
import type { RecallResult } from '@/core/recall/recall-result'

/**
 * Recall 后端：把 “给定线索 clue，返回 RecallResult” 作为唯一契约。
 *
 * 目标：默认 HybridRecallBackend（有向量则融合；无则后端内降级关键词）。
 * 仅新增 backend，不改 UI / handlers / core 的主链路。
 */
export type RecallWithClueOptions = {
  /** Popup 多轮上下文；Omnibox / 单测可省略。 */
  context?: RecallDialogContext
}

export interface RecallBackend {
  recallWithClue(clue: string, options?: RecallWithClueOptions): Promise<RecallResult>
}
