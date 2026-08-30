/** 距底部 threshold 内视为「黏底」（与 Side Panel 滚动区一致）。 */
export const RECALL_SHELL_STICK_TO_BOTTOM_THRESHOLD_PX = 96

export function isRecallShellNearBottom(
  element: HTMLElement,
  thresholdPx = RECALL_SHELL_STICK_TO_BOTTOM_THRESHOLD_PX
): boolean {
  const distance = element.scrollHeight - element.scrollTop - element.clientHeight
  return distance < thresholdPx
}

/** 将 scroll 事件合并到每帧最多一次，减轻快速滚动时的布局读取。 */
export function createRecallShellScrollListener(
  onStickToBottomChange: (stickToBottom: boolean) => void,
  thresholdPx = RECALL_SHELL_STICK_TO_BOTTOM_THRESHOLD_PX
): (event: Event) => void {
  let pending = false
  let latestElement: HTMLElement | null = null

  return (event: Event) => {
    const target = event.target
    if (!(target instanceof HTMLElement)) {
      return
    }
    latestElement = target
    if (pending) {
      return
    }
    pending = true
    requestAnimationFrame(() => {
      if (latestElement) {
        onStickToBottomChange(isRecallShellNearBottom(latestElement, thresholdPx))
      }
      pending = false
    })
  }
}

/** 下一帧滚到底（仅当仍应黏底时执行）。 */
export function scheduleRecallShellScrollToBottom(
  getScrollElement: () => HTMLElement | null,
  shouldStickToBottom: () => boolean
): void {
  requestAnimationFrame(() => {
    if (!shouldStickToBottom()) {
      return
    }
    const element = getScrollElement()
    if (!element) {
      return
    }
    element.scrollTop = element.scrollHeight
  })
}
