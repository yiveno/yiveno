/**
 * Stage 2 数据集编排：语料 → 行为 → 逆向 clue（顺序不可交换）。
 * 语料 / 行为复用 behavior-ablation 生成器；clue 为本 stage 独立生成。
 */

import { applyBehaviorToCorpus, seedBehaviorRows } from '../../behavior-ablation/generate-behavior'
import { generateCorpus } from '../../behavior-ablation/generate-corpus'
import {
  CLUE_CHAIN_STAGE2_DATASET_VERSION,
  CLUE_CHAIN_STAGE2_NOW_ISO,
  CLUE_CHAIN_STAGE2_NOW_MS,
  CLUE_CHAIN_STAGE2_SEED,
  CLUE_CHAIN_STAGE2_SIZES
} from './constants'
import { assertStage2ViewsHaveNoBehaviorFields, generateStage2ClueTasks } from './generate-clues'
import type { Stage2Dataset } from './types'

/** 一次性生成完整数据集（纯函数；同种子逐字一致）。 */
export function generateStage2Dataset(seed: number = CLUE_CHAIN_STAGE2_SEED): Stage2Dataset {
  // 1) 语料（复用 behavior-ablation；规模由 BEHAVIOR_ABLATION_SIZES 硬约束 = 120）
  const { items: bareItems, views } = generateCorpus(seed)
  assertStage2ViewsHaveNoBehaviorFields(views)

  if (views.length !== CLUE_CHAIN_STAGE2_SIZES.corpusItems) {
    throw new Error(`corpus ${views.length} ≠ ${CLUE_CHAIN_STAGE2_SIZES.corpusItems}`)
  }

  // 2) 行为独立播种（不从 clue 反推）
  const behavior = seedBehaviorRows(views, seed)
  const corpus = applyBehaviorToCorpus(bareItems, behavior)

  // 3) 逆向 clue
  const tasks = generateStage2ClueTasks({ views, seed })

  const positiveTasks = tasks.filter(task => task.tier !== 'negative').length
  const negativeTasks = tasks.filter(task => task.tier === 'negative').length
  if (positiveTasks !== CLUE_CHAIN_STAGE2_SIZES.positiveTasks) {
    throw new Error(`positiveTasks ${positiveTasks}`)
  }
  if (negativeTasks !== CLUE_CHAIN_STAGE2_SIZES.negativeTasks) {
    throw new Error(`negativeTasks ${negativeTasks}`)
  }

  return {
    meta: {
      version: CLUE_CHAIN_STAGE2_DATASET_VERSION,
      seed,
      nowMs: CLUE_CHAIN_STAGE2_NOW_MS,
      nowIso: CLUE_CHAIN_STAGE2_NOW_ISO,
      corpusItems: corpus.length,
      topicClusters: CLUE_CHAIN_STAGE2_SIZES.topicClusters,
      positiveTasks,
      negativeTasks,
      totalTasks: tasks.length
    },
    corpus,
    behavior,
    clueViews: views,
    tasks
  }
}

/** 稳定 JSON（键排序）便于逐字对比。 */
export function stableStringifyStage2(value: unknown): string {
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
