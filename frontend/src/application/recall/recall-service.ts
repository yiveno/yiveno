/**
 * Recall 应用服务（UI/消息入口）。
 *
 * 将实际 Recall 逻辑下沉为 RecallBackend，使未来接入 Hybrid/embedding/索引时
 * 只需要新增后端与索引实现，而不是在 UI/handler/core 主链路里到处分支。
 */
import { HybridRecallBackend } from '@/application/recall/backends/hybrid-recall-backend'
import { KeywordRecallBackend } from '@/application/recall/backends/keyword-recall-backend'
import type { RecallBackend, RecallWithClueOptions } from '@/application/recall/recall-backend'
import type { RecallResult } from '@/core/recall/recall-result'

/** Recall 后端模式（当前默认 keyword）。 */
type RecallBackendMode =
  | 'keyword' // 关键词 Filter
  | 'hybrid' // 混合（未默认启用）

const RECALL_BACKEND_MODE: RecallBackendMode = 'keyword'

function createRecallBackend(): RecallBackend {
  switch (RECALL_BACKEND_MODE) {
    case 'hybrid':
      return new HybridRecallBackend()
    case 'keyword':
    default:
      // 当前主链路：KeywordRecallBackend（保持与旧逻辑一致）
      return new KeywordRecallBackend()
  }
}

export class RecallService {
  constructor(private readonly backend: RecallBackend) {}

  /** 根据模糊线索在本机 MemoryItem 中找回最可能结果（可选多轮 context）。 */
  async recallWithClue(clue: string, options?: RecallWithClueOptions): Promise<RecallResult> {
    return this.backend.recallWithClue(clue, options)
  }
}

export const recallService = new RecallService(createRecallBackend())
