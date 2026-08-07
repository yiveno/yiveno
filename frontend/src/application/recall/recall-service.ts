/**
 * Recall 应用服务（UI/消息入口）。
 *
 * 本机优先 Hybrid（有向量则语义融合）；无向量时后端内部降级关键词。
 * Free/Pro 召回质量同档；Pro 差异在同步与 LLM 配额。
 */
import { HybridRecallBackend } from '@/application/recall/backends/hybrid-recall-backend'
import type { RecallWithClueOptions } from '@/application/recall/recall-backend'
import type { RecallResult } from '@/core/recall/recall-result'
import { flowOk, flowStart } from '@/infrastructure/logging/flow-log'

const hybridBackend = new HybridRecallBackend()

export class RecallService {
  /** 根据模糊线索在本机 MemoryItem 中找回最可能结果（可选多轮 context）。 */
  async recallWithClue(clue: string, options?: RecallWithClueOptions): Promise<RecallResult> {
    const startedAt = flowStart('Recall', '选型后端')
    flowOk('Recall', '选型后端', startedAt, { mode: 'hybrid' })
    return hybridBackend.recallWithClue(clue, options)
  }
}

export const recallService = new RecallService()
