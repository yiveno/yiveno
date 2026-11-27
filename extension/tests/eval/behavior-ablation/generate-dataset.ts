/**
 * 数据集编排：语料 → 行为 → clue（顺序不可交换）。
 */

import {
  BEHAVIOR_ABLATION_DATASET_VERSION,
  BEHAVIOR_ABLATION_NOW_ISO,
  BEHAVIOR_ABLATION_NOW_MS,
  BEHAVIOR_ABLATION_SEED,
  BEHAVIOR_ABLATION_SIZES
} from './constants'
import { applyBehaviorToCorpus, seedBehaviorRows } from './generate-behavior'
import { generateCorpus } from './generate-corpus'
import { assertClueViewsHaveNoBehaviorFields, generateClueTasks } from './generate-clues'
import type { BehaviorAblationDataset } from './types'

/** 一次性生成完整数据集（纯函数；同种子逐字一致）。 */
export function generateBehaviorAblationDataset(
  seed: number = BEHAVIOR_ABLATION_SEED
): BehaviorAblationDataset {
  // 1) 语料
  const { items: bareItems, views } = generateCorpus(seed)
  assertClueViewsHaveNoBehaviorFields(views)

  // 2) 行为（只吃 views + seed）
  const behavior = seedBehaviorRows(views, seed)
  const corpus = applyBehaviorToCorpus(bareItems, behavior)

  // 3) clue（签名禁止行为数值）
  const { mainTasks, conflictProdTasks, conflictMechTasks } = generateClueTasks({
    views,
    seed
  })

  if (mainTasks.length !== BEHAVIOR_ABLATION_SIZES.mainTasks) {
    throw new Error(`mainTasks ${mainTasks.length}`)
  }
  if (conflictProdTasks.length !== BEHAVIOR_ABLATION_SIZES.conflictProd) {
    throw new Error(`conflictProd ${conflictProdTasks.length}`)
  }
  if (conflictMechTasks.length !== BEHAVIOR_ABLATION_SIZES.conflictMech) {
    throw new Error(`conflictMech ${conflictMechTasks.length}`)
  }

  return {
    meta: {
      version: BEHAVIOR_ABLATION_DATASET_VERSION,
      seed,
      nowMs: BEHAVIOR_ABLATION_NOW_MS,
      nowIso: BEHAVIOR_ABLATION_NOW_ISO,
      corpusItems: corpus.length,
      topicClusters: BEHAVIOR_ABLATION_SIZES.topicClusters,
      mainTasks: mainTasks.length,
      conflictProd: conflictProdTasks.length,
      conflictMech: conflictMechTasks.length
    },
    corpus,
    behavior,
    clueViews: views,
    mainTasks,
    conflictProdTasks,
    conflictMechTasks
  }
}

/** 稳定 JSON（键排序）便于逐字对比。 */
export function stableStringify(value: unknown): string {
  return `${stringifySorted(value)}\n`
}

function stringifySorted(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value)
  }
  if (Array.isArray(value)) {
    return `[${value.map(item => stringifySorted(item)).join(',')}]`
  }
  const obj = value as Record<string, unknown>
  const keys = Object.keys(obj).sort()
  return `{${keys.map(key => `${JSON.stringify(key)}:${stringifySorted(obj[key])}`).join(',')}}`
}
