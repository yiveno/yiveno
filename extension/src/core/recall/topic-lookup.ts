/**
 * TopicLookup：Topic 独立检索路径（Gap 4/5 · D3-C 语义化）。
 *
 * **职责：** 让 Topic 与 contentTerms **职责划分明确**。
 * - Topic 走独立检索路径（邻域检索）。
 * - contentTerms 走关键词检索（`buildFilterClueFromParsed` + `filterKeywordMatchesBeforeCollapse`）。
 * - 两者结果后期融合（并集 · 去重）。
 *
 * **Gap 5（D3-C 语义化）：** topicEmbedding 参数真实接入。
 * - 有 embedding 时：调用 `cosineSimilarity` 对有 embedding 的条目计算近邻，取 topN（不设门限，以 score 为准）。
 * - 无 embedding 时：走词法路径（Gap 4 占位实现）。
 *
 * **禁止：** 使用内容别名/同义词表作为通解（ADR-005）。
 *
 * D3-C（2026-10-06）：Topic 终态 = 语义表示（embedding / entity）；直接语义化。
 */

import type { MemoryItem } from '@/core/memory/memory-item'
import type { EmbeddingVector, TopicDescriptor } from '@/core/recall/parse-recall-clue-types'
import { cosineSimilarity } from '@/core/recall/hybrid-fusion'

/**
 * TopicLookup 单条命中结果。
 *
 * 仅含 topic 相关性打分（0-100）。
 * 不含全文检索打分（score）/ matchedFields——这些由 contentTerms 关键词路径提供。
 *
 * 用于与关键词候选池融合（并集 · 去重）。
 */
export interface TopicLookupMatch {
  /** 被命中的 MemoryItem。 */
  item: MemoryItem
  /**
   * Topic 相关性分（0-100）。
   *
   * 词法路径：按命中的 Topic 词面数归一化（命中越多分越高）。
   * embedding 路径：cosine similarity × 100（取整）。
   */
  topicScore: number
}

/**
 * TopicLookup 结果（有序列表）。
 *
 * `topicMatches`：按 topicScore 降序排列。
 * `topicSkipped`：true = parsed.topic 不存在或为空，本轮跳过 TopicLookup（现状不变）。
 */
export interface TopicLookupResult {
  topicMatches: TopicLookupMatch[]
  /** true = 本轮跳过 TopicLookup（Topic 不存在或 tokens 为空）。 */
  topicSkipped: boolean
}

/**
 * 按 topicScore 降序排列（融合时高相关优先）。
 */
function sortByTopicScoreDesc(matches: TopicLookupMatch[]): TopicLookupMatch[] {
  return [...matches].sort((a, b) => b.topicScore - a.topicScore)
}

/**
 * 规范化文本（去空白 + 小写）。
 * 与 keyword-filter 的 normalizeRecallText 保持一致。
 */
function normalizeText(text: string): string {
  return text.trim().toLowerCase()
}

/**
 * 单条 MemoryItem 与 Topic 词面的相关性打分（词法占位实现）。
 *
 * 机制：计算 item 标题/URL 中命中多少个 topic token（归一化后）。
 * - 分母 = topic token 总数（归一化去重）
 * - 分子 = 命中 token 数（归一化后匹配）
 *
 * @param item 待打分条目
 * @param topicTokens 规范化后的 topic token 集合
 * @returns topic 相关性分（0-100）
 */
function scoreItemByTopicTokens(item: MemoryItem, topicTokens: Set<string>): number {
  if (topicTokens.size === 0) {
    return 0
  }

  // 收集 item 可检索文本（标题 + URL）
  const itemTexts: string[] = []
  if ('title' in item.payload) {
    itemTexts.push(item.payload.title ?? '')
  }
  if ('url' in item.payload) {
    itemTexts.push(item.payload.url ?? '')
  }
  if ('pageTitle' in item.payload) {
    itemTexts.push(item.payload.pageTitle ?? '')
  }
  if ('sourceUrl' in item.payload) {
    itemTexts.push(item.payload.sourceUrl ?? '')
  }

  // 命中计数（归一化匹配）
  let hitCount = 0
  for (const text of itemTexts) {
    const normalized = normalizeText(text)
    for (const token of topicTokens) {
      if (normalized.includes(token)) {
        hitCount++
        // 同一 token 不重复计数（防止 URL 长串重复命中）
        break
      }
    }
  }

  return Math.round((hitCount / topicTokens.size) * 100)
}

/**
 * Topic embedding 近邻打分：cosine similarity → topicScore（0-100）。
 * 映射：similarity ∈ [0,1] → topicScore ∈ [0,100]。
 */
function topicEmbeddingTopicScore(similarity: number): number {
  return Math.round(similarity * 100)
}

/**
 * TopicLookup：Topic 独立检索路径。
 *
 * Gap 4：词法路径（占位实现）。
 * Gap 5（D3-C 语义化）：embedding 路径真实接入。
 *
 * @param items MemoryItem 候选集（通常为全量或倒排预过滤后）
 * @param topic Topic 描述子
 * @param topicEmbedding Gap 5：可选 Topic embedding（Float32Array）；有则走 embedding 路径，无则走词法路径
 * @param options.limit 返回条数上限（默认 50）
 * @returns TopicLookupResult
 */
