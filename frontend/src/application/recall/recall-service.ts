import { memoryItemService } from '@/application/memory/memory-item-service'
import { recallByKeyword } from '@/core/recall/build-recall-result'
import type { RecallResult } from '@/core/recall/recall-result'

/** Recall 读取的最大 MemoryItem 数量（MVP 本地关键词 Filter）。 */
const RECALL_SCAN_LIMIT = 2000

/**
 * Recall 应用服务。
 * MVP 阶段使用关键词 Filter；语义召回后续接入。
 */
export class RecallService {
  /** 根据模糊线索在本机 MemoryItem 中找回最可能结果。 */
  async recallWithClue(clue: string): Promise<RecallResult> {
    const normalizedClue = clue.trim()
    if (!normalizedClue) {
      return {
        outcome: 'no_match',
        topPick: null,
        alsoPossible: [],
        clue: ''
      }
    }

    const items = await memoryItemService.list({ limit: RECALL_SCAN_LIMIT })
    return recallByKeyword(items, normalizedClue, { candidateLimit: 6 })
  }
}

export const recallService = new RecallService()
