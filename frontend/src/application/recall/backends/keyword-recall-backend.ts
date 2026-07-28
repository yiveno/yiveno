import { memoryItemService } from '@/application/memory/memory-item-service'
import { recallByKeyword } from '@/core/recall/build-recall-result'
import type { RecallResult } from '@/core/recall/recall-result'

import type { RecallBackend } from '@/application/recall/recall-backend'

/**
 * 当前主链路后端：关键词 Filter。
 * 该实现必须与旧 RecallService 行为保持一致（输出完全不变）。
 */
export const RECALL_SCAN_LIMIT = 10000

export class KeywordRecallBackend implements RecallBackend {
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
