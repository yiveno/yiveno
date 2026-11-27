/**
 * fixture 读写：dataset 拆成若干 JSON，提交入库。
 */

import type { BehaviorAblationDataset } from './types'
import { stableStringify } from './generate-dataset'

export interface BehaviorAblationFixtureFiles {
  meta: unknown
  corpus: unknown
  behavior: unknown
  clueViews: unknown
  mainTasks: unknown
  conflictProdTasks: unknown
  conflictMechTasks: unknown
}

export function datasetToFixtureFiles(
  dataset: BehaviorAblationDataset
): BehaviorAblationFixtureFiles {
  return {
    meta: dataset.meta,
    corpus: dataset.corpus,
    behavior: dataset.behavior,
    clueViews: dataset.clueViews,
    mainTasks: dataset.mainTasks,
    conflictProdTasks: dataset.conflictProdTasks,
    conflictMechTasks: dataset.conflictMechTasks
  }
}

export function fixtureFilesToDataset(
  files: BehaviorAblationFixtureFiles
): BehaviorAblationDataset {
  return {
    meta: files.meta as BehaviorAblationDataset['meta'],
    corpus: files.corpus as BehaviorAblationDataset['corpus'],
    behavior: files.behavior as BehaviorAblationDataset['behavior'],
    clueViews: files.clueViews as BehaviorAblationDataset['clueViews'],
    mainTasks: files.mainTasks as BehaviorAblationDataset['mainTasks'],
    conflictProdTasks: files.conflictProdTasks as BehaviorAblationDataset['conflictProdTasks'],
    conflictMechTasks: files.conflictMechTasks as BehaviorAblationDataset['conflictMechTasks']
  }
}

export const FIXTURE_FILE_NAMES = {
  meta: 'meta.json',
  corpus: 'corpus.json',
  behavior: 'behavior.json',
  clueViews: 'clue-views.json',
  mainTasks: 'tasks-main.json',
  conflictProdTasks: 'tasks-conflict-prod.json',
  conflictMechTasks: 'tasks-conflict-mech.json'
} as const

/** 单文件 canonical 串（测试对拍）。 */
export function fixtureCanonicalString(files: BehaviorAblationFixtureFiles): string {
  return stableStringify(files)
}
