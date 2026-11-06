import type { RecallDialogContext } from '@/core/messaging/recall-messages'
import type { RecallResult } from '@/core/recall/recall-result'
import type { RecallVisibleProgressStage } from '@/core/recall/visible-progress'

/**
 * Recall 后端：把 “给定线索 clue，返回 RecallResult” 作为唯一契约。
 *
 * 目标：默认 HybridRecallBackend（有向量则融合；无则后端内降级关键词）。
 * 仅新增 backend，不改 UI / handlers / core 的主链路。
 */
/**
 * Recall 入口（ADR-007 · ADR-021）。
 * - sidepanel：完整 Hybrid + 理解 + framing（默认；履约假定在线）
 * - omnibox：本机快跳（规则 parse + Filter；无向量/LLM；延迟与壳约束，非离线产品）
 * - mcp：本机 MCP；与 sidepanel 同轨（调用方显式传或省略默认）
 */
export type RecallEntryPoint = 'sidepanel' | 'omnibox' | 'mcp'

export type RecallWithClueOptions = {
  /** Side Panel 多轮上下文；Omnibox 不传。 */
  context?: RecallDialogContext
  /** 入口分轨；缺省 sidepanel。 */
  entry?: RecallEntryPoint
  /**
   * 真实 pipeline 阶段回调（§7.0 可见进展）。
   * 仅 Side Panel 路径注入；Omnibox 不推。
   */
  onVisibleProgress?: (stage: RecallVisibleProgressStage) => void
}

export interface RecallBackend {
  recallWithClue(clue: string, options?: RecallWithClueOptions): Promise<RecallResult>
}
