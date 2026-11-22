/**
 * 多轮会话 accumulated 的可克隆化处理。
 *
 * 跟进轮次经 `chrome.runtime.sendMessage` 失败的两层根因：
 * 1. Vue deep reactive Proxy → structuredClone DataCloneError
 * 2. `topic.embedding`（Float32Array）跨 UI→SW 后 Zod `instanceof Float32Array` 失败 → RECALL_FAILED
 *    （「服务暂时出错」；请求未进 LLM → 配额扣 0）
 *
 * 写入：`markRaw` 禁止深度代理。
 * 发送：`toRaw` + 剥掉可再派生的 embedding（SW 合并后会再跑 withRecallTopicAsync）。
 */

import { markRaw, toRaw } from 'vue'

import type { ParsedRecallClue } from '@/core/recall/parse-recall-clue-types'

/** 写入 Side Panel 会话态前标记：勿对 parsed / embedding 做 deep reactive。 */
export function markAccumulatedForDialogState(parsed: ParsedRecallClue): ParsedRecallClue {
  return markRaw(parsed)
}

/**
 * 发往 Background 前：剥 Proxy，并去掉 topic.embedding。
 * embedding 仅本机检索派生态，不进消息契约；SW 侧会按需重算。
 */
export function toCloneableAccumulated(parsed: ParsedRecallClue): ParsedRecallClue {
  const raw = toRaw(parsed)
  if (!raw.topic || raw.topic.embedding === undefined) {
    return raw
  }
  const { embedding: _omitEmbedding, ...topicWithoutEmbedding } = raw.topic
  return {
    ...raw,
    topic: topicWithoutEmbedding
  }
}
