import { describe, expect, it } from 'vitest'

import { PARSE_GOLD_NOW_MS } from '@/core/recall/eval/parse-gold-now'
import { shouldRecallByConstraintNeighborhood } from '@/core/recall/orchestrate-keyword-recall'
import { parseRecallClue } from '@/core/recall/parse-recall-clue'
import { hasRecallTopicAnchor } from '@/core/recall/recall-topic'

/** 主题门禁：有主题锚，或进约束邻域（仅时间/类型/刚存），才进检索。 */
function passesTopicGate(clue: string): boolean {
  const parsed = parseRecallClue(clue, { nowMs: PARSE_GOLD_NOW_MS })
  return hasRecallTopicAnchor(parsed) || shouldRecallByConstraintNeighborhood(parsed)
}

describe('deriveRecallTopic', () => {
  it('泛指构造 / 口语泛指名词 → 无主题（missing_topic）', () => {
    // 探针 6 的 3 个 MISS + 构造变体（换指示词、换泛指名词都应拦）
    for (const clue of [
      '帮我找那玩意儿',
      'that thingy',
      '那啥',
      '这玩意儿',
      '那事儿',
      '这啥',
      '那玩意',
      '昨天那个东西',
      'that thing from yesterday',
      'that thing'
    ]) {
      expect(passesTopicGate(clue), clue).toBe(false)
    }
  })

  it('有真实主题的召回对照 → 仍有主题', () => {
    // 探针 6 的 10 条对照：构造不得误伤量词（首/篇）与真实主题词
    for (const clue of [
      '昨天的诗',
      'yesterday poem',
      '李白',
      '昨天那首关于李白的诗',
      'the article I read last week',
      'my password for github',
      '昨天看到的那篇文章',
      '那首关于秋天的诗',
      '昨天那个视频',
      'that song I kept listening to'
    ]) {
      expect(passesTopicGate(clue), clue).toBe(true)
    }
  })
})
