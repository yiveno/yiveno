/**
 * Recall Outcome Labeling（§7.2）：提问 ↔ 答案对照。
 * 纯函数结算；UI / SW 只负责喂信号与落库/打日志。
 */

import { z } from 'zod'

/**
 * 会话级标签。
 * - target：短名单中该条即本次要找的
 * - none_in_results：列过的候选都不是
 * - absent：库内无相关（诚实 no_match）
 * - unknown：无足够信号（禁止用 last-click 填坑）
 */
export const RecallOutcomeLabelSchema = z.enum([
  'target', // 目标条目
  'none_in_results', // 以上都不是
  'absent', // 库内没有
  'unknown' // 未知
])

export type RecallOutcomeLabel = z.infer<typeof RecallOutcomeLabelSchema>

/**
 * 标签置信。
 * - strong：dismiss / no_match / 出口条
 * - medium_high：单条 reuse（copy / pack）
 * - medium：C1 单开即停
 * - medium_low：C2 多开后停（须 dwell）
 */
export const RecallOutcomeConfidenceSchema = z.enum([
  'strong', // 强
  'medium_high', // 中高
  'medium', // 中
  'medium_low' // 中低
])

export type RecallOutcomeConfidence = z.infer<typeof RecallOutcomeConfidenceSchema>

/**
 * 标签来源通道。
 * - mark：兼容旧落盘（UI Mark 通道已下线，不再产生新事件）
 * - dismiss：都不是这些
 * - no_match：诚实无相关
 * - exit_prompt：出口双按钮
 * - settled_single：C1
 * - settled_last：C2
 * - copy：复制/单条 pack
 * - unresolved：unknown
 */
export const RecallOutcomeSourceSchema = z.enum([
  'mark', // 兼容旧落盘；不再由 UI 产生
  'dismiss', // dismiss
  'no_match', // no_match
  'exit_prompt', // 出口条
  'settled_single', // C1
  'settled_last', // C2
  'copy', // C5
  'unresolved' // 未解析
])

export type RecallOutcomeSource = z.infer<typeof RecallOutcomeSourceSchema>

/** 会话内一次 explore open（≠ settle）。 */
export interface RecallOutcomeOpen {
  /** MemoryItem id */
  id: string
  /** ISO 打开时间 */
  at: string
  /** 停留毫秒；缺省则 C1/C2 不采信该次 open */
  dwellMs?: number
}

/** 结算输入（会话可结算时）。 */
export interface ResolveRecallOutcomeInput {
  /** 通道 D：出口选择 */
  exitChoice?: 'found' | 'none' | null
  /** 通道 D：Found it 时默认/选中的 id */
  exitFoundId?: string | null
  /** 通道 B：本会话在未再出候选前点过「都不是这些」 */
  dismissedPending?: boolean
  /** 通道 B′：最近一次结果为诚实 no_match 终局 */
  sawNoMatchFinal?: boolean
  /** 会话内 explore opens（按时间） */
  opens?: RecallOutcomeOpen[]
  /** 通道 C5：复制/单条 pack 的 id */
  copiedOrPackedId?: string | null
  /** 会话已 stop（New find / 关 Panel）；C1/C2 需要 */
  sessionStopped?: boolean
  /** dwell 阈值 ms；默认 10000 */
  dwellThresholdMs?: number
}

/** 结算结果（可写入 RecallOutcomeEvent）。 */
export interface ResolvedRecallOutcome {
  label: RecallOutcomeLabel
  targetId?: string
  confidence?: RecallOutcomeConfidence
  source: RecallOutcomeSource
}

/** 会话事件（本机优先；可与 TTE 埋点同源）。 */
export interface RecallOutcomeEvent {
  sessionId: string
  effectiveClue: string
  resultIds: string[]
  label: RecallOutcomeLabel
  targetId?: string
  confidence?: RecallOutcomeConfidence
  source: RecallOutcomeSource
  opens: RecallOutcomeOpen[]
  resolvedAt: string
}

