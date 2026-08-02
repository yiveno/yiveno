/**
 * 当前主链路后端：理解层（网关 + 门禁 + 规则/LLM）→ 关键词 Filter + 约束软加权。
 * 网关拒绝噪音时直接空态，不扫库、不调 LLM。
 * 无 LLM completer 时 semantic 降级规则；不改变 Filter 内核。
 * lexical 无命中且线索像口语时：有条件升一次 semantic 再理解 / 再 Filter（仍不碰数据平面）。
 */

import { memoryItemService } from '@/application/memory/memory-item-service'
import { createRecallFlowTrace } from '@/application/recall/create-recall-flow-trace'
import { getClueLlmCompleter } from '@/application/recall/clue-llm-completer-registry'
import { recallByKeywordWithParsedClue } from '@/core/recall/orchestrate-keyword-recall'
import type { RecallResult } from '@/core/recall/recall-result'
import { shouldEscalateLexicalNoMatch } from '@/core/recall/understand/select-clue-understanding-mode'
import { understandRecallClue } from '@/core/recall/understand/understand-recall-clue'

import type { RecallBackend } from '@/application/recall/recall-backend'

export const RECALL_SCAN_LIMIT = 10000

export class KeywordRecallBackend implements RecallBackend {
  async recallWithClue(clue: string): Promise<RecallResult> {
    const trace = createRecallFlowTrace()
    const pipelineStartedAt = Date.now()
    const normalizedClue = clue.trim()

    if (!normalizedClue) {
      trace('info', 'Recall：空线索，直接 no_match')
      return {
        outcome: 'no_match',
        topPick: null,
        alsoPossible: [],
        clue: ''
      }
    }

    trace('info', 'Recall：流水线开始', {
      clue: normalizedClue,
      scanLimit: RECALL_SCAN_LIMIT
    })

    const complete = getClueLlmCompleter() ?? undefined
    trace('info', 'Recall：completer 状态', {
      hasLlmCompleter: Boolean(complete)
    })

    let understood = await understandRecallClue(normalizedClue, {
      ...(complete ? { complete } : {}),
      trace
    })

    if (understood.disposition === 'reject_noise') {
      trace('info', 'Recall：网关拒绝噪音，跳过扫库', {
        disposition: understood.disposition,
        rejectReason: understood.rejectReason,
        durationMs: Date.now() - pipelineStartedAt
      })
      return {
        outcome: 'no_match',
        topPick: null,
        alsoPossible: [],
        clue: normalizedClue
      }
    }

    trace('info', 'Recall：加载 MemoryItem', { limit: RECALL_SCAN_LIMIT })
    const items = await memoryItemService.list({ limit: RECALL_SCAN_LIMIT })
    trace('info', 'Recall：MemoryItem 已加载', { itemCount: items.length })

    let result = recallByKeywordWithParsedClue(items, normalizedClue, {
      candidateLimit: 6,
      parsed: understood.parsed
    })

    const canEscalate =
      result.outcome === 'no_match' &&
      understood.mode === 'lexical' &&
      understood.source === 'rules' &&
      Boolean(complete) &&
      shouldEscalateLexicalNoMatch(normalizedClue)

    if (canEscalate) {
      trace('info', 'Recall：lexical 无命中，升 semantic 再理解', {
        searchClue: understood.searchClue,
        contentTerms: understood.parsed.contentTerms
      })
      // 条件展开：exactOptionalPropertyTypes 禁止 complete: undefined
      understood = await understandRecallClue(normalizedClue, {
        ...(complete ? { complete } : {}),
        forceMode: 'semantic',
        trace
      })
      if (understood.disposition === 'proceed') {
        result = recallByKeywordWithParsedClue(items, normalizedClue, {
          candidateLimit: 6,
          parsed: understood.parsed
        })
        trace('info', 'Recall：升 semantic 后重搜', {
          understandSource: understood.source,
          searchClue: understood.searchClue,
          outcome: result.outcome,
          topPickId: result.topPick?.item.id ?? null
        })
      }
    }

    trace('info', 'Recall：流水线结束', {
      durationMs: Date.now() - pipelineStartedAt,
      disposition: understood.disposition,
      understandSource: understood.source,
      understandMode: understood.mode,
      searchClue: understood.searchClue,
      escalatedFromLexicalMiss: canEscalate,
      outcome: result.outcome,
      topPickId: result.topPick?.item.id ?? null,
      topPickScore: result.topPick?.score ?? null,
      alsoPossibleCount: result.alsoPossible.length
    })

    return result
  }
}
