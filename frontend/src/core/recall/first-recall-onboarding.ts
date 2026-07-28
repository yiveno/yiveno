/**
 * 首次找回引导：何时展示「打开扩展试试」提示（纯函数）。
 * 存储读写见 infrastructure/storage/first-recall-onboarding-storage。
 */

/** 前几次摘录存成仍展示引导（已完成首次打开结果则不再展示）。 */
export const FIRST_RECALL_HINT_MAX_CAPTURES = 5

/** 是否应在存摘录成功后展示找回引导。 */
export function shouldShowFirstRecallHint(input: {
  excerptCaptureCount: number
  firstRecallOpenDone: boolean
}): boolean {
  if (input.firstRecallOpenDone) {
    return false
  }
  return (
    input.excerptCaptureCount >= 1 && input.excerptCaptureCount <= FIRST_RECALL_HINT_MAX_CAPTURES
  )
}
