/** 书签行激活后的动作：展开多选 / 打开 / 忽略。 */
export type BookmarkActivateAction = 'toggle' | 'open' | 'ignore'

/**
 * 解析书签行激活语义。
 * 鼠标路径一律打开（修饰键/中键/左键）；导出模式下无 memoryItemId 的行惰性。
 * `isKeyboard` 保留以便调用方与测试覆盖键盘路径（当前与鼠标同为 open）。
 */
export function resolveBookmarkActivateAction(input: {
  isKeyboard: boolean
  hasMemoryItemId: boolean
  exportMode: boolean
}): BookmarkActivateAction {
  void input.isKeyboard
  if (input.exportMode) {
    return input.hasMemoryItemId ? 'toggle' : 'ignore'
  }
  return 'open'
}
