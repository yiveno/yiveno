/**
 * Hybrid Recall：关键词候选 + embedding 近邻，经 RRF 融合。
 * 默认后端（Free/Pro 同档）；无向量 / 失败时降级关键词。
 */

import { memoryItemService } from '@/application/memory/memory-item-service'
import {
  applyPageContextToMatches,
  applyStoredOutcomePairsToMatches
} from '@/application/recall/apply-recall-context'
import { createRecallFlowTrace } from '@/application/recall/create-recall-flow-trace'
import { getClueLlmCompleter } from '@/application/recall/clue-llm-completer-registry'
import {
  readBrowserOnline,
  shouldOmitClueLlmCompleterWhenBrowserOffline
} from '@/infrastructure/browser/browser-online'
import type { RecallBackend, RecallWithClueOptions } from '@/application/recall/recall-backend'
import type { RecallVisibleProgressStage } from '@/core/recall/visible-progress'
import type { PageContextMode } from '@/core/recall/page-context-mode'
import { filterMemoryItemsBySourceScope } from '@/core/recall/recall-source-scope'
import { RECALL_SCAN_LIMIT } from '@/application/recall/backends/recall-scan-limit'
import { buildEnvironmentRecallSuggestions } from '@/core/recall/build-environment-recall-suggestions'
import {
  countRecallFollowUpChipEligibleCandidates,
  filterRecallFollowUpChipsByCutPower,
  shouldOfferRecallFollowUpChips
} from '@/core/recall/gate-recall-follow-up-chips'
import { buildRecallFramingFacts } from '@/core/recall/build-recall-framing-facts'
import { RECALL_RESULT_PAGE_SIZE } from '@/core/recall/build-recall-result'
import { buildClueEmbeddingText } from '@/core/recall/build-clue-embedding-text'
import {
  buildRecallResult,
  filterKeywordMatchesBeforeCollapse,
  RECALL_COLLAPSE_BACKFILL_EXTRA,
  RECALL_RESULT_POOL_LIMIT
} from '@/core/recall/build-recall-result'
import { collapseRecallMatches } from '@/core/recall/collapse-recall-duplicates'
import { COMPOSER_PLACEHOLDER_NARROW_MIN_RANKED } from '@/core/recall/compute-composer-placeholder'
import {
  extractComposerNarrowExamples,
  type NarrowExampleSource
} from '@/core/recall/extract-composer-narrow-examples'
import {
  HYBRID_KEYWORD_POOL,
  HYBRID_SEMANTIC_NEIGHBOR_LIMIT,
  HYBRID_SEMANTIC_NEIGHBOR_LIMIT_EXPANDED,
  preferKeywordLeaderInHybridFusion,
  rankIdsByCosineToQuery,
  scoreFromCosineSimilarity,
  sortIdsByRrf
} from '@/core/recall/hybrid-fusion'
import { isGenericOnlyHitAgainstSpecificClue } from '@/core/recall/keyword-filter'
import {
  excludeDismissedMemoryItems,
  mergeRecallDialogTurn
} from '@/core/recall/merge-recall-dialog-turn'
import { enrichEmptyRecallResult } from '@/core/recall/enrich-empty-recall-result'
import {
  applyParsedClueScoreBoosts,
  buildFilterClueFromParsed,
  filterItemsByTopicTokens,
  filterMatchesByParsedTimeRange,
  injectTopic,
  recallByKeywordWithParsedClue,
  shouldRecallByConstraintNeighborhood,
  shouldSkipRecallAsZeroAnchor
} from '@/core/recall/orchestrate-keyword-recall'
import {
  hasRecallTopicAnchor,
  withRecallTopic,
  withRecallTopicAsync
} from '@/core/recall/recall-topic'
import {
  effectiveContentTermsForRecall,
  filterMatchesByContentTermCorroboration,
  parsedClueForTimeSoftReopen,
  shouldAttemptTimeSoftReopen,
  softPenalizeMatchesByContentTermCorroboration
} from '@/core/recall/content-term-corroboration'
import { filterMatchesByExcludeContentTerms } from '@/core/recall/exclude-content-terms'
import type { ParsedRecallClue } from '@/core/recall/parse-recall-clue-types'
import type { RecallMatch, RecallResult } from '@/core/recall/recall-result'
import { getMemoryItemDisplay } from '@/core/recall/recall-result'
import {
  renderRecallFraming,
  renderRecallFramingCounts,
  renderRecallFramingRulesBody,
  joinRecallFramingSentences
} from '@/core/recall/render-recall-framing'
import type { RecallPipelineTiming } from '@/core/recall/recall-telemetry'
import { completeComposerNarrowExamplePolishWithLlm } from '@/core/recall/understand/complete-composer-narrow-example-polish'
import { completeRecallFramingNlgWithLlm } from '@/core/recall/understand/complete-recall-framing-nlg'
import { understandRecallClue } from '@/core/recall/understand/understand-recall-clue'
import { requestWorkerEmbeddings } from '@/infrastructure/ai/embed-api-client'
import { getAuthSession } from '@/infrastructure/identity/auth-session-service'
import { t } from '@/infrastructure/i18n/t'

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

/** 列表级邻域说明（规则模板；Phase A）。 */
function attachRecallFraming(result: RecallResult): RecallResult {
  const facts = buildRecallFramingFacts(result, { shownCount: RECALL_RESULT_PAGE_SIZE })
  if (!facts) {
    return result
  }
  const text = renderRecallFraming(facts, t).trim()
  if (!text) {
    return result
  }
  return {
    ...result,
    recallFraming: {
      source: 'rules',
      text,
      facts
    }
  }
}