const DEFAULT_DWELL_THRESHOLD_MS = 10_000

function uniqueOpenIds(opens: RecallOutcomeOpen[]): string[] {
  const seen = new Set<string>()
  const ids: string[] = []
  for (const open of opens) {
    const id = open.id.trim()
    if (!id || seen.has(id)) {
      continue
    }
    seen.add(id)
    ids.push(id)
  }
  return ids
}

function lastOpen(opens: RecallOutcomeOpen[]): RecallOutcomeOpen | null {
  if (opens.length === 0) {
    return null
  }
  return opens[opens.length - 1] ?? null
}

function meetsDwell(open: RecallOutcomeOpen | null, thresholdMs: number): boolean {
  if (!open || open.dwellMs === undefined) {
    return false
  }
  return open.dwellMs >= thresholdMs
}

/**
 * 按 §7.2 决策树结算会话标签。
 * 优先级：D 出口 > B dismiss / B′ no_match > C1 > C5 > C2 > unknown。
 * （通道 A Mark 已下线，不再参与结算。）
 */
export function resolveRecallOutcome(input: ResolveRecallOutcomeInput): ResolvedRecallOutcome {
  if (input.exitChoice === 'found') {
    const foundId = input.exitFoundId?.trim() || null
    if (foundId) {
      return {
        label: 'target',
        targetId: foundId,
        confidence: 'strong',
        source: 'exit_prompt'
      }
    }
  }

  if (input.exitChoice === 'none') {
    return {
      label: 'none_in_results',
      confidence: 'strong',
      source: 'exit_prompt'
    }
  }

  if (input.dismissedPending) {
    return {
      label: 'none_in_results',
      confidence: 'strong',
      source: 'dismiss'
    }
  }

  if (input.sawNoMatchFinal) {
    return {
      label: 'absent',
      confidence: 'strong',
      source: 'no_match'
    }
  }

  const opens = input.opens ?? []
  const threshold = input.dwellThresholdMs ?? DEFAULT_DWELL_THRESHOLD_MS
  const uniqueIds = uniqueOpenIds(opens)
  const last = lastOpen(opens)
  const stopped = Boolean(input.sessionStopped)

  // C1：只 open 一条 + dwell + stop
  if (
    stopped &&
    uniqueIds.length === 1 &&
    last &&
    last.id === uniqueIds[0] &&
    meetsDwell(last, threshold)
  ) {
    return {
      label: 'target',
      targetId: uniqueIds[0],
      confidence: 'medium',
      source: 'settled_single'
    }
  }

  const copied = input.copiedOrPackedId?.trim() || null
  if (copied) {
    return {
      label: 'target',
      targetId: copied,
      confidence: 'medium_high',
      source: 'copy'
    }
  }

  // C2：多开后最后一条 dwell+stop；无 dwell 不得升 medium
  if (stopped && uniqueIds.length > 1 && last && meetsDwell(last, threshold)) {
    return {
      label: 'target',
      targetId: last.id,
      confidence: 'medium_low',
      source: 'settled_last'
    }
  }

  return {
    label: 'unknown',
    source: 'unresolved'
  }
}

/** 组装会话事件（resolvedAt 默认 now）。 */
export function buildRecallOutcomeEvent(input: {
  sessionId: string
  effectiveClue: string
  resultIds: string[]
  opens?: RecallOutcomeOpen[]
  resolved: ResolvedRecallOutcome
  resolvedAt?: string
}): RecallOutcomeEvent {
  return {
    sessionId: input.sessionId,
    effectiveClue: input.effectiveClue,
    resultIds: input.resultIds,
    label: input.resolved.label,
    ...(input.resolved.targetId ? { targetId: input.resolved.targetId } : {}),
    ...(input.resolved.confidence ? { confidence: input.resolved.confidence } : {}),
    source: input.resolved.source,
    opens: input.opens ?? [],
    resolvedAt: input.resolvedAt ?? new Date().toISOString()
  }
}
