/**
 * Recall 应用服务（UI/消息入口）。
 *
 * 入口分轨（ADR-007）：Side Panel / MCP = 完整 Hybrid；Omnibox = 离线字段快跳。
 * Free/Pro 召回质量同档；Pro 差异在同步与 LLM 配额。
 */
import { HybridRecallBackend } from '@/application/recall/backends/hybrid-recall-backend'
import type { RecallWithClueOptions } from '@/application/recall/recall-backend'
import type { RecallResult } from '@/core/recall/recall-result'
import { flowOk, flowStart } from '@/infrastructure/logging/flow-log'

const hybridBackend = new HybridRecallBackend()

export class RecallService {
  /** 根据线索在本机 MemoryItem 中找回（可选多轮 context 与入口分轨）。 */
  async recallWithClue(clue: string, options?: RecallWithClueOptions): Promise<RecallResult> {
    const entry = options?.entry ?? 'sidepanel'
    const startedAt = flowStart('Recall', '选型后端')
    flowOk('Recall', '选型后端', startedAt, {
      mode: entry === 'omnibox' ? 'omnibox_offline' : 'hybrid',
      entry
    })
    return hybridBackend.recallWithClue(clue, options)
  }
}

export const recallService = new RecallService()