async function finalizeKeywordResult(
  displayClue: string,
  items: Awaited<ReturnType<typeof memoryItemService.list>>,
  parsed: ParsedRecallClue,
  pageContext: { mode: PageContextMode; currentTabDomain: string | undefined },
  pairClue: string,
  options?: {
    skipOutcomePairs?: boolean
    /** Omnibox 快跳：略抬 open / 近因 / settled（ADR-007） */
    behaviorProfile?: 'omnibox'
  }
): Promise<{ result: RecallResult; effectiveParsed: ParsedRecallClue; timeSoftReopen: boolean }> {
  const base = recallByKeywordWithParsedClue(items, displayClue, {
    candidateLimit: RECALL_RESULT_POOL_LIMIT,
    parsed,
    ...(options?.behaviorProfile ? { behaviorProfile: options.behaviorProfile } : {})
  })
  const effectiveParsed = base.parsed ?? parsed
  const timeSoftReopen =
    effectiveParsed.timeConfidence === 'low' &&
    (parsed.timeConfidence === 'high' ||
      (Boolean(parsed.behaviorHints?.includes('recently_saved')) &&
        parsed.timeConfidence !== 'low')) &&
    effectiveContentTermsForRecall(parsed).length > 0
  const matches = applyPageContextToMatches(
    [...(base.topPick ? [base.topPick] : []), ...base.alsoPossible],
    {
      pageContextMode: pageContext.mode,
      currentTabDomain: pageContext.currentTabDomain
    }
  )
  matches.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score
    }
    return b.item.updatedAt.localeCompare(a.item.updatedAt)
  })
  // §7.2 P3：本机 Outcome 对软调整（正例须内容佐证）。
  // Omnibox 模式（ADR-007）：单次命中即走，无多轮 Outcome 历史，跳过以省内存 + IDB 读。
  const corroborationTerms = effectiveContentTermsForRecall(effectiveParsed)
  const withPairs = options?.skipOutcomePairs
    ? matches
    : await applyStoredOutcomePairsToMatches(matches, pairClue, {
        contentTerms: corroborationTerms
      })
  const corroborated = filterMatchesByContentTermCorroboration(withPairs, corroborationTerms)
  return {
    result: injectTopic(
      buildRecallResult(displayClue, corroborated, {
        contentTerms: corroborationTerms,
        ...(base.topic
          ? {
              topic: {
                displayName: base.topic.displayName,
                tokens: base.topic.tokens
              }
            }
          : {})
      }),
      effectiveParsed
    ),
    effectiveParsed,
    timeSoftReopen
  }
}

// Omnibox 路径：无联网向量兜底（ADR-007 · 完全本地）

/**
 * 对已打分的 keyword / semantic 池做时间筛 → RRF → 页上下文（boost/restrict）。
 * 供 L2 消融评测在**预计算向量**下复用同一融合段；不改变算法。
 */
export function fuseKeywordAndSemanticPools(input: {
  keywordMatches: RecallMatch[]
  semanticMatches: RecallMatch[]
  parsed: ParsedRecallClue
  pageContextMode?: PageContextMode
  currentTabDomain?: string
}): RecallMatch[] {
  return fuseScoredPools(input)
}

/** 对已打分的 keyword / semantic 池做时间筛 → RRF → 页上下文（boost/restrict）。 */
function fuseScoredPools(input: {
  keywordMatches: RecallMatch[]
  semanticMatches: RecallMatch[]
  parsed: ParsedRecallClue
  pageContextMode?: PageContextMode
  currentTabDomain?: string
}): RecallMatch[] {
  const keywordTimed = filterMatchesByParsedTimeRange(input.keywordMatches, input.parsed)
  const semanticTimed = filterMatchesByParsedTimeRange(input.semanticMatches, input.parsed)
  if (semanticTimed.length === 0 && keywordTimed.length === 0) {
    return []
  }
  // 无语义时仍可用关键词池（供佐证门 / soft 回退）
  const keywordOrder = keywordTimed.map(match => match.item.id)
  const semanticOrder = semanticTimed.map(match => match.item.id)
  const lists = [keywordOrder, semanticOrder].filter(list => list.length > 0)
  if (lists.length === 0) {
    return []
  }
  const fusedIds = sortIdsByRrf(lists)
  const byId = new Map(keywordTimed.map(match => [match.item.id, match]))
  for (const match of semanticTimed) {
    const existing = byId.get(match.item.id)
    if (!existing) {
      byId.set(match.item.id, match)
      continue
    }
    byId.set(match.item.id, {
      ...existing,
      score: Math.max(existing.score, match.score),
      matchedFields: existing.matchedFields.includes('embedding')
        ? existing.matchedFields
        : [...existing.matchedFields, 'embedding']
    })
  }

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

  const keywordScoreOrder = [...keywordTimed].sort((left, right) => {
    if (right.score !== left.score) {
      return right.score - left.score
    }
    return right.item.updatedAt.localeCompare(left.item.updatedAt)
  })
  const guardedFused = preferKeywordLeaderInHybridFusion(
    fusedMatches.map(match => ({
      id: match.item.id,
      score: match.score,
      match
    })),
    keywordScoreOrder.map(match => ({
      id: match.item.id,
      score: match.score,
      match
    }))
  ).map(entry => {
    const base = entry.match
    if (base.score === entry.score) {
      return base
    }
    return { ...base, score: entry.score }
  })

  const withPageContext = applyPageContextToMatches(
    guardedFused.map(match => applyParsedClueScoreBoosts(match, input.parsed)),
    {
      pageContextMode: input.pageContextMode ?? 'none',
      currentTabDomain: input.currentTabDomain
    }
  )
  withPageContext.sort((left, right) => {
    if (right.score !== left.score) {
      return right.score - left.score
    }
    return right.item.updatedAt.localeCompare(left.item.updatedAt)
  })
  return withPageContext
}

