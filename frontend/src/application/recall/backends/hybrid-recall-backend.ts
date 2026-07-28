import type { RecallResult } from '@/core/recall/recall-result'

import type { RecallBackend } from '@/application/recall/recall-backend'

/**
 * Hybrid/embedding/索引检索后端骨架（当前未启用）。
 *
 * 设计目的：未来接入 Hybrid 时，只新增后端与候选来源/索引实现，
 * 并在 RecallService 的后端工厂里切换，不影响 UI / handlers / core。
 */
export class HybridRecallBackend implements RecallBackend {
  async recallWithClue(_clue: string): Promise<RecallResult> {
    // 当前 Phase：Hybrid 未启用。保持显式失败，避免“悄悄回退 keyword”掩盖未上线能力。
    throw new Error('HYBRID_RECALL_NOT_ENABLED')
  }
}
