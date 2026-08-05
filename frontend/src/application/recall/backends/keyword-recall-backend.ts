/**
 * 当前主链路后端：理解层（网关 + 门禁 + 规则/LLM）→ 多轮槽位 merge → 关键词 Filter。
 * 网关拒绝噪音时直接空态，不扫库、不调 LLM。
 * 无 LLM completer 时 semantic 降级规则；不改变 Filter 内核。
 * lexical 无命中且线索像口语时：有条件升一次 semantic 再理解 / 再 merge / 再 Filter。
 */

import { memoryItemService } from '@/application/memory/memory-item-service'
import { applyCurrentTabDomainBoost } from '@/application/recall/apply-current-tab-domain-boost'
import { createRecallFlowTrace } from '@/application/recall/create-recall-flow-trace'
import { getClueLlmCompleter } from '@/application/recall/clue-llm-completer-registry'
import type { RecallBackend, RecallWithClueOptions } from '@/application/recall/recall-backend'
import { buildRecallResult } from '@/core/recall/build-recall-result'
import {
  excludeDismissedMemoryItems,
  mergeRecallDialogTurn
} from '@/core/recall/merge-recall-dialog-turn'
import { recallByKeywordWithParsedClue } from '@/core/recall/orchestrate-keyword-recall'
import type { ParsedRecallClue } from '@/core/recall/parse-recall-clue-types'
import type { RecallResult } from '@/core/recall/recall-result'
import { shouldEscalateLexicalNoMatch } from '@/core/recall/understand/select-clue-understanding-mode'
import { understandRecallClue } from '@/core/recall/understand/understand-recall-clue'

export const RECALL_SCAN_LIMIT = 10000

function attachDialogMeta(
  result: RecallResult,
  meta: { parsed: ParsedRecallClue; effectiveClue: string; clue: string }
): RecallResult {
  return {
    ...result,
    clue: meta.clue,
    parsed: meta.parsed,
    effectiveClue: meta.effectiveClue
  }
}

function withDomainBoost(
  result: RecallResult,
  displayClue: string,
  currentTabDomain: string | undefined
): RecallResult {
  const matches = applyCurrentTabDomainBoost(
    [...(result.topPick ? [result.topPick] : []), ...result.alsoPossible],
    currentTabDomain
  )
  if (matches.length === 0) {
    return result
  }
  matches.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score
    }
    return b.item.updatedAt.localeCompare(a.item.updatedAt)
  })
  return buildRecallResult(displayClue, matches)
}

export class KeywordRecallBackend implements RecallBackend {
  async recallWithClue(clue: string, options?: RecallWithClueOptions): Promise<RecallResult> {
    const trace = createRecallFlowTrace()
    const pipelineStartedAt = Date.now()
    const normalizedClue = clue.trim()
    const context = options?.context
    const priorUserUtterances = context?.priorUserUtterances ?? []
    const accumulated = context?.accumulated ?? null
    const dismissedIds = context?.dismissedIds ?? []
    const currentTabDomain = context?.currentTabDomain

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
      scanLimit: RECALL_SCAN_LIMIT,
      priorCount: priorUserUtterances.length,
      hasAccumulated: Boolean(accumulated),
      dismissedCount: dismissedIds.length,
      currentTabDomain: currentTabDomain ?? null
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

    let merge = mergeRecallDialogTurn({
      accumulated,
      currentParsed: understood.parsed,
      priorUserUtterances,
      currentUtterance: normalizedClue
    })

    trace('info', 'Recall：槽位 merge', {
      mergeMode: merge.mergeMode,
      effectiveClue: merge.effectiveRaw,
      contentTerms: merge.merged.contentTerms,
      timeLabel: merge.merged.timeRange?.label ?? null,
      objectTypes: merge.merged.objectTypes ?? null,
      noteHint: merge.merged.noteHint ?? false
    })

    trace('info', 'Recall：加载 MemoryItem', { limit: RECALL_SCAN_LIMIT })
    const listed = await memoryItemService.list({ limit: RECALL_SCAN_LIMIT })
    const items = excludeDismissedMemoryItems(listed, dismissedIds)
    trace('info', 'Recall：MemoryItem 已加载', {
      itemCount: listed.length,
      afterDismissExclude: items.length
    })

    let result = withDomainBoost(
      recallByKeywordWithParsedClue(items, normalizedClue, {
        candidateLimit: 6,
        parsed: merge.merged
      }),
      normalizedClue,
      currentTabDomain
    )

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
      understood = await understandRecallClue(normalizedClue, {
        ...(complete ? { complete } : {}),
        forceMode: 'semantic',
        trace
      })
      if (understood.disposition === 'proceed') {
        merge = mergeRecallDialogTurn({
          accumulated,
          currentParsed: understood.parsed,
          priorUserUtterances,
          currentUtterance: normalizedClue
        })
        result = withDomainBoost(
          recallByKeywordWithParsedClue(items, normalizedClue, {
            candidateLimit: 6,
            parsed: merge.merged
          }),
          normalizedClue,
          currentTabDomain
        )
        trace('info', 'Recall：升 semantic 后重搜', {
          understandSource: understood.source,
          effectiveClue: merge.effectiveRaw,
          outcome: result.outcome,
          topPickId: result.topPick?.item.id ?? null
        })
      }
    }

    const withMeta = attachDialogMeta(result, {
      clue: normalizedClue,
      parsed: merge.merged,
      effectiveClue: merge.effectiveRaw
    })

    trace('info', 'Recall：流水线结束', {
      durationMs: Date.now() - pipelineStartedAt,
      disposition: understood.disposition,
      understandSource: understood.source,
      understandMode: understood.mode,
      mergeMode: merge.mergeMode,
      effectiveClue: merge.effectiveRaw,
      escalatedFromLexicalMiss: canEscalate,
      outcome: withMeta.outcome,
      topPickId: withMeta.topPick?.item.id ?? null,
      topPickScore: withMeta.topPick?.score ?? null,
      alsoPossibleCount: withMeta.alsoPossible.length
    })

    return withMeta
  }
}
