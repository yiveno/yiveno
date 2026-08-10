/**
 * Hybrid Recall：关键词候选 + embedding 近邻，经 RRF 融合。
 * 默认后端（Free/Pro 同档）；无向量 / 失败时降级关键词。
 */

import { memoryItemService } from '@/application/memory/memory-item-service'
import { createRecallFlowTrace } from '@/application/recall/create-recall-flow-trace'
import { getClueLlmCompleter } from '@/application/recall/clue-llm-completer-registry'
import type { RecallBackend, RecallWithClueOptions } from '@/application/recall/recall-backend'
import { applyCurrentTabDomainBoost } from '@/application/recall/apply-current-tab-domain-boost'
import { RECALL_SCAN_LIMIT } from '@/application/recall/backends/recall-scan-limit'
import { buildQueryEmbeddingText } from '@/core/recall/build-query-embedding-text'
import {
  buildRecallResult,
  RECALL_COLLAPSE_BACKFILL_EXTRA
} from '@/core/recall/build-recall-result'
import { collapseRecallMatches } from '@/core/recall/collapse-recall-duplicates'
import { cosineSimilarity, sortIdsByRrf } from '@/core/recall/hybrid-fusion'
import { filterMemoryItemsByKeyword } from '@/core/recall/keyword-filter'
import {
  excludeDismissedMemoryItems,
  mergeRecallDialogTurn
} from '@/core/recall/merge-recall-dialog-turn'
import { enrichEmptyRecallResult } from '@/core/recall/enrich-empty-recall-result'
import {
  applyParsedClueScoreBoosts,
  buildSearchClueFromParsed,
  filterMatchesByParsedTimeRange,
  recallByKeywordWithParsedClue
} from '@/core/recall/orchestrate-keyword-recall'
import type { ParsedRecallClue } from '@/core/recall/parse-recall-clue-types'
import type { RecallMatch, RecallResult } from '@/core/recall/recall-result'
import { getMemoryItemDisplay } from '@/core/recall/recall-result'
import { completeRecallFollowUpWithLlm } from '@/core/recall/understand/complete-recall-follow-up'
import { understandRecallClue } from '@/core/recall/understand/understand-recall-clue'
import { requestWorkerEmbeddings } from '@/infrastructure/ai/embed-api-client'
import { getAuthSession } from '@/infrastructure/identity/auth-session-service'

/** Hybrid 关键词召回池（再与向量融合）。 */
const HYBRID_KEYWORD_POOL = 100

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

function finalizeKeywordResult(
  displayClue: string,
  items: Awaited<ReturnType<typeof memoryItemService.list>>,
  parsed: ParsedRecallClue,
  currentTabDomain: string | undefined
): RecallResult {
  const base = recallByKeywordWithParsedClue(items, displayClue, {
    candidateLimit: 6,
    parsed
  })
  const matches = applyCurrentTabDomainBoost(
    [...(base.topPick ? [base.topPick] : []), ...base.alsoPossible],
    currentTabDomain
  )
  matches.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score
    }
    return b.item.updatedAt.localeCompare(a.item.updatedAt)
  })
  return buildRecallResult(displayClue, matches)
}

/**
 * need_a_clue / no_match 时尝试 LLM 追问；失败静默降级（不写 assistantFollowUp）。
 * 计入与理解层同一 hosted/clue completer 配额桶。
 */
async function attachLlmFollowUpIfNeeded(
  result: RecallResult,
  input: {
    complete: NonNullable<ReturnType<typeof getClueLlmCompleter>>
    clue: string
    parsed: ParsedRecallClue
    trace: ReturnType<typeof createRecallFlowTrace>
  }
): Promise<RecallResult> {
  if (result.outcome !== 'need_a_clue' && result.outcome !== 'no_match') {
    return result
  }

  const weakCandidateTitles =
    result.outcome === 'need_a_clue'
      ? result.alsoPossible.slice(0, 3).map(match => {
          const display = getMemoryItemDisplay(match.item, () => '')
          return display.title || display.excerpt || display.subtitle || match.item.id
        })
      : undefined

  try {
    const followUp = await completeRecallFollowUpWithLlm({
      clue: input.clue,
      parsed: input.parsed,
      outcome: result.outcome,
      ...(result.emptyKind !== undefined ? { emptyKind: result.emptyKind } : {}),
      hasRelatedGuess: Boolean(result.relatedGuess),
      ...(weakCandidateTitles !== undefined ? { weakCandidateTitles } : {}),
      complete: input.complete,
      trace: input.trace
    })
    return {
      ...result,
      assistantFollowUp: {
        source: 'llm',
        text: followUp.text,
        suggestions: followUp.suggestions
      }
    }
  } catch (error) {
    input.trace('warn', 'LLM 追问：失败，降级规则模板', {
      outcome: result.outcome,
      error: error instanceof Error ? error.message : String(error)
    })
    return result
  }
}

