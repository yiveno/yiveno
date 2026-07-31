import { memoryItemService } from '@/application/memory/memory-item-service'
import { getClueLlmCompleter } from '@/application/recall/clue-llm-completer-registry'
import { recallByKeywordWithParsedClue } from '@/core/recall/orchestrate-keyword-recall'
import type { RecallResult } from '@/core/recall/recall-result'
import { understandRecallClue } from '@/core/recall/understand/understand-recall-clue'
import { logger } from '@/infrastructure/logging/logger'

import type { RecallBackend } from '@/application/recall/recall-backend'

/**
 * 当前主链路后端：理解层（门禁 + 规则/LLM）→ 关键词 Filter + 约束软加权。
 * 无 LLM completer 时 semantic 降级规则；不改变 Filter 内核。
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

    const complete = getClueLlmCompleter() ?? undefined
    const understood = await understandRecallClue(normalizedClue, {
      ...(complete ? { complete } : {})
    })

    logger.info('RecallUnderstand', '线索理解结果', {
      mode: understood.mode,
      source: understood.source,
      searchClue: understood.searchClue,
      timeLabel: understood.parsed.timeRange?.label,
      objectTypes: understood.parsed.objectTypes,
      contentTerms: understood.parsed.contentTerms,
      confidence: understood.parsed.confidence,
      hasLlmCompleter: Boolean(complete)
    })

    const items = await memoryItemService.list({ limit: RECALL_SCAN_LIMIT })
    return recallByKeywordWithParsedClue(items, normalizedClue, {
      candidateLimit: 6,
      parsed: understood.parsed
    })
  }
}
