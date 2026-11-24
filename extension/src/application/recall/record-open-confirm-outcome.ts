/**
 * 结果卡「点击打开即确认」：立刻写入 clue→target Outcome 对，供下次 Recall 软抬。
 */

import {
  fingerprintRecallClue,
  type RecallOutcomePairRecord
} from '@/core/recall/recall-outcome-pairs'
import { flowOk, flowStart } from '@/infrastructure/logging/flow-log'
import { appendRecallOutcomePair } from '@/infrastructure/storage/recall-outcome-pairs-storage'

/** 构造点击确认正例对；线索空则 null。 */
export function buildOpenConfirmOutcomePair(input: {
  effectiveClue: string
  targetId: string
  createdAt?: string
}): RecallOutcomePairRecord | null {
  const fingerprint = fingerprintRecallClue(input.effectiveClue)
  const targetId = input.targetId.trim()
  if (!fingerprint || !targetId) {
    return null
  }
  return {
    fingerprint,
    cluePreview: input.effectiveClue.trim().slice(0, 80),
    label: 'target',
    targetId,
    confidence: 'medium_high',
    source: 'open_confirm',
    createdAt: input.createdAt ?? new Date().toISOString()
  }
}

/** 持久化点击确认对（best-effort；失败不抛给 UI）。 */
export async function recordOpenConfirmOutcomePair(input: {
  effectiveClue: string
  targetId: string
}): Promise<boolean> {
  const startedAt = flowStart('RecallOutcome', '点击打开确认')
  const pair = buildOpenConfirmOutcomePair(input)
  if (!pair) {
    flowOk('RecallOutcome', '点击打开确认', startedAt, { persisted: false, reason: 'empty' })
    return false
  }
  try {
    await appendRecallOutcomePair(pair)
    flowOk('RecallOutcome', '点击打开确认', startedAt, {
      persisted: true,
      targetId: pair.targetId,
      fingerprintPreview: pair.fingerprint.slice(0, 40)
    })
    return true
  } catch {
    flowOk('RecallOutcome', '点击打开确认', startedAt, { persisted: false, reason: 'write_failed' })
    return false
  }
}
