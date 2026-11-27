/**
 * Topic 语义比对（LLM judge · 仅 harness）。
 * 禁止用精确字符串匹配判定 topic 通过。
 */

import type { LlmChatCompleter } from '@/core/recall/understand/parse-recall-clue-with-llm'
import type { ClueChainTopicJudgeResult } from './types'

/** Judge system prompt（校准用；改文案须重跑 10 条人工抽查）。 */
export const CLUE_CHAIN_TOPIC_JUDGE_SYSTEM = `You are a strict but fair semantic judge for a personal recall product.
Compare EXPECTED_TOPIC (human gold, may be Chinese) with ACTUAL_TOPIC_TERMS (model-extracted terms, any language).
Decide if they refer to the same underlying topic / subject matter for finding a saved item.
Ignore wording differences, language differences, extra modifiers, and granularity (e.g. "portable clothes wrinkle spray" vs ["除皱","喷雾","出差"]).
Fail only when the actual terms clearly point to a different subject, or are empty/useless while expected is specific.
Reply with ONLY compact JSON: {"match":true|false,"reason":"≤40 words"}`

export function buildTopicJudgeUserMessage(input: {
  clue: string
  expectedTopic: string
  actualTopicTerms: readonly string[]
}): string {
  return [
    `CLUE: ${input.clue}`,
    `EXPECTED_TOPIC: ${input.expectedTopic}`,
    `ACTUAL_TOPIC_TERMS: ${JSON.stringify(input.actualTopicTerms)}`
  ].join('\n')
}

function extractJsonObject(text: string): unknown {
  const trimmed = text.trim()
  try {
    return JSON.parse(trimmed)
  } catch {
    const start = trimmed.indexOf('{')
    const end = trimmed.lastIndexOf('}')
    if (start >= 0 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1))
    }
    throw new Error('topic judge 未返回 JSON 对象')
  }
}

/** 解析 judge 原始文本；畸形 → match=false。 */
export function parseTopicJudgeResponse(raw: string): ClueChainTopicJudgeResult {
  try {
    const obj = extractJsonObject(raw) as { match?: unknown; reason?: unknown }
    const match = obj.match === true
    const reason =
      typeof obj.reason === 'string' && obj.reason.trim().length > 0
        ? obj.reason.trim()
        : match
          ? 'semantic match'
          : 'semantic mismatch'
    return { match, reason, raw }
  } catch (error) {
    return {
      match: false,
      reason: `judge 解析失败：${error instanceof Error ? error.message : String(error)}`,
      raw
    }
  }
}

/**
 * 期望主题是否为「无法确定 / indeterminate / unspecified」类金标。
 * 仅 harness：这类金标表示诚实空主题，不是具体题材。
 */
export function isIndeterminateExpectedTopic(expectedTopic: string): boolean {
  const normalized = expectedTopic.trim().toLowerCase()
  if (!normalized) {
    return true
  }
  return (
    /无法确定|主题不明|不确定具体主题|具体主题不明|indeterminate|unspecified|unclear topic|topic unclear|no specific topic|主题不确定/.test(
      normalized
    ) ||
    normalized === 'unknown' ||
    normalized === 'n/a'
  )
}

/**
 * 对一条 topic 做语义裁判。
 * - expectedTopic 为空/null → 不调 LLM：记通过（宽松）
 * - 期望 indeterminate/unspecified 且实际 terms 为空 → 确定性 match（禁止 LLM 自由裁量抖动）
 * - 期望有具体主题且实际为空 → 确定性失败（仍不调 LLM）
 */
export async function judgeTopicSemantic(input: {
  clue: string
  expectedTopic: string | null
  actualTopicTerms: readonly string[]
  complete: LlmChatCompleter
}): Promise<ClueChainTopicJudgeResult> {
  if (input.expectedTopic == null || input.expectedTopic.trim() === '') {
    return {
      match: true,
      reason: '期望 topic 为空，跳过语义比对（记通过）'
    }
  }
  const actualEmpty =
    input.actualTopicTerms.length === 0 ||
    input.actualTopicTerms.every(term => term.trim().length === 0)
  if (actualEmpty) {
    if (isIndeterminateExpectedTopic(input.expectedTopic)) {
      return {
        match: true,
        reason: '期望主题 indeterminate/unspecified 且解析 terms 为空：确定性约定 match'
      }
    }
    return {
      match: false,
      reason: '期望有具体主题，实际 topic terms 为空'
    }
  }
  const text = await input.complete(
    [
      { role: 'system', content: CLUE_CHAIN_TOPIC_JUDGE_SYSTEM },
      {
        role: 'user',
        content: buildTopicJudgeUserMessage({
          clue: input.clue,
          expectedTopic: input.expectedTopic,
          actualTopicTerms: input.actualTopicTerms
        })
      }
    ],
    { taskKind: 'nlu', temperature: 0 }
  )
  return parseTopicJudgeResponse(text)
}
