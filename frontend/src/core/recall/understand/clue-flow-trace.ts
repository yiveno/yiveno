/**
 * 线索理解 / Recall 流水线可注入追踪（core 不依赖 infrastructure logger）。
 */

export type ClueFlowTraceLevel = 'debug' | 'info' | 'warn' | 'error'

/** 单步状态：level + 步骤名 + 可选结构化字段。 */
export type ClueFlowTrace = (
  level: ClueFlowTraceLevel,
  step: string,
  data?: Record<string, unknown>
) => void

/** 缺省无操作。 */
export const noopClueFlowTrace: ClueFlowTrace = () => {}