function collectWeakCandidateTitles(result: RecallResult): string[] {
  const pool = [...(result.topPick ? [result.topPick] : []), ...result.alsoPossible]
  return pool.slice(0, 3).map(match => {
    const display = getMemoryItemDisplay(match.item, () => '')
    return display.title || display.excerpt || display.subtitle || match.item.id
  })
}

/** 宽邻域 top_pick 或 need_a_clue 才尝试 LLM 润色（窄 top_pick 省配额）。 */
function shouldPolishFramingWithLlm(result: RecallResult): boolean {
  if (!result.recallFraming?.facts || result.recallFraming.facts.kind !== 'candidates') {
    return false
  }
  if (result.outcome === 'need_a_clue') {
    return result.topPick !== null || result.alsoPossible.length > 0
  }
  if (result.outcome === 'top_pick') {
    return result.totalRankedCount >= COMPOSER_PLACEHOLDER_NARROW_MIN_RANKED
  }
  return false
}

/**
 * Phase B：LLM 润色 P1–P5；P6 计数仍规则拼接；芯片仅 need_a_clue。
 * 失败静默降级 rules framing。
 */
async function attachRecallFramingLlmPolish(
  result: RecallResult,
  input: {
    complete: NonNullable<ReturnType<typeof getClueLlmCompleter>>
    clue: string
    parsed: ParsedRecallClue
    trace: ReturnType<typeof createRecallFlowTrace>
  }
): Promise<RecallResult> {
  if (!shouldPolishFramingWithLlm(result) || !result.recallFraming) {
    return result
  }

  const facts = result.recallFraming.facts
  const rulesBaseline = renderRecallFramingRulesBody(facts, t)

  try {
    const mapped = await completeRecallFramingNlgWithLlm({
      clue: input.clue,
      parsed: input.parsed,
      outcome: result.outcome,
      facts,
      rulesBaseline,
      weakCandidateTitles: collectWeakCandidateTitles(result),
      complete: input.complete,
      trace: input.trace
    })

    const countsPart = facts.kind === 'candidates' ? renderRecallFramingCounts(facts, t) : ''
    const text = joinRecallFramingSentences(countsPart ? [mapped.text, countsPart] : [mapped.text])

    // P0：邻域过窄 / 无切割力 → 不挂 LLM 芯片（气泡润色仍保留）
    const gatedSuggestions = filterRecallFollowUpChipsByCutPower(mapped.suggestions, result)
    if (mapped.suggestions.length > 0 && gatedSuggestions.length === 0) {
      input.trace('info', 'LLM 芯片：门禁清空（邻域过窄或无切割力）', {
        before: mapped.suggestions.length,
        candidateCount: countRecallFollowUpChipEligibleCandidates(result)
      })
    }

    return {
      ...result,
      recallFraming: {
        source: 'llm',
        text,
        facts
      },
      ...(gatedSuggestions.length > 0
        ? {
            assistantFollowUp: {
              source: 'llm' as const,
              text: '',
              suggestions: gatedSuggestions
            }
          }
        : {})
    }
  } catch (error) {
    input.trace('warn', 'LLM Framing：失败，降级规则模板', {
      outcome: result.outcome,
      error: error instanceof Error ? error.message : String(error)
    })
    return result
  }
}

/**
 * §7.1：无 LLM 芯片时挂环境弱芯片（有信号才出）。
 * - need_a_clue：可挂
 * - top_pick 且 N 未达宽邻域门槛：可挂（窄结果；与 Narrow placeholder 不抢）
 * - top_pick 宽邻域：不挂，留给动态 Narrow placeholder
 * 有 LLM suggestions → 不抢主。
 */
function attachEnvironmentFollowUpIfNeeded(
  result: RecallResult,
  input: {
    clue: string
    trace: ReturnType<typeof createRecallFlowTrace>
  }
): RecallResult {
  if (result.outcome === 'no_match') {
    return result
  }
  const hasCandidates =
    result.topPick !== null || result.alsoPossible.length > 0 || result.totalRankedCount > 0
  if (!hasCandidates) {
    return result
  }
  if (
    result.outcome === 'top_pick' &&
    result.totalRankedCount >= COMPOSER_PLACEHOLDER_NARROW_MIN_RANKED
  ) {
    input.trace('info', '环境芯片：宽邻域 top_pick，留给 Narrow placeholder', {
      rankedTotalCount: result.totalRankedCount
    })
    return result
  }
  if (result.assistantFollowUp?.suggestions && result.assistantFollowUp.suggestions.length > 0) {
    input.trace('info', '环境芯片：已有 LLM 芯片，跳过', {
      llmChipCount: result.assistantFollowUp.suggestions.length
    })
    return result
  }

  const candidateCount = countRecallFollowUpChipEligibleCandidates(result)
  if (!shouldOfferRecallFollowUpChips(candidateCount)) {
    input.trace('info', '环境芯片：邻域过窄，跳过', { candidateCount })
    return result
  }

  // 当前站已迁 composer 页上下文；此处仅刚存/刚打开（有信号才挂）
  const specs = buildEnvironmentRecallSuggestions({
    clueText: input.clue
  })
  if (specs.length === 0) {
    input.trace('info', '环境芯片：无可用信号')
    return result
  }

  const suggestions = specs.map(spec => ({
    id: spec.id,
    label: t(spec.labelKey),
    value: spec.value
  }))
  input.trace('info', '环境芯片：已挂弱芯片', {
    ids: suggestions.map(item => item.id),
    outcome: result.outcome,
    rankedTotalCount: result.totalRankedCount
  })

  return {
    ...result,
    assistantFollowUp: {
      source: 'environment',
      // 气泡仍用 UI 静态文案；空 text 时 Side Panel 回退 formatRankedReplyText
      text: result.assistantFollowUp?.text ?? '',
      suggestions
    }
  }
}

