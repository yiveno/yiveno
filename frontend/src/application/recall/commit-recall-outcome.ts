/**
 * 提交 Recall Outcome 事件（§7.2）：打业务日志；settled 写库；P3 持久化 clue 对。
 */

import { optionalProp } from '@/core/common/optional-props'
import {
  buildRecallOutcomeEvent,
  resolveRecallOutcome,
  type RecallOutcomeEvent,
  type RecallOutcomeOpen,
  type ResolveRecallOutcomeInput
} from '@/core/recall/recall-outcome'
import {
  getRecallOutcomeSettlePolicy,
  recallOutcomeCountsAsSettled
} from '@/core/recall/recall-outcome-calibration'
import { buildRecallOutcomePairRecord } from '@/core/recall/recall-outcome-pairs'
import { flowOk, flowStart } from '@/infrastructure/logging/flow-log'
import { recordRecallSettle } from '@/infrastructure/messaging/background-client'
import { appendRecallOutcomePair } from '@/infrastructure/storage/recall-outcome-pairs-storage'

/** 会话信号快照（Side Panel 组件内持有；关 Panel 丢弃）。 */
export interface RecallOutcomeSessionState {
  sessionId: string
  effectiveClue: string
  resultIds: string[]
  opens: RecallOutcomeOpen[]
  exitChoice: 'found' | 'none' | null
  exitFoundId: string | null
  dismissedPending: boolean
  sawNoMatchFinal: boolean
  copiedOrPackedId: string | null
  /** 本会话是否已对 target 写过 settledCount（防出口 + 终局双计） */
  settleWriteDone: boolean
}

/** 新建空会话（New find / 初次打开）。 */
export function createRecallOutcomeSessionState(): RecallOutcomeSessionState {
  return {
    sessionId: crypto.randomUUID(),
    effectiveClue: '',
    resultIds: [],
    opens: [],
    exitChoice: null,
    exitFoundId: null,
    dismissedPending: false,
    sawNoMatchFinal: false,
    copiedOrPackedId: null,
    settleWriteDone: false
  }
}

/** 从会话状态构造结算输入。 */
export function toResolveRecallOutcomeInput(
  state: RecallOutcomeSessionState,
  options?: { sessionStopped?: boolean; dwellThresholdMs?: number }
): ResolveRecallOutcomeInput {
  return {
    exitChoice: state.exitChoice,
    exitFoundId: state.exitFoundId,
    dismissedPending: state.dismissedPending,
    sawNoMatchFinal: state.sawNoMatchFinal,
    opens: state.opens,
    copiedOrPackedId: state.copiedOrPackedId,
    ...optionalProp('sessionStopped', options?.sessionStopped),
    ...optionalProp('dwellThresholdMs', options?.dwellThresholdMs)
  }
}

/**
 * 结算并记录：flow 日志 +（若计 settled 且本会话尚未写过）写库。
 * 失败不抛给 UI（best-effort）。
 */
export async function commitRecallOutcome(input: {
  state: RecallOutcomeSessionState
  sessionStopped?: boolean
  reason: string
}): Promise<{ event: RecallOutcomeEvent; settleWritten: boolean }> {
  const startedAt = flowStart('RecallOutcome', '结算', {
    reason: input.reason,
    sessionId: input.state.sessionId
  })

  const resolved = resolveRecallOutcome(
    toResolveRecallOutcomeInput(input.state, {
      ...optionalProp('sessionStopped', input.sessionStopped),
      dwellThresholdMs: getRecallOutcomeSettlePolicy().dwellThresholdMs
    })
  )
  const event = buildRecallOutcomeEvent({
    sessionId: input.state.sessionId,
    effectiveClue: input.state.effectiveClue,
    resultIds: input.state.resultIds,
    opens: input.state.opens,
    resolved
  })

  const logData: Record<string, unknown> = {
    reason: input.reason,
    label: event.label,
    source: event.source,
    confidence: event.confidence ?? null,
    targetId: event.targetId ?? null,
    openCount: event.opens.length,
    c2SettleEnabled: getRecallOutcomeSettlePolicy().allowSettledLast,
    cluePreview: event.effectiveClue.slice(0, 80)
  }

  // §7.2 P3：本机持久化 (clue→target) / none 硬负例，供后续重排
  let pairPersisted = false
  try {
    const pair = buildRecallOutcomePairRecord({
      effectiveClue: event.effectiveClue,
      label: event.label,
      ...(event.targetId ? { targetId: event.targetId } : {}),
      resultIds: event.resultIds,
      ...(event.confidence ? { confidence: event.confidence } : {}),
      source: event.source,
      createdAt: event.resolvedAt,
      countsAsSettled: recallOutcomeCountsAsSettled(resolved)
    })
    if (pair) {
      await appendRecallOutcomePair(pair)
      pairPersisted = true
    }
  } catch {
    // 忽略：对写入失败不挡结算
  }
  logData.pairPersisted = pairPersisted

  flowOk('RecallOutcome', '结算', startedAt, logData)

  let settleWritten = input.state.settleWriteDone
  if (!input.state.settleWriteDone && recallOutcomeCountsAsSettled(resolved) && resolved.targetId) {
    try {
      await recordRecallSettle({ id: resolved.targetId })
      settleWritten = true
    } catch {
      // 忽略：settled 写库失败不挡会话；日志已记结算结论
    }
  }

  return { event, settleWritten }
}

/**
 * 是否应在同场 New find 前出示出口条（§7.2 通道 D）。
 * 关 Panel 不补问（无会话上下文）；仅 New find 路径调用。
 * 条件：曾 explore open，且尚无 B 强标签 / 出口选择。
 */
export function shouldOfferRecallOutcomeExitPrompt(state: {
  exitChoice: 'found' | 'none' | null
  dismissedPending: boolean
  sawNoMatchFinal: boolean
  opens: { id: string }[]
}): boolean {
  if (state.exitChoice) {
    return false
  }
  if (state.dismissedPending || state.sawNoMatchFinal) {
    return false
  }
  return state.opens.length > 0
}

/**
 * 给会话内最后一次 open 补 dwellMs（若尚未写）。
 * 返回新 opens 数组（不可变）。
 */
export function withFinalizedLastOpenDwell(
  opens: RecallOutcomeOpen[],
  nowMs = Date.now()
): RecallOutcomeOpen[] {
  if (opens.length === 0) {
    return opens
  }
  const last = opens[opens.length - 1]
  if (!last || last.dwellMs !== undefined) {
    return opens
  }
  const openedAt = Date.parse(last.at)
  if (Number.isNaN(openedAt)) {
    return opens
  }
  const dwellMs = Math.max(0, nowMs - openedAt)
  return [...opens.slice(0, -1), { ...last, dwellMs }]
}
