/** Recall 结果卡点击意图（Side Panel 内一律 preventDefault，经 SW 导航）。 */

export type RecallCardClickAction =
  | { type: 'toggle-export'; memoryItemId: string }
  | {
      type: 'open'
      payload: { id: string; url: string; openInNewTab: boolean; rank?: number }
    }
  | { type: 'noop' }

export function resolveRecallCardClickAction(input: {
  showDetailExportSelection?: boolean
  detailExportDisabled: boolean
  memoryItemId: string
  url: string
  rank?: number
  metaKey: boolean
  ctrlKey: boolean
}): RecallCardClickAction {
  if (input.showDetailExportSelection) {
    if (input.detailExportDisabled) {
      return { type: 'noop' }
    }
    return { type: 'toggle-export', memoryItemId: input.memoryItemId }
  }

  return {
    type: 'open',
    payload: {
      id: input.memoryItemId,
      url: input.url,
      openInNewTab: input.metaKey || input.ctrlKey,
      ...(input.rank !== undefined ? { rank: input.rank } : {})
    }
  }
}
