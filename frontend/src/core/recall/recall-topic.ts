/**
 * Recall 主题（H-topic · 根节点）：把无限自然语言招回压缩成有限问题空间的必要条件。
 *
 * - Topic 是 Recall 的**必要条件**：无主题锚的请求不属于当前定义的 Recall 问题（见产品文档
 *   「Recall Request 模型 + Discovery 边界」），不进检索、返回 `missing_topic`。
 * - Topic 只由**内容大意（C）**或**当时目标 / 附注（G）**构成；来源 / 时间 / 行为 / 感受是
 *   clue / preference，**不构成**主题。
 * - 判定基于解析结果的词法表示（非泛词内容词）；这与「Topic 是语义表示」的终态仍有距离，
 *   属已知演进项。
 */

import { effectiveContentTermsForRecall } from '@/core/recall/content-term-corroboration'
import { normalizeRecallText } from '@/core/recall/keyword-filter'
import type { ParsedRecallClue, RecallTopic } from '@/core/recall/parse-recall-clue-types'

/**
 * 无主题泛词：可进 contentTerms，但单独出现时不构成主题锚（H-topic）。
 * 与 `WEAK_PREFERENCE_RESIDUAL_TERMS` 分工不同：那里管"弱偏好残留不过佐证门"，
 * 这里管"泛词撑不起一次检索"。命中库内词面也不算主题（如满库都有 word）。
 */
export const GENERIC_NON_TOPIC_TERMS = new Set([
  'word',
  'words',
  'thing',
  'things',
  'stuff',
  'item',
  'items',
  'anything',
  'everything',
  'one',
  'ones',
  'time',
  'times',
  'before',
  'after',
  'ago',
  'back',
  'then',
  'when',
  'ever',
  'learn',
  'learns',
  'learned',
  'learnt',
  'learning',
  'studied',
  'studying',
  'remember',
  'remembered',
  'forgot',
  'forgotten',
  'found',
  'seen',
  'saw',
  'looked',
  'looking',
  'came',
  // 规则 parser 透传的停用词（无主题贡献）
  'was',
  'is',
  'are',
  'were',
  'be',
  'been',
  'being',
  'am',
  'that',
  'this',
  'these',
  'those',
  'the',
  'a',
  'an',
  'it',
  'its',
  'of',
  'on',
  'in',
  'at',
  'to',
  'and',
  'or',
  'with',
  'about',
  'as',
  'by',
  'into',
  'over',
  'up',
  'out',
  'off',
  'any',
  'my',
  'your',
  'his',
  'her',
  'their',
  'our',
  'once',
  // 中文泛指（规则 parser 透传；英文 parser 同理）
  '东西',
  '单词',
  '以前',
  '之前',
  '那个',
  '这个',
  '什么'
])

/**
 * 派生 Recall 主题（根节点）。
 * 有主题 = 有效内容词中至少一个非泛词（source=content），或附注指向（source=goal）。
 * 无主题（仅来源/时间/行为/感受/泛词）→ null（候选集无法缩小，返回什么都是错的）。
 */
export function deriveRecallTopic(parsed: ParsedRecallClue): RecallTopic | null {
  const terms = effectiveContentTermsForRecall(parsed).filter(
    term => !GENERIC_NON_TOPIC_TERMS.has(normalizeRecallText(term))
  )
  if (terms.length > 0) {
    return { terms, source: 'content', strength: 'strong' }
  }
  if (parsed.noteHint === true) {
    return { terms: [], source: 'goal', strength: 'weak' }
  }
  return null
}

/** 取解析结果的主题表示（已存则用已存，否则由内容词/附注派生）。 */
export function resolveRecallTopic(parsed: ParsedRecallClue): RecallTopic | null {
  return parsed.topic ?? deriveRecallTopic(parsed)
}

/**
 * 是否具备主题锚（Recall 的必要条件）。
 * 无主题锚 → 不进检索（`missing_topic`）。
 */
export function hasRecallTopicAnchor(parsed: ParsedRecallClue): boolean {
  return resolveRecallTopic(parsed) !== null
}

/** 幂等回填派生主题到 parsed，供结果 / Explain 携带。 */
export function withRecallTopic(parsed: ParsedRecallClue): ParsedRecallClue {
  if (parsed.topic) {
    return parsed
  }
  const topic = deriveRecallTopic(parsed)
  return topic ? { ...parsed, topic } : parsed
}
