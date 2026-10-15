/**
 * Recall 可见进展（§7.0）：真实 pipeline 阶段枚举与 UI 门控纯函数。
 * 禁止假进度；&lt;500ms 不展示阶段文案。
 */

/** 用户可见阶段（与 SW 推送 / i18n key 对齐）。 */
export type RecallVisibleProgressStage =
  | 'understanding' // 理解印象
  | 'narrowing' // 库内收窄
  | 'checking' // 核对最接近

export const RECALL_VISIBLE_PROGRESS_STAGES = [
  'understanding',
  'narrowing',
  'checking'
] as const satisfies readonly RecallVisibleProgressStage[]

/** 慢请求才展示阶段 UI 的门槛（毫秒）。 */
export const RECALL_VISIBLE_PROGRESS_REVEAL_MS = 500

/**
 * 每阶段在 UI 上至少停留多久（毫秒）。
 * 后半段 Filter/成卡常 &lt;100ms，不 pacing 则用户只看见 understanding。
 * 仍只展示真实已发生阶段，不造假步骤。
 */
export const RECALL_VISIBLE_PROGRESS_STAGE_MIN_DWELL_MS = 420

/** 阶段 → chrome.i18n message key（产品面仅 en）。 */
export const RECALL_VISIBLE_PROGRESS_MESSAGE_KEYS = {
  understanding: 'popup_recall_progress_understanding',
  narrowing: 'popup_recall_progress_narrowing',
  checking: 'popup_recall_progress_checking'
} as const satisfies Record<RecallVisibleProgressStage, string>

/** understanding 同阶段等待梯级 2（仍停在理解 · 毫秒）。 */
export const UNDERSTANDING_WAIT_TIER2_MS = 4_000

/** understanding 同阶段等待梯级 3（更慢 · 毫秒）。 */
export const UNDERSTANDING_WAIT_TIER3_MS = 8_000

/** 同阶段慢等梯级（仅 understanding；不改阶段枚举）。 */
export type RecallUnderstandingWaitTier = 1 | 2 | 3

/**
 * 按本轮 elapsed 选 understanding 等待梯级文案档。
 * 调用方须已过 500ms 揭示门控且 current===understanding。
 */
export function selectUnderstandingWaitTier(elapsedMs: number): RecallUnderstandingWaitTier {
  if (elapsedMs >= UNDERSTANDING_WAIT_TIER3_MS) {
    return 3
  }
  if (elapsedMs >= UNDERSTANDING_WAIT_TIER2_MS) {
    return 2
  }
  return 1
}

/** understanding 梯级 → i18n message key。 */
export function messageKeyForUnderstandingWaitTier(tier: RecallUnderstandingWaitTier): string {
  if (tier === 3) {
    return 'popup_recall_progress_understanding_slower'
  }
  if (tier === 2) {
    return 'popup_recall_progress_understanding_slow'
  }
  return RECALL_VISIBLE_PROGRESS_MESSAGE_KEYS.understanding
}

/**
 * 是否已过门控、可展示阶段文案。
 * @param elapsedMs 自本轮 Recall 开始经过的毫秒
 */
export function shouldRevealRecallVisibleProgress(
  elapsedMs: number,
  revealAfterMs: number = RECALL_VISIBLE_PROGRESS_REVEAL_MS
): boolean {
  return elapsedMs >= revealAfterMs
}

/**
 * 将新阶段并入已完成列表（幂等；保持 Normative 顺序）。
 */
export function advanceRecallVisibleProgress(
  previous: RecallVisibleProgressStage | null,
  next: RecallVisibleProgressStage,
  completed: readonly RecallVisibleProgressStage[]
): {
  current: RecallVisibleProgressStage
  completed: RecallVisibleProgressStage[]
} {
  const completedSet = new Set(completed)
  if (previous && previous !== next) {
    completedSet.add(previous)
  }
  // 若乱序收到已走过的阶段，仍记入 completed，不回退 current 语义由调用方决定
  const ordered = RECALL_VISIBLE_PROGRESS_STAGES.filter(stage => completedSet.has(stage))
  return { current: next, completed: ordered.filter(stage => stage !== next) }
}
