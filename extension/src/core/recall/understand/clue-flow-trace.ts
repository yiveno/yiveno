/**
 * 线索理解 / Recall 流水线可注入追踪（core 不依赖 infrastructure logger）。
 */

/** 流水线追踪级别。 */
export type ClueFlowTraceLevel =
  | 'debug' // 调试细节
  | 'info' // 正常步骤
  | 'warn' // 可恢复异常 / 降级
  | 'error' // 失败

/** 单步状态：level + 步骤名 + 可选结构化字段。 */
export type ClueFlowTrace = (
  level: ClueFlowTraceLevel,
  step: string,
  data?: Record<string, unknown>
) => void

/** 缺省无操作。 */
export const noopClueFlowTrace: ClueFlowTrace = () => {}