function collectPoolMatches(result: RecallResult): RecallMatch[] {
  return [...(result.topPick ? [result.topPick] : []), ...result.alsoPossible]
}

function matchToNarrowExampleSource(match: RecallMatch): NarrowExampleSource {
  const display = getMemoryItemDisplay(match.item, () => '')
  return {
    itemKind: match.item.type === 'bookmark' ? 'bookmark' : 'text_excerpt',
    title: display.title,
    subtitle: display.subtitle,
    url: display.url,
    ...(display.excerpt !== undefined ? { excerpt: display.excerpt } : {}),
    ...(display.note !== undefined ? { note: display.note } : {})
  }
}

/**
 * 宽邻域且无芯片时：抽取 grounded Narrow 举例；有 completer 则仅润色展示形态。
 * 失败静默回退原词；有芯片让位时跳过（placeholder 走 Neutral）。
 * Gap 2：topicTerms 存在时，Narrow 举例末尾追加独立 topic 示例。
 */
async function attachComposerNarrowExamplesIfNeeded(
  result: RecallResult,
  input: {
    clue: string
    /** 解析结果（含 topic），用于注入 topicTerms 独立示例（Gap 2）。 */
    parsed: ParsedRecallClue
    complete?: NonNullable<ReturnType<typeof getClueLlmCompleter>>
    trace: ReturnType<typeof createRecallFlowTrace>
  }
): Promise<RecallResult> {
  if (result.outcome !== 'top_pick' && result.outcome !== 'need_a_clue') {
    return result
  }
  if (result.totalRankedCount < COMPOSER_PLACEHOLDER_NARROW_MIN_RANKED) {
    input.trace('info', 'Narrow 举例：邻域未达宽门槛，跳过', {
      rankedTotalCount: result.totalRankedCount
    })
    return result
  }
  if (result.assistantFollowUp?.suggestions && result.assistantFollowUp.suggestions.length > 0) {
    input.trace('info', 'Narrow 举例：已有芯片让位，跳过', {
      chipCount: result.assistantFollowUp.suggestions.length
    })
    return result
  }

  const sources = collectPoolMatches(result).map(matchToNarrowExampleSource)
  const selected = extractComposerNarrowExamples({
    candidates: sources,
    clueText: input.clue,
    // Gap 2：注入 topicTerms 使函数返回末尾追加独立 topic 示例
    ...(input.parsed.topic?.terms ? { topicTerms: input.parsed.topic.terms } : {})
  })
  if (selected.length === 0) {
    input.trace('info', 'Narrow 举例：抽不出合格词')
    return result
  }

  let examples = selected
  if (input.complete) {
    const corpusTexts = sources.flatMap(source =>
      [source.title, source.subtitle, source.url, source.excerpt ?? '', source.note ?? ''].filter(
        Boolean
      )
    )
    const candidateTextPreviews = sources
      .slice(0, 6)
      .map(source =>
        [source.title, source.subtitle, source.excerpt ?? '']
          .filter(Boolean)
          .join(' · ')
          .slice(0, 120)
      )
      .filter(Boolean)
    try {
      examples = await completeComposerNarrowExamplePolishWithLlm({
        selectedExamples: selected,
        candidateTextPreviews,
        candidateCorpusTexts: corpusTexts,
        complete: input.complete,
        trace: input.trace
      })
      input.trace('info', 'Narrow 举例：LLM 润色完成', {
        selected,
        examples
      })
    } catch (error) {
      input.trace('warn', 'Narrow 举例：LLM 润色失败，回退选定原词', {
        error: error instanceof Error ? error.message : String(error),
        selected
      })
      examples = selected
    }
  } else {
    input.trace('info', 'Narrow 举例：无 completer，使用选定原词', {
      selected
    })
  }

  return {
    ...result,
    composerNarrowExamples: examples
  }
}

/**
 * Hybrid 纯函数融合：关键词池 + 语义近邻 → ADR-011 时间筛 → RRF → 词面保护 → 佐证门 → 时间 soft 回退。
 *
 * 公开暴露：Hybrid eval (`run-hybrid-eval`) 直接复用，避免在测试里复刻整段 RRF 逻辑。
 * 不依赖 Chrome / IndexedDB；唯一外部 IO 是 `requestWorkerEmbeddings`（CI 用 vi.mock 替身）。
 *
 * @returns null 表示任一路（关键词 / 语义）佐证后都空，回退到关键词主路径；
 *          非 null 时 `effectiveParsed` 可能因时间 soft 回退而与入参 `parsed` 不同。
 */
