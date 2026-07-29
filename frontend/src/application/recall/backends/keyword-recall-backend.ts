import { memoryItemService } from '@/application/memory/memory-item-service'
import { recallByKeywordWithParsedClue } from '@/core/recall/orchestrate-keyword-recall'
import type { RecallResult } from '@/core/recall/recall-result'

import type { RecallBackend } from '@/application/recall/recall-backend'

/**
 * 当前主链路后端：关键词 Filter + P0 口语线索编排（规则解析 / 软加权）。
 * 无结构信号时检索串≈原文，行为接近旧 keyword-only；有时间/类型/备注等信号时叠加约束。
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
    return recallByKeywordWithParsedClue(items, normalizedClue, { candidateLimit: 6 })
  }
}
