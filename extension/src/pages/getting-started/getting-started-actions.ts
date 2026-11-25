/** Getting Started 是否可提交 clue。 */
export function canSubmitGettingStartedRecall(input: {
  recallBusy: boolean
  canRecall: boolean
  clue: string
  /** 书签 tab 须已同意灌库；摘录 tab 传 true */
  sourceUnlocked: boolean
}): boolean {
  return (
    input.sourceUnlocked && !input.recallBusy && input.canRecall && input.clue.trim().length > 0
  )
}

/**
 * GS 按钮手势内开壳：先开火 `openShell`（不 await），再落 done / 可选预填。
 * 禁止先 await storage——会丢掉 `sidePanel.open` 所需用户手势（与 Omnibox / 划词同铁律）。
 */
export async function openGettingStartedRecallShell(input: {
  openShell: () => Promise<void>
  markDone: () => Promise<void>
  writePrefill?: () => Promise<void>
}): Promise<void> {
  const opening = input.openShell()
  await input.markDone()
  if (input.writePrefill) {
    await input.writePrefill()
  }
  await opening
}