export async function fuseHybridMatches(input: {
  displayClue: string
  /** 与会话 Outcome 对指纹对齐（通常为 merge.effectiveRaw） */
  pairClue: string
  items: Awaited<ReturnType<typeof memoryItemService.list>>
  filterClue: string
  parsed: ParsedRecallClue
  /** embedding 请求文本 */
  clueEmbeddingText: string
  /** §7.1 页上下文；缺省 none（不静默同域加成） */
  pageContextMode?: PageContextMode
  currentTabDomain?: string
  trace: ReturnType<typeof createRecallFlowTrace>
}): Promise<{
  result: RecallResult
  effectiveParsed: ParsedRecallClue
  timeSoftReopen: boolean
} | null> {
  const session = await getAuthSession()
  if (!session?.accessToken) {
    input.trace('info', 'Hybrid：无登录态，跳过向量融合')
    return null
  }

  // 先全量打分再折叠到 Hybrid 关键词池，避免重复书签占满 HYBRID_KEYWORD_POOL
  const keywordScored = collapseRecallMatches(
    filterKeywordMatchesBeforeCollapse(input.items, input.filterClue)
      .map(match => applyParsedClueScoreBoosts(match, input.parsed))
      .filter(match => !isGenericOnlyHitAgainstSpecificClue(input.filterClue, match.item)),
    { limit: HYBRID_KEYWORD_POOL }
  )

  const embeddedCandidates = input.items.flatMap(item => {
    const embedding = item.clues.embedding
    if (!Array.isArray(embedding) || embedding.length === 0) {
      return []
    }
    return [{ id: item.id, embedding }]
  })
  if (embeddedCandidates.length === 0) {
    input.trace('info', 'Hybrid：扫描集无 embedding，跳过融合')
    return null
  }

  let queryVector: number[]
  try {
    const embed = await requestWorkerEmbeddings(session.accessToken, [input.clueEmbeddingText])
    const vector = embed.embeddings[0]
    if (!vector?.length) {
      return null
    }
    queryVector = vector
  } catch (error) {
    input.trace('info', 'Hybrid：clue embed 失败，降级关键词', {
      error: error instanceof Error ? error.message : String(error)
    })
    return null
  }

  const itemsById = new Map(input.items.map(item => [item.id, item]))
  // 实验二修复（2026-09-20）：keyword miss 时扩大 semantic 候选 K，避免 rank > 24 假空。
  // hybrid 路径的极端 case 保护：keyword miss + semantic rank > 24 → 永远不进入 RRF。
  // 仅扩大 limit；cos 计算本就对全部 embeddedCandidates 全量计算，无新增性能成本。
  const semanticLimit =
    keywordScored.length === 0
      ? HYBRID_SEMANTIC_NEIGHBOR_LIMIT_EXPANDED
      : HYBRID_SEMANTIC_NEIGHBOR_LIMIT
  const semanticScored = rankIdsByCosineToQuery(queryVector, embeddedCandidates, {
    limit: semanticLimit
  }).flatMap(neighbor => {
    const item = itemsById.get(neighbor.id)
    if (!item) {
      return []
    }
    return [
      applyParsedClueScoreBoosts(
        {
          item,
          score: scoreFromCosineSimilarity(neighbor.similarity),
          matchedFields: ['embedding']
        },
        input.parsed
      )
    ]
  })

  if (semanticScored.length === 0 && keywordScored.length === 0) {
    input.trace('info', 'Hybrid：无关键词与语义候选，降级关键词路径')
    return null
  }

  const fuseWithParsed = (parsed: ParsedRecallClue): RecallMatch[] =>
    fuseScoredPools({
      keywordMatches: keywordScored,
      semanticMatches: semanticScored,
      parsed,
      pageContextMode: input.pageContextMode ?? 'none',
      ...(input.currentTabDomain !== undefined ? { currentTabDomain: input.currentTabDomain } : {})
    })

  let fused = fuseWithParsed(input.parsed)
  const corroborationTerms = effectiveContentTermsForRecall(input.parsed)
  // Hybrid 排序：soft penalty 保留语义候选（contentTerms 误判不 hard-veto 正确近邻）。
  // soft 回退触发必须以**硬佐证**空为准——禁止用 soft 池长冒充「窗非空」导致假 no_match（诚实失败 P0）。
  // 交付仍经 buildRecallResult 硬滤；硬滤后空 → return null 降级全库关键词。
  let softRanked = softPenalizeMatchesByContentTermCorroboration(fused, corroborationTerms)
  // 明确排除硬过滤（与 keyword 同规；软佐证不保证排除，故此处硬切）
  softRanked = filterMatchesByExcludeContentTerms(softRanked, input.parsed.excludeContentTerms)
  const hardCorroboratedCount = filterMatchesByExcludeContentTerms(
    filterMatchesByContentTermCorroboration(fused, corroborationTerms),
    input.parsed.excludeContentTerms
  ).length
  let effectiveParsed = input.parsed
  let timeSoftReopen = false

  if (shouldAttemptTimeSoftReopen(input.parsed, hardCorroboratedCount)) {
    timeSoftReopen = true
    effectiveParsed = parsedClueForTimeSoftReopen(input.parsed)
    fused = fuseWithParsed(effectiveParsed)
    softRanked = softPenalizeMatchesByContentTermCorroboration(fused, corroborationTerms)
    softRanked = filterMatchesByExcludeContentTerms(softRanked, effectiveParsed.excludeContentTerms)
    input.trace('info', 'Hybrid：硬佐证空窗，已做一次时间 soft 回退', {
      afterSoftCount: softRanked.length,
      afterHardCount: filterMatchesByExcludeContentTerms(
        filterMatchesByContentTermCorroboration(fused, corroborationTerms),
        effectiveParsed.excludeContentTerms
      ).length
    })
  }

  // soft 池空（含 soft 回退后）：降级全库关键词，避免 HYBRID_KEYWORD_POOL 假空
  if (softRanked.length === 0) {
    input.trace('info', 'Hybrid：排序池空，降级关键词', {
      keywordCount: keywordScored.length,
      semanticCount: semanticScored.length,
      timeSoftReopen
    })
    return null
  }

  const withPairs = await applyStoredOutcomePairsToMatches(softRanked, input.pairClue, {
    contentTerms: corroborationTerms
  })
  // 与上一步同源 soft penalty；交付硬滤在 buildRecallResult。
  let afterPairs = softPenalizeMatchesByContentTermCorroboration(withPairs, corroborationTerms)
  afterPairs = filterMatchesByExcludeContentTerms(afterPairs, effectiveParsed.excludeContentTerms)

  const collapsed = collapseRecallMatches(afterPairs, {
    limit: RECALL_RESULT_POOL_LIMIT + RECALL_COLLAPSE_BACKFILL_EXTRA
  })
  const result = buildRecallResult(input.displayClue, collapsed, {
    contentTerms: corroborationTerms
  })
  // 交付硬滤后空邻域 → 降级关键词（soft 回退后仍无词面佐证、或仅噪音 soft 池）
  if (result.outcome === 'no_match') {
    input.trace('info', 'Hybrid：交付硬滤后空邻域，降级关键词', {
      keywordCount: keywordScored.length,
      semanticCount: semanticScored.length,
      timeSoftReopen
    })
    return null
  }
  input.trace('info', 'Hybrid：RRF 融合完成', {
    keywordCount: keywordScored.length,
    semanticCount: semanticScored.length,
    fusedCount: collapsed.length,
    timeSoftReopen
  })
  return {
    result,
    effectiveParsed,
    timeSoftReopen
  }
}

