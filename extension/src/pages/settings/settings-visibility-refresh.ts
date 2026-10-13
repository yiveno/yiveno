/** 从 Chrome 快捷键页返回后是否应静默刷新命令绑定。 */
export function shouldRefreshExtensionCommandsOnVisibility(input: {
  documentVisible: boolean
  awaitingShortcutsReturn: boolean
}): boolean {
  return input.documentVisible && input.awaitingShortcutsReturn
}

/** 标签重新可见时是否应刷新登录/同步/订阅快照。 */
export function shouldRefreshSyncContextOnVisibility(documentVisible: boolean): boolean {
  return documentVisible
}
