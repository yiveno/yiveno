import { USER_SETTINGS_STORAGE_KEY } from '@/core/settings/user-settings'
import {
  EXCERPT_CAPTURE_COUNT_LOCAL_KEY,
  FIRST_RECALL_OPEN_DONE_LOCAL_KEY
} from '@/infrastructure/storage/first-recall-onboarding-storage'

/** Getting Started 库侧三态：导入中 / 可召 / 空书签。 */
export type GettingStartedLibraryPhase = 'importing' | 'ready' | 'empty'

export interface GettingStartedProgress {
  /** 库侧已有书签可召 */
  canRecall: boolean
  /** 至少一次成功找回（邻域 top_pick 或打开结果） */
  recallDone: boolean
  /** 引导完成 = 召回成功 */
  allDone: boolean
  /** 主区三态 */
  libraryPhase: GettingStartedLibraryPhase
}

/**
 * 从库探测 + firstRecallOpenDone 推导引导态。
 * 书签首召：不再依赖 excerptCaptureCount。
 */
export function deriveGettingStartedProgress(input: {
  bookmarkCount: number
  firstRecallOpenDone: boolean
  /** 冷启动/导入是否仍在进行（尚无书签时显示 waiting） */
  inventorySettling: boolean
}): GettingStartedProgress {
  const canRecall = input.bookmarkCount > 0
  const recallDone = input.firstRecallOpenDone
  let libraryPhase: GettingStartedLibraryPhase
  if (canRecall) {
    libraryPhase = 'ready'
  } else if (input.inventorySettling) {
    libraryPhase = 'importing'
  } else {
    libraryPhase = 'empty'
  }
  return {
    canRecall,
    recallDone,
    allDone: recallDone,
    libraryPhase
  }
}

/**
 * 冷启动/导入是否仍在「未结算」：无书签时不应立刻判 empty。
 * ready/done 或明确失败 → 已结算；其余视为 settling。
 */
export function isGettingStartedInventorySettling(input: {
  coldStartStatus: string | null | undefined
  coldStartStage: string | null | undefined
  importStatus: string | null | undefined
}): boolean {
  const importStatus = input.importStatus
  if (importStatus === 'running' || importStatus === 'pending') {
    return true
  }
  if (importStatus === 'failed' || importStatus === 'completed') {
    // 导入已终态；若冷启动仍在 enrich 但已有书签会走 ready，无书签则 empty
    return false
  }
  const status = input.coldStartStatus
  const stage = input.coldStartStage
  if (status === 'ready' || stage === 'done') {
    return false
  }
  if (status === 'failed') {
    return false
  }
  // 尚无冷启动快照或仍在 import/enrich → 等待
  return true
}

/**
 * 从摘录条数推导库侧 phase（无 settling；空=诚实未存过）。
 */
export function deriveGettingStartedExcerptPhase(excerptCount: number): GettingStartedLibraryPhase {
  return excerptCount > 0 ? 'ready' : 'empty'
}

/** local storage 变更是否应刷新引导进度（召回完成 / 摘录次数）。 */
export function shouldRefreshGettingStartedProgress(
  changes: Record<string, unknown>,
  areaName: string
): boolean {
  if (areaName !== 'local') {
    return false
  }
  return (
    FIRST_RECALL_OPEN_DONE_LOCAL_KEY in changes ||
    EXCERPT_CAPTURE_COUNT_LOCAL_KEY in changes ||
    USER_SETTINGS_STORAGE_KEY in changes
  )
}
