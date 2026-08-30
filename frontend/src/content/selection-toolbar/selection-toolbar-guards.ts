/** 划词浮层 UI 模式（与 main.ts 对齐）。 */
export type SelectionToolbarUiMode = 'actions' | 'note'

/** 划词浮层主按钮状态（与 main.ts 对齐）。 */
export type SelectionToolbarButtonState = 'idle' | 'saving' | 'saved' | 'error'

/** 保存中 / 结果提示期间锁定浮层，避免滚动、点页、Esc 拆掉反馈。 */
export function isSelectionToolbarStatusLocked(buttonState: SelectionToolbarButtonState): boolean {
  return buttonState === 'saving' || buttonState === 'saved' || buttonState === 'error'
}

/**
 * 页面滚动时是否应收起浮层。
 * 附注输入中不收起（避免嵌套滚动 / 惯性滚动误关输入面板）。
 */
export function shouldDismissToolbarOnScroll(input: {
  statusLocked: boolean
  uiMode: SelectionToolbarUiMode
}): boolean {
  if (input.statusLocked) {
    return false
  }
  if (input.uiMode === 'note') {
    return false
  }
  return true
}