export function topicLookup(
  items: MemoryItem[],
  topic: TopicDescriptor,
  topicEmbedding?: EmbeddingVector,
  options: { limit?: number } = {}
): TopicLookupResult {
  const limit = options.limit ?? 50

  // ============================================================
  // Gap 5（D3-C 语义化）：有 embedding 时走 embedding 路径
  // ============================================================
  if (topicEmbedding !== undefined) {
    // 对全库有 embedding 的条目计算 cosine similarity
    const topicEmbeddingVec = Array.from(topicEmbedding)
    const candidatesWithSim = items
      .map(item => {
        const embedding = item.clues.embedding
        // item.clues.embedding 类型为 number[]（MemoryCluesSchema）
        if (!Array.isArray(embedding) || embedding.length === 0) {
          return null
        }
        // topicEmbedding = Float32Array（TopicDescriptor 透传）；item embedding = number[]
        const similarity = cosineSimilarity(topicEmbeddingVec, embedding)
        return { item, similarity }
      })
      .filter((entry): entry is { item: MemoryItem; similarity: number } => entry !== null)

    // 全库无 embedding 条目：降级词法
    if (candidatesWithSim.length === 0) {
      const tokens = topic.tokens
      if (!tokens || tokens.length === 0) {
        return { topicMatches: [], topicSkipped: true }
      }
      const normalizedTokens = new Set(tokens.map(normalizeText).filter(t => t.length > 0))
      if (normalizedTokens.size === 0) {
        return { topicMatches: [], topicSkipped: true }
      }
      const scored: TopicLookupMatch[] = []
      for (const item of items) {
        const topicScore = scoreItemByTopicTokens(item, normalizedTokens)
        if (topicScore > 0) {
          scored.push({ item, topicScore })
        }
      }
      return { topicMatches: sortByTopicScoreDesc(scored).slice(0, limit), topicSkipped: false }
    }

    // 按相似度降序，取 topN（不设门限，以 score 为准）
    candidatesWithSim.sort((a, b) => b.similarity - a.similarity)
    const topCandidates = candidatesWithSim.slice(0, limit)
    const scored: TopicLookupMatch[] = topCandidates.map(({ item, similarity }) => ({
      item,
      topicScore: topicEmbeddingTopicScore(similarity)
    }))
    return { topicMatches: scored, topicSkipped: false }
  }

  // ============================================================
  // Gap 4 词法路径（占位实现）
  // ============================================================
  const tokens = topic.tokens
  if (!tokens || tokens.length === 0) {
    // Topic tokens 为空（weak topic 或 noteHint only）：本轮跳过
    return { topicMatches: [], topicSkipped: true }
  }

  // 规范化 topic tokens（去重）
  const normalizedTokens = new Set(tokens.map(normalizeText).filter(t => t.length > 0))
  if (normalizedTokens.size === 0) {
    return { topicMatches: [], topicSkipped: true }
  }

  // 逐条打分
  const scored: TopicLookupMatch[] = []
  for (const item of items) {
    const topicScore = scoreItemByTopicTokens(item, normalizedTokens)
    if (topicScore > 0) {
      scored.push({ item, topicScore })
    }
  }

  // 按 topicScore 降序，取前 limit
  const sorted = sortByTopicScoreDesc(scored)
  return { topicMatches: sorted.slice(0, limit), topicSkipped: false }
}

/**
 * 将 TopicLookup 结果与关键词候选池融合（并集 · 去重）。
 *
 * 融合策略：关键词结果为主，Topic 结果按 topicScore 加分后合并。
 * - 不做交集/交集筛除
 * - 不做主排序重排（保留关键词 score 主导）
 * - topicScore 仅作为 Topic 相关性信号，不替换已有 score
 *
 * 去重：相同 itemId 只保留一条（优先关键词结果，若无则用 Topic 结果）。
 *
 * @param keywordMatches 关键词路径候选（RecallMatch[]）
 * @param topicResult TopicLookup 结果
 * @param scoreBoost Topic 相关性加分幅度（默认 5，与 low-weight soft signal 对齐）
 * @returns 融合后的 RecallMatch[]（keywords 为主，Topic 结果附加 topicScore boost）
 */
export function mergeTopicLookupWithKeywordMatches(
  keywordMatches: import('@/core/recall/recall-result').RecallMatch[],
  topicResult: TopicLookupResult,
  scoreBoost: number = 5
): import('@/core/recall/recall-result').RecallMatch[] {
  if (topicResult.topicSkipped || topicResult.topicMatches.length === 0) {
    // Topic 不存在或为空：直接返回关键词结果
    return keywordMatches
  }

  // 构建已有 itemId 集合（关键词结果去重用）
  const keywordItemIds = new Set(keywordMatches.map(m => m.item.id))

  // 过滤掉关键词结果中已有的条目（避免重复）
  const newTopicMatches = topicResult.topicMatches.filter(tm => !keywordItemIds.has(tm.item.id))

  // 将新 Topic 条目转为 RecallMatch（注入 topicScore 作为 boost）
  const topicAsMatches: import('@/core/recall/recall-result').RecallMatch[] = newTopicMatches.map(
    tm => ({
      item: tm.item,
      // Topic 相关性作为 soft boost（topicScore 归一化到 0-5 范围）
      score: Math.round((tm.topicScore / 100) * scoreBoost),
      matchedFields: []
    })
  )

  // 并集
  return [...keywordMatches, ...topicAsMatches]
}
