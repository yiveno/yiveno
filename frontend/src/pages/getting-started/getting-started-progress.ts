import {
  EXCERPT_CAPTURE_COUNT_LOCAL_KEY,
  FIRST_RECALL_OPEN_DONE_LOCAL_KEY,
  GETTING_STARTED_RECALL_SHELL_OPENED_LOCAL_KEY
} from '@/infrastructure/storage/first-recall-onboarding-storage'

export interface GettingStartedProgress {
  captureDone: boolean
  recallDone: boolean
  allDone: boolean
}

/** 从 storage 计数推导引导步骤完成态。 */
export function deriveGettingStartedProgress(input: {
  excerptCaptureCount: number
  firstRecallOpenDone: boolean
  gettingStartedRecallShellOpened: boolean
}): GettingStartedProgress {
  const captureDone = input.excerptCaptureCount > 0
  const recallDone = input.firstRecallOpenDone || input.gettingStartedRecallShellOpened
  return {
    captureDone,
    recallDone,
    allDone: captureDone && recallDone
  }
}

/** local storage 变更是否应刷新引导进度。 */
export function shouldRefreshGettingStartedProgress(
  changes: Record<string, unknown>,
  areaName: string
): boolean {
  if (areaName !== 'local') {
    return false
  }
  return (
    EXCERPT_CAPTURE_COUNT_LOCAL_KEY in changes ||
    FIRST_RECALL_OPEN_DONE_LOCAL_KEY in changes ||
    GETTING_STARTED_RECALL_SHELL_OPENED_LOCAL_KEY in changes
  )
}
