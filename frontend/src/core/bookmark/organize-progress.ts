/** 一键整理进度阶段 */
export type OrganizeStageKey = 'load_bookmarks' | 'index_bookmarks' | 'ai_organize' | 'complete'

/** 一键整理固定四步顺序 */
export const ORGANIZE_STAGE_ORDER: readonly OrganizeStageKey[] = [
  'load_bookmarks',
  'index_bookmarks',
  'ai_organize',
  'complete'
] as const

export const ORGANIZE_TOTAL_STAGES = ORGANIZE_STAGE_ORDER.length

/** 单步在 UI 中的状态 */
export type OrganizeStepStatus = 'pending' | 'active' | 'completed'

/** 整理进度中用于展示的阶段计数类型 */
export type OrganizeStageUnit = 'none' | 'bookmarks' | 'batches'

/** 一键整理进度（应用层 → UI） */
export interface OrganizeProgress {
  totalStages: number
  currentStage: number
  stageKey: OrganizeStageKey
  /** 当前阶段内进度 0–1 */
  stageProgress: number
  /** 当前阶段计数分子 */
  stageCurrent: number
  /** 当前阶段计数分母 */
  stageTotal: number
  stageUnit: OrganizeStageUnit
  /** 辅助计数分子（如 AI 阶段已分析书签数） */
  detailCurrent: number
  /** 辅助计数分母 */
  detailTotal: number
  detailUnit: OrganizeStageUnit
  /** 参与整理的书签总数 */
  bookmarkCount: number
  isComplete: boolean
}

export interface OrganizeStepViewModel {
  key: OrganizeStageKey
  stepIndex: number
  status: OrganizeStepStatus
  /** 仅 active 步骤有意义 */
  stageProgress: number
  stageCurrent: number
  stageTotal: number
  stageUnit: OrganizeStageUnit
  detailCurrent: number
  detailTotal: number
  detailUnit: OrganizeStageUnit
}

/**
 * 计算整体进度（0–1）
 */
export function computeOrganizeOverallProgress(progress: OrganizeProgress): number {
  if (progress.isComplete) return 1
  const stageIndex = Math.max(0, Math.min(progress.currentStage - 1, ORGANIZE_TOTAL_STAGES - 1))
  const clampedStageProgress = Math.max(0, Math.min(progress.stageProgress, 1))
  return (stageIndex + clampedStageProgress) / ORGANIZE_TOTAL_STAGES
}

/**
 * 生成四步进度条视图模型
 */
export function buildOrganizeStepViewModels(progress: OrganizeProgress): OrganizeStepViewModel[] {
  return ORGANIZE_STAGE_ORDER.map((key, index) => {
    const stepNumber = index + 1
    let status: OrganizeStepStatus = 'pending'

    if (progress.isComplete || progress.currentStage > stepNumber) {
      status = 'completed'
    } else if (progress.currentStage === stepNumber) {
      status = progress.stageKey === 'complete' && progress.isComplete ? 'completed' : 'active'
    }

    const isActive = status === 'active'

    return {
      key,
      stepIndex: stepNumber,
      status,
      stageProgress: isActive ? progress.stageProgress : status === 'completed' ? 1 : 0,
      stageCurrent: isActive
        ? progress.stageCurrent
        : status === 'completed'
          ? progress.stageTotal
          : 0,
      stageTotal: isActive || status === 'completed' ? progress.stageTotal : 0,
      stageUnit: isActive ? progress.stageUnit : 'none',
      detailCurrent: isActive ? progress.detailCurrent : 0,
      detailTotal: isActive ? progress.detailTotal : 0,
      detailUnit: isActive ? progress.detailUnit : 'none'
    }
  })
}

/**
 * 创建初始整理进度
 */
export function createInitialOrganizeProgress(): OrganizeProgress {
  return {
    totalStages: ORGANIZE_TOTAL_STAGES,
    currentStage: 1,
    stageKey: 'load_bookmarks',
    stageProgress: 0,
    stageCurrent: 0,
    stageTotal: 0,
    stageUnit: 'none',
    detailCurrent: 0,
    detailTotal: 0,
    detailUnit: 'none',
    bookmarkCount: 0,
    isComplete: false
  }
}
