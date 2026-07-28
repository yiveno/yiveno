import type { RecallResult } from '@/core/recall/recall-result'

/**
 * Recall 后端：把 “给定线索 clue，返回 RecallResult” 作为唯一契约。
 *
 * 目标：
 * - 当前：KeywordRecallBackend（关键词 Filter + 结果态构建）
 * - 未来：Hybrid/embedding/索引检索等，仅新增 backend，不改 UI/handler/core 的主链路
 */
export interface RecallBackend {
  recallWithClue(clue: string): Promise<RecallResult>
}