async function fuseHybridMatches(input: {
  displayClue: string
  items: Awaited<ReturnType<typeof memoryItemService.list>>
  searchClue: string
  parsed: ParsedRecallClue
  queryText: string
  currentTabDomain?: string
  trace: ReturnType<typeof createRecallFlowTrace>
}): Promise<RecallResult | null> {
  const session = await getAuthSession()
  if (!session?.accessToken) {
    input.trace('info', 'Hybrid：无登录态，跳过向量融合')
    return null
  }

  const keywordMatches = filterMatchesByParsedTimeRange(
    filterMemoryItemsByKeyword(input.items, input.searchClue, {
      limit: HYBRID_KEYWORD_POOL
    }).map(match => applyParsedClueScoreBoosts(match, input.parsed)),
    input.parsed
  )

  if (keywordMatches.length === 0) {
    input.trace('info', 'Hybrid：时间硬过滤后无候选，跳过融合')
    return null
  }

  const embedded = keywordMatches.filter(
    match => Array.isArray(match.item.clues.embedding) && match.item.clues.embedding.length > 0
  )
  if (embedded.length === 0) {
    input.trace('info', 'Hybrid：候选无 embedding，跳过融合')
    return null
  }

  let queryVector: number[]
  try {
    const embed = await requestWorkerEmbeddings(session.accessToken, [input.queryText])
    const vector = embed.embeddings[0]
    if (!vector?.length) {
      return null
    }
    queryVector = vector
  } catch (error) {
    input.trace('info', 'Hybrid：query embed 失败，降级关键词', {
      error: error instanceof Error ? error.message : String(error)
    })
    return null
  }

  const keywordOrder = keywordMatches.map(match => match.item.id)
  const semanticOrder = [...embedded]
    .map(match => ({
      id: match.item.id,
      sim: cosineSimilarity(queryVector, match.item.clues.embedding ?? [])
    }))
    .sort((a, b) => b.sim - a.sim)
    .map(entry => entry.id)

  const fusedIds = sortIdsByRrf([keywordOrder, semanticOrder])
  const byId = new Map(keywordMatches.map(match => [match.item.id, match]))

  const fusedMatches: RecallMatch[] = []
  fusedIds.forEach((id, index) => {
    const base = byId.get(id)
    if (!base) {
      return
    }
    const rrfBoost = Math.max(0, 40 - index)
    fusedMatches.push({
      ...base,
      score: base.score + rrfBoost,
      matchedFields: base.matchedFields.includes('hybridRrf')
        ? base.matchedFields
        : [...base.matchedFields, 'hybridRrf']
    })
  })

  const boosted = applyCurrentTabDomainBoost(
    fusedMatches.map(match => applyParsedClueScoreBoosts(match, input.parsed)),
    input.currentTabDomain
  )

  boosted.sort((left, right) => {
    if (right.score !== left.score) {
      return right.score - left.score
    }
    return right.item.updatedAt.localeCompare(left.item.updatedAt)
  })

  const collapsed = collapseRecallMatches(boosted, {
    limit: 6 + RECALL_COLLAPSE_BACKFILL_EXTRA
  })
  input.trace('info', 'Hybrid：RRF 融合完成', {
    keywordCount: keywordMatches.length,
    embeddedCount: embedded.length,
    fusedCount: collapsed.length
  })
  return buildRecallResult(input.displayClue, collapsed)
}

export class HybridRecallBackend implements RecallBackend {
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
      return {
        outcome: 'no_match',
        topPick: null,
        alsoPossible: [],
        clue: ''
      }
    }

    trace('info', 'Hybrid Recall：流水线开始', {
      clue: normalizedClue,
      priorCount: priorUserUtterances.length,
      dismissedCount: dismissedIds.length,
      currentTabDomain: currentTabDomain ?? null
    })

    const complete = getClueLlmCompleter() ?? undefined
    const understood = await understandRecallClue(normalizedClue, {
      ...(complete ? { complete } : {}),
      trace
    })

    if (understood.disposition === 'reject_noise') {
      return {
        outcome: 'no_match',
        topPick: null,
        alsoPossible: [],
        clue: normalizedClue
      }
    }

    const merge = mergeRecallDialogTurn({
      accumulated,
      currentParsed: understood.parsed,
      priorUserUtterances,
      currentUtterance: normalizedClue
    })

    const listed = await memoryItemService.list({ limit: RECALL_SCAN_LIMIT })
    const items = excludeDismissedMemoryItems(listed, dismissedIds)

    const queryText = buildQueryEmbeddingText({
      effectiveClue: merge.effectiveRaw,
      parsed: merge.merged,
      rawClue: normalizedClue
    })

    let usedHybrid = false
    let result =
      (await fuseHybridMatches({
        displayClue: normalizedClue,
        items,
        searchClue: buildSearchClueFromParsed(merge.merged),
        parsed: merge.merged,
        queryText,
        ...(currentTabDomain !== undefined ? { currentTabDomain } : {}),
        trace
      })) ?? null

    if (result) {
      usedHybrid = true
    } else {
      result = finalizeKeywordResult(normalizedClue, items, merge.merged, currentTabDomain)
    }

    const withMeta = attachDialogMeta(result, {
      clue: normalizedClue,
      parsed: merge.merged,
      effectiveClue: merge.effectiveRaw
    })
    const enriched = enrichEmptyRecallResult(withMeta, items, merge.merged)
    const withFollowUp = complete
      ? await attachLlmFollowUpIfNeeded(enriched, {
          complete,
          clue: normalizedClue,
          parsed: merge.merged,
          trace
        })
      : enriched

    trace('info', 'Hybrid Recall：流水线结束', {
      durationMs: Date.now() - pipelineStartedAt,
      usedHybrid,
      understandSource: understood.source,
      understandMode: understood.mode,
      outcome: withFollowUp.outcome,
      emptyKind: withFollowUp.emptyKind ?? null,
      relatedGuessId: withFollowUp.relatedGuess?.item.id ?? null,
      followUpSource: withFollowUp.assistantFollowUp?.source ?? 'rules',
      topPickId: withFollowUp.topPick?.item.id ?? null
    })

    return withFollowUp
  }
}
