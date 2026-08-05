/**
 * Recall 应用服务（UI/消息入口）。
 *
 * Pro + 有效订阅 → Hybrid；否则关键词。每次调用按本地快照选型。
 */
import { HybridRecallBackend } from '@/application/recall/backends/hybrid-recall-backend'
import { KeywordRecallBackend } from '@/application/recall/backends/keyword-recall-backend'
import type { RecallBackend, RecallWithClueOptions } from '@/application/recall/recall-backend'
import type { RecallResult } from '@/core/recall/recall-result'
import { isProActiveFromSnapshot } from '@/infrastructure/identity/subscription-service'
import { flowOk, flowStart } from '@/infrastructure/logging/flow-log'

const keywordBackend = new KeywordRecallBackend()
const hybridBackend = new HybridRecallBackend()

async function resolveRecallBackend(): Promise<RecallBackend> {
  if (await isProActiveFromSnapshot()) {
    return hybridBackend
  }
  return keywordBackend
}

export class RecallService {
  /** 根据模糊线索在本机 MemoryItem 中找回最可能结果（可选多轮 context）。 */
  async recallWithClue(clue: string, options?: RecallWithClueOptions): Promise<RecallResult> {
    const startedAt = flowStart('Recall', '选型后端')
    const backend = await resolveRecallBackend()
    const mode = backend === hybridBackend ? 'hybrid' : 'keyword'
    flowOk('Recall', '选型后端', startedAt, { mode })
    return backend.recallWithClue(clue, options)
  }
}

export const recallService = new RecallService()
