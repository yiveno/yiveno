/**
 * Getting Started：导入完成后是否展示「建议开启同步」卡。
 */

export function shouldShowChromeBookmarkSyncSuggestion(input: {
  importCompleted: boolean
  syncEnabled: boolean
  dismissed: boolean
  /** ready / empty 两态展示；importing 等不展示 */
  libraryPhase: 'importing' | 'ready' | 'empty'
}): boolean {
  if (!input.importCompleted) {
    return false
  }
  if (input.syncEnabled) {
    return false
  }
  if (input.dismissed) {
    return false
  }
  return input.libraryPhase === 'ready' || input.libraryPhase === 'empty'
}
