/** 会话线程默认挂载的 turn 数（仅尾部窗口；用户可「Show earlier」展开）。 */
export const RECALL_CONVERSATION_MAX_DOM_TURNS = 14

/** 每次「Show earlier」再展开的 turn 数。 */
export const RECALL_CONVERSATION_TURN_PAGE_SIZE = 6

/** 当前窗口应从第几个 turn 开始切片（0-based）。 */
export function recallConversationVisibleStartIndex(
  totalTurns: number,
  earlierRevealedCount: number
): number {
  const safeTotal = Math.max(0, totalTurns)
  const defaultVisible = Math.min(safeTotal, RECALL_CONVERSATION_MAX_DOM_TURNS)
  const maxRevealable = Math.max(0, safeTotal - defaultVisible)
  const revealed = Math.min(Math.max(0, earlierRevealedCount), maxRevealable)
  return Math.max(0, safeTotal - defaultVisible - revealed)
}

/** 按尾部窗口 + 已展开 earlier 数切片可见 turn。 */
export function sliceVisibleConversationTurns<T>(
  turns: readonly T[],
  earlierRevealedCount: number
): T[] {
  const start = recallConversationVisibleStartIndex(turns.length, earlierRevealedCount)
  return turns.slice(start)
}

/** 仍隐藏在窗口之前的 turn 数。 */
export function recallHiddenEarlierTurnCount(
  totalTurns: number,
  earlierRevealedCount: number
): number {
  return recallConversationVisibleStartIndex(totalTurns, earlierRevealedCount)
}

/** 计算下一次 Show earlier 后应增加的 earlierRevealedCount。 */
export function resolveNextEarlierTurnReveal(
  currentEarlierRevealed: number,
  totalTurns: number,
  mode: 'page' | 'all'
): number {
  const hidden = recallHiddenEarlierTurnCount(totalTurns, currentEarlierRevealed)
  if (hidden <= 0) {
    return currentEarlierRevealed
  }
  if (mode === 'all') {
    return currentEarlierRevealed + hidden
  }
  return currentEarlierRevealed + Math.min(RECALL_CONVERSATION_TURN_PAGE_SIZE, hidden)
}
