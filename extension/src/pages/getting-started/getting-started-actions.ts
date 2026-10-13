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
