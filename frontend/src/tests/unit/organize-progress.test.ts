import { describe, expect, it } from 'vitest'
import {
  buildOrganizeStepViewModels,
  computeOrganizeOverallProgress,
  createInitialOrganizeProgress
} from '@/core/bookmark/organize-progress'

describe('organize-progress', () => {
  it('初始整体进度为 0', () => {
    const progress = createInitialOrganizeProgress()
    expect(computeOrganizeOverallProgress(progress)).toBe(0)
  })

  it('四步均分整体进度', () => {
    const progress = {
      ...createInitialOrganizeProgress(),
      currentStage: 3,
      stageKey: 'ai_organize' as const,
      stageProgress: 0.5,
      stageCurrent: 1,
      stageTotal: 2,
      stageUnit: 'batches' as const,
      detailCurrent: 20,
      detailTotal: 40,
      detailUnit: 'bookmarks' as const,
      bookmarkCount: 40
    }

    expect(computeOrganizeOverallProgress(progress)).toBeCloseTo(0.625)
  })

  it('生成四步视图并标记完成态', () => {
    const progress = {
      ...createInitialOrganizeProgress(),
      currentStage: 4,
      stageKey: 'complete' as const,
      stageProgress: 1,
      stageCurrent: 1,
      stageTotal: 1,
      stageUnit: 'none' as const,
      detailCurrent: 0,
      detailTotal: 0,
      detailUnit: 'none' as const,
      bookmarkCount: 13,
      isComplete: true
    }

    const steps = buildOrganizeStepViewModels(progress)
    expect(steps).toHaveLength(4)
    expect(steps.every(step => step.status === 'completed')).toBe(true)
  })
})
