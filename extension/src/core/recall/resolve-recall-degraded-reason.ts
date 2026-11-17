/**
 * in-Recall 降级原因（诚实归因附录 Stage 2d）。
 * 只在通用 miss 时提示：本轮理解实际走了规则，且能归因到 AI 关 / 未登录。
 *
 * 开发构建 caveat：未登录仍可能有 IP 代理 completer → 实际 `source` 可能是 `llm`。
 * 本函数只看实际 source，绝不只凭登录态推断「应为规则」。
 */

import type {
  ClueUnderstandingMode,
  ClueUnderstandingSource
} from '@/core/recall/understand/understand-recall-clue'

/** 用户可行动的本轮降级原因。 */
export type RecallDegradedReason = 'ai_off' | 'not_signed_in'

/**
 * 由本轮理解元数据 + cold-start 探针判定是否追加降级段。
 *
 * 判定顺序（相对 Brief 原文微调 · 见下）：
 * 1. 非 `rules` → null（llm / rules_fallback 等；fallback 已有 tip）
 * 2. `aiFeaturesEnabled === false` → ai_off
 * 3. 任一探针未知 → null
 * 4. `signedIn === false` → not_signed_in
 * 5. `mode === 'lexical'` → null（有 completer 时的纯 URL 等；与开关无关）
 * 6. 其余 → null
 *
 * **为何不把 lexical 放最前：** `selectClueUnderstandingMode` 在无 completer 时
 * **一律**标 lexical（含口语线索）。若先挡 lexical，AI 关 / 未登录降级段永远不出现。
 * 纯 URL 在 AI 开且已登录时仍会在第 5 步被挡掉。
 */
export function resolveRecallDegradedReason(input: {
  source: ClueUnderstandingSource | undefined
  mode: ClueUnderstandingMode | undefined
  /** null = 未知（不猜） */
  signedIn: boolean | null
  /** null = 未知（不猜） */
  aiFeaturesEnabled: boolean | null
}): RecallDegradedReason | null {
  // llm 成功无降级；rules_fallback 已有 deeper-reading tip，不叠加
  if (input.source !== 'rules') {
    return null
  }
  // AI 关优先于未登录：关时无论登录与否都不产生 LLM 理解
  if (input.aiFeaturesEnabled === false) {
    return 'ai_off'
  }
  // 未知时不许猜：AI 态未知，或登录态未知 → 不显示
  if (input.aiFeaturesEnabled === null || input.signedIn === null) {
    return null
  }
  if (input.signedIn === false) {
    return 'not_signed_in'
  }
  // 有能力却仍 lexical（纯 URL 等）→ 与开关无关，不叠降级段
  if (input.mode === 'lexical') {
    return null
  }
  return null
}
