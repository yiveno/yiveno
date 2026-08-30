/** Getting Started 演示保存按钮状态。 */
export type GettingStartedSaveState = 'idle' | 'saving' | 'saved' | 'error'

export function canSaveGettingStartedDemo(input: {
  saveState: GettingStartedSaveState
  captureDone: boolean
}): boolean {
  return input.saveState !== 'saving' && !input.captureDone
}

export function canTryGettingStartedRecall(input: {
  recallBusy: boolean
  captureDone: boolean
  recallDone: boolean
}): boolean {
  return !input.recallBusy && input.captureDone && !input.recallDone
}
