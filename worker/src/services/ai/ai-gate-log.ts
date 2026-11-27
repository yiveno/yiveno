/**
 * Worker AI 门禁 / 解析失败日志字段组装（统一 event / taskKind / reason）。
 * 不改响应码与配额口径；仅规范日志 shape。
 */

/** 门禁拒收 reason 闭集。 */
export type AiGateRejectReason =
  | 'parse_failed' // JSON / 结构解析失败
  | 'validation_failed' // 结构化校验失败
  | 'quote_dropped' // Dreaming 引用未通过逐字校验被丢弃

export type AiGateRejectedLogFields = {
  event: 'ai_gate_rejected'
  taskKind: string
  reason: AiGateRejectReason
}

/** 组装统一拒收日志字段（可再展开业务附加字段）。 */
export function buildAiGateRejectedLogFields(
  taskKind: string,
  reason: AiGateRejectReason
): AiGateRejectedLogFields {
  return {
    event: 'ai_gate_rejected',
    taskKind,
    reason
  }
}