export class HybridRecallBackend implements RecallBackend {
  async recallWithClue(clue: string, options?: RecallWithClueOptions): Promise<RecallResult> {
    const trace = createRecallFlowTrace()
    const pipelineStartedAt = Date.now()
    const normalizedClue = clue.trim()
    const entry = options?.entry ?? 'sidepanel'
    const isOmniboxEntry = entry === 'omnibox'
    const context = isOmniboxEntry ? undefined : options?.context
    const priorUserUtterances = context?.priorUserUtterances ?? []
    const accumulated = context?.accumulated ?? null
    const dismissedIds = context?.dismissedIds ?? []
    const pageContextMode: PageContextMode = context?.pageContextMode ?? 'none'
    const currentTabDomain = pageContextMode === 'none' ? undefined : context?.currentTabDomain

    if (!normalizedClue) {
      return {
        outcome: 'no_match',
        topPick: null,
        alsoPossible: [],
        totalRankedCount: 0,
        clue: ''
      }
    }

    trace('info', 'Hybrid Recall：流水线开始', {
      entry,
      clue: normalizedClue,
      priorCount: priorUserUtterances.length,
      dismissedCount: dismissedIds.length,
      pageContextMode,
      currentTabDomain: currentTabDomain ?? null
    })

    // Omnibox：本机快跳，从不挂线索 LLM。Side Panel：仅 navigator 断网时薄适配省略 LLM（ADR-021），避免空等云端
    const browserOnline = readBrowserOnline()
    const omitClueLlmForBrowserOffline =
      !isOmniboxEntry && shouldOmitClueLlmCompleterWhenBrowserOffline(browserOnline)
    if (omitClueLlmForBrowserOffline) {
      trace('info', '断网薄适配：跳过线索 LLM，走规则理解', { entry, browserOnline: false })
    }
    const complete =
      isOmniboxEntry || omitClueLlmForBrowserOffline
        ? undefined
        : (getClueLlmCompleter() ?? undefined)
    const visibleProgressStages: RecallVisibleProgressStage[] = []
    const reportProgress = (stage: RecallVisibleProgressStage) => {
      if (isOmniboxEntry) {
        return
      }
      visibleProgressStages.push(stage)
      options?.onVisibleProgress?.(stage)
    }

    reportProgress('understanding')
    const understandStartedAt = Date.now()
    const understood = await understandRecallClue(normalizedClue, {
      ...(complete ? { complete } : {}),
      ...(isOmniboxEntry ? { forceMode: 'lexical' as const } : {}),
      trace
    })
    const understandMs = Date.now() - understandStartedAt

    if (understood.disposition === 'reject_noise') {
      const pipelineTiming: RecallPipelineTiming = {
        understandMs,
        candidateLoadMs: 0,
        retrieveMs: 0,
        totalMs: Date.now() - pipelineStartedAt,
        understandSource: understood.source
      }
      return {
        outcome: 'no_match',
        topPick: null,
        alsoPossible: [],
        totalRankedCount: 0,
        clue: normalizedClue,
        emptyKind: 'rejected_noise',
        pipelineTiming,
        understandSource: understood.source,
        visibleProgressStages: [...visibleProgressStages]
      }
    }

    // Gate A+：闲聊意图短路（须 intent + 非空回复双全；缺一则 fail-open 走正常 recall）
    if (understood.parsed.intent === 'chitchat' && understood.parsed.assistantReply?.trim()) {
      const pipelineTiming: RecallPipelineTiming = {
        understandMs,
        candidateLoadMs: 0,
        retrieveMs: 0,
        totalMs: Date.now() - pipelineStartedAt,
        understandSource: understood.source
      }
      trace('info', 'Recall：闲聊意图短路', {
        clue: normalizedClue,
        understandSource: understood.source
      })
      return {
        outcome: 'no_match',
        topPick: null,
        alsoPossible: [],
        totalRankedCount: 0,
        clue: normalizedClue,
        emptyKind: 'chitchat',
        assistantReply: understood.parsed.assistantReply.trim(),
        pipelineTiming,
        understandSource: understood.source,
        visibleProgressStages: [...visibleProgressStages]
      }
    }

    const merge = mergeRecallDialogTurn({
      accumulated,
      currentParsed: understood.parsed,
      priorUserUtterances,
      currentUtterance: normalizedClue
    })

    // D3-C Gap 5：Topic embedding 注入（仅 Side Panel / 完整 Recall 轨）。
    // Omnibox（ADR-007）：完全本地——不注入 Topic embed，miss 也不联网兜底。
    let merged = withRecallTopic(merge.merged)
    const session = await getAuthSession()
    const accessToken = session?.accessToken
    if (accessToken && !isOmniboxEntry) {
      // Gap 5：注入 embedding 句柄（仅在登录态可用时）
      merged = await withRecallTopicAsync(merged, async (text: string) => {
        try {
          const embed = await requestWorkerEmbeddings(accessToken, [text])
          const vector = embed.embeddings[0]
          if (!vector || vector.length === 0) {
            return null
          }
          return new Float32Array(vector)
        } catch {
          return null
        }
      })
    }

    // H-topic 主题必填（ADR-014 · D1-B 退化弱 Topic，2026-10-06 裁决）：
    // - 完全无锚点（既无 C/G，也无强约束）→ `missing_topic`，未进检索
    // - 约束邻域（仅时间 high + 类型 / 刚存）→ 进下方 `shouldRecallByConstraintNeighborhood` 分支
    // 多轮 accumulated 的主题由 merged 自然承接；误判时用户补一句即可继续。
    if (!hasRecallTopicAnchor(merged) && !shouldRecallByConstraintNeighborhood(merged)) {
      const pipelineTiming: RecallPipelineTiming = {
        understandMs,
        candidateLoadMs: 0,
        retrieveMs: 0,
        totalMs: Date.now() - pipelineStartedAt,
        understandSource: understood.source
      }
      trace('info', 'Hybrid Recall：缺主题锚，未进检索', {
        entry,
        clue: normalizedClue
      })
      return {
        outcome: 'no_match',
        topPick: null,
        alsoPossible: [],
        totalRankedCount: 0,
        clue: normalizedClue,
        parsed: merged,
        effectiveClue: merge.effectiveRaw,
        emptyKind: 'missing_topic',
        relatedGuess: null,
        pipelineTiming,
        understandSource: understood.source,
        visibleProgressStages: [...visibleProgressStages]
      }
    }

    reportProgress('narrowing')
    const candidateLoadStartedAt = Date.now()
    const listedResult = await memoryItemService.listForKeywordRecall({
      rawClue: normalizedClue,
      parsed: merged,
      limit: RECALL_SCAN_LIMIT
    })
    const candidateLoadMs = Date.now() - candidateLoadStartedAt
    const listedItems = listedResult.items
    let items = excludeDismissedMemoryItems(listedItems, dismissedIds)
    const sourceScope = isOmniboxEntry ? 'all' : (context?.sourceScope ?? 'all')
    if (sourceScope !== 'all') {
      const before = items.length
      items = filterMemoryItemsBySourceScope(items, sourceScope)
      trace('info', 'Recall 来源范围：已按类型硬筛', {
        sourceScope,
        before,
        after: items.length
      })
    }

    const clueEmbeddingText = buildClueEmbeddingText({
      effectiveClue: merge.effectiveRaw,
      parsed: merged,
      rawClue: normalizedClue
    })

    trace('info', 'Hybrid Recall：候选已加载', {
      candidateSource: listedResult.source,
      candidateCount: items.length
    })

    // Gap 1：Topic 先验预筛（仅在 parsed.topic 存在时启用；与 contentTerms 候选取并集）
    const topicPreFilterEnabled = Boolean(merged.topic?.terms?.length)
    if (topicPreFilterEnabled) {
      const topicTermCount = merged.topic!.terms.length
      const preFilterCount = items.length
      // Topic 预筛：与现有候选取并集（不是交集，不删 contentTerms 已有候选）
      const topicFiltered = filterItemsByTopicTokens(items, merged.topic!)
      const postFilterCount = topicFiltered.length
      items = topicFiltered
      trace('info', 'Hybrid Recall：Topic 先验预筛已完成', {
        topicTermCount,
        preFilterCount,
        postFilterCount,
        extraFromTopic: postFilterCount - preFilterCount
      })
    }

    reportProgress('checking')
    let usedHybrid = false
    let result: RecallResult
    const retrieveStartedAt = Date.now()

    const pairClue = merge.effectiveRaw
    let effectiveParsedForFraming = merged
    let timeSoftReopen = false

    // 零锚点助手发令 / 无内容且无约束：诚实空，禁止 raw 整句或类型邻域冒充推荐
    if (shouldSkipRecallAsZeroAnchor(normalizedClue, merged)) {
      result = {
        outcome: 'no_match',
        topPick: null,
        alsoPossible: [],
        totalRankedCount: 0,
        clue: normalizedClue
      }
    } else if (shouldRecallByConstraintNeighborhood(merged)) {
      // 无内容词的时间+类型（如 recently collected bookmark）：Preference-driven 弱 Topic（ADR-014 · D1-B），
      // 走近因邻域 `finalizeKeywordResult`；不走关键词 / 向量扫虚词。
      const finalized = await finalizeKeywordResult(
        normalizedClue,
        items,
        merged,
        { mode: pageContextMode, currentTabDomain },
        pairClue
      )
      result = finalized.result
      effectiveParsedForFraming = finalized.effectiveParsed
      timeSoftReopen = finalized.timeSoftReopen
    } else if (isOmniboxEntry) {
      // Omnibox 本机快跳（ADR-007 · ADR-021）：已知锚点 → 纯本地关键词（无 Hybrid / 无向量 / 无 Outcome）。
      // 不做查询侧静态缩写字典扩词（ADR-005）；缩写/口语残差 → Side Panel。
      const finalized = await finalizeKeywordResult(
        normalizedClue,
        items,
        merged,
        { mode: pageContextMode, currentTabDomain },
        pairClue,
        {
          skipOutcomePairs: true,
          behaviorProfile: 'omnibox'
        }
      )
      result = finalized.result
      effectiveParsedForFraming = finalized.effectiveParsed
      timeSoftReopen = finalized.timeSoftReopen
    } else {
      const hybrid =
        (await fuseHybridMatches({
          displayClue: normalizedClue,
          pairClue,
          items,
          filterClue: buildFilterClueFromParsed(merged),
          parsed: merged,
          clueEmbeddingText,
          pageContextMode,
          ...(currentTabDomain !== undefined ? { currentTabDomain } : {}),
          trace
        })) ?? null

      if (hybrid) {
        usedHybrid = true
        result = hybrid.result
        effectiveParsedForFraming = hybrid.effectiveParsed
        timeSoftReopen = hybrid.timeSoftReopen
      } else {
        const finalized = await finalizeKeywordResult(
          normalizedClue,
          items,
          merged,
          { mode: pageContextMode, currentTabDomain },
          pairClue
        )
        result = finalized.result
        effectiveParsedForFraming = finalized.effectiveParsed
        timeSoftReopen = finalized.timeSoftReopen
      }
    }

    const retrieveMs = Date.now() - retrieveStartedAt
    const postProcessStartedAt = Date.now()

    const withMeta = attachDialogMeta(result, {
      clue: normalizedClue,
      parsed: effectiveParsedForFraming,
      effectiveClue: merge.effectiveRaw
    })

    if (isOmniboxEntry) {
      const pipelineTiming: RecallPipelineTiming = {
        understandMs,
        candidateLoadMs,
        retrieveMs,
        totalMs: Date.now() - pipelineStartedAt,
        understandSource: understood.source,
        usedHybrid,
        ...(timeSoftReopen ? { timeSoftReopen: true } : {})
      }
      trace('info', 'Omnibox 本机快跳：流水线结束', {
        durationMs: pipelineTiming.totalMs,
        usedHybrid,
        timeSoftReopen,
        understandSource: understood.source,
        outcome: withMeta.outcome,
        topPickId: withMeta.topPick?.item.id ?? null
      })
      return {
        ...withMeta,
        pipelineTiming,
        understandSource: understood.source
      }
    }

    const enriched = enrichEmptyRecallResult(withMeta, items, effectiveParsedForFraming)

    const withNarrowExamples = await attachComposerNarrowExamplesIfNeeded(enriched, {
      clue: normalizedClue,
      parsed: effectiveParsedForFraming,
      trace,
      ...(complete ? { complete } : {})
    })

    const withFraming = attachRecallFraming(withNarrowExamples)

    const withFramingLlm = complete
      ? await attachRecallFramingLlmPolish(withFraming, {
          complete,
          clue: normalizedClue,
          parsed: effectiveParsedForFraming,
          trace
        })
      : withFraming

    const withFollowUp = attachEnvironmentFollowUpIfNeeded(withFramingLlm, {
      clue: normalizedClue,
      trace
    })

    const postProcessMs = Date.now() - postProcessStartedAt
    const pipelineTiming: RecallPipelineTiming = {
      understandMs,
      candidateLoadMs,
      retrieveMs,
      postProcessMs,
      totalMs: Date.now() - pipelineStartedAt,
      understandSource: understood.source,
      usedHybrid,
      ...(timeSoftReopen ? { timeSoftReopen: true } : {})
    }

    trace('info', 'Hybrid Recall：流水线结束', {
      durationMs: pipelineTiming.totalMs,
      understandMs: pipelineTiming.understandMs,
      candidateLoadMs: pipelineTiming.candidateLoadMs,
      retrieveMs: pipelineTiming.retrieveMs,
      postProcessMs: pipelineTiming.postProcessMs,
      usedHybrid,
      understandSource: understood.source,
      understandMode: understood.mode,
      outcome: withFollowUp.outcome,
      emptyKind: withFollowUp.emptyKind ?? null,
      relatedGuessId: withFollowUp.relatedGuess?.item.id ?? null,
      followUpSource: withFollowUp.assistantFollowUp?.source ?? 'rules',
      topPickId: withFollowUp.topPick?.item.id ?? null,
      narrowExampleCount: withFollowUp.composerNarrowExamples?.length ?? 0,
      framingSource: withFollowUp.recallFraming?.source ?? null
    })

    return {
      ...withFollowUp,
      pipelineTiming,
      understandSource: understood.source,
      visibleProgressStages: [...visibleProgressStages]
    }
  }
}
