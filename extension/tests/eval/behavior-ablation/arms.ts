/**
 * 生产轨四臂 / 机制轨两臂构造。
 */

import type { MemoryItem } from '@/core/memory/memory-item'
import {
  initialCredibility,
  mergeConditionValues,
  mergeSessionConditions,
  resolveConditionConflicts,
  type ScoredCondition
} from '@/core/recall/condition-credibility'
import { clearBehaviorOnCorpus } from './generate-behavior'
import type { BehaviorAblationTask, MechArmId, MechConflictTask, ProdArmId } from './types'
import type { ParsedRecallClue } from '@/core/recall/parse-recall-clue-types'

export interface ProdArmBundle {
  arm: ProdArmId
  corpus: MemoryItem[]
  conditions: ScoredCondition[]
}

export interface MechArmBundle {
  arm: MechArmId
  corpus: MemoryItem[]
  conditions: ScoredCondition[]
}

/** OFF：行为全清零、条件空。 */
export function buildOffArm(seededCorpus: readonly MemoryItem[]): ProdArmBundle {
  return {
    arm: 'OFF',
    corpus: clearBehaviorOnCorpus(seededCorpus),
    conditions: []
  }
}

/** ON-beh：播种行为、条件空。 */
export function buildOnBehArm(seededCorpus: readonly MemoryItem[]): ProdArmBundle {
  return {
    arm: 'ON-beh',
    corpus: [...seededCorpus],
    conditions: []
  }
}

/** ON-cond：行为清零 + 陈述条件（mergeSessionConditions）。 */
export function buildOnCondArm(
  seededCorpus: readonly MemoryItem[],
  parsed: ParsedRecallClue,
  nowMs: number
): ProdArmBundle {
  const conditions = mergeSessionConditions({
    existing: [],
    incomingParsed: parsed,
    turnIndex: 0,
    nowMs
  })
  return {
    arm: 'ON-cond',
    corpus: clearBehaviorOnCorpus(seededCorpus),
    conditions
  }
}

/** ON-prod：播种行为 + 陈述条件。 */
export function buildOnProdArm(
  seededCorpus: readonly MemoryItem[],
  parsed: ParsedRecallClue,
  nowMs: number
): ProdArmBundle {
  const conditions = mergeSessionConditions({
    existing: [],
    incomingParsed: parsed,
    turnIndex: 0,
    nowMs
  })
  return {
    arm: 'ON-prod',
    corpus: [...seededCorpus],
    conditions
  }
}

export function buildProdArmsForTask(
  seededCorpus: readonly MemoryItem[],
  parsed: ParsedRecallClue,
  nowMs: number
): ProdArmBundle[] {
  return [
    buildOffArm(seededCorpus),
    buildOnProdArm(seededCorpus, parsed, nowMs),
    buildOnBehArm(seededCorpus),
    buildOnCondArm(seededCorpus, parsed, nowMs)
  ]
}

/**
 * 机制轨：注入 behavior(0.8) vs statement(0.5) 指向不同值。
 * B-on：行为来源条件；B-off：同条件改记 statement。
 */
export function buildMechArmsForTask(
  seededCorpus: readonly MemoryItem[],
  task: MechConflictTask,
  nowMs: number
): MechArmBundle[] {
  const statementRow = {
    value: task.statementConditionValue,
    credibility: initialCredibility('statement', 'neutral'),
    source: 'statement' as const,
    certainty: 'neutral' as const,
    lastMentionedTurn: 0,
    effectiveAtMs: nowMs,
    active: true
  }

  const behaviorRowOn = {
    value: task.behaviorConditionValue,
    credibility: initialCredibility('behavior'),
    source: 'behavior' as const,
    certainty: 'neutral' as const,
    lastMentionedTurn: 0,
    effectiveAtMs: nowMs,
    active: true
  }

  const behaviorRowOff = {
    ...behaviorRowOn,
    credibility: initialCredibility('statement', 'neutral'),
    source: 'statement' as const
  }

  const mergedOn = resolveConditionConflicts(
    mergeConditionValues(task.conditionSlot, [statementRow], [behaviorRowOn], {
      currentTurn: 0
    })
  )
  const mergedOff = resolveConditionConflicts(
    mergeConditionValues(task.conditionSlot, [statementRow], [behaviorRowOff], {
      currentTurn: 0
    })
  )

  return [
    { arm: 'B-on', corpus: [...seededCorpus], conditions: mergedOn },
    { arm: 'B-off', corpus: [...seededCorpus], conditions: mergedOff }
  ]
}

export function isMechConflictTask(task: BehaviorAblationTask): task is MechConflictTask {
  return task.track === 'mech_conflict'
}

/** 测试用：OFF 确实清零。 */
export function assertOffClearsBehaviorAndConditions(bundle: ProdArmBundle): void {
  if (bundle.arm !== 'OFF') {
    throw new Error('expect OFF')
  }
  if (bundle.conditions.length !== 0) {
    throw new Error('OFF 条件须空')
  }
  for (const item of bundle.corpus) {
    if ((item.clues.openCount ?? 0) !== 0) throw new Error(`OFF openCount ${item.id}`)
    if ((item.clues.settledCount ?? 0) !== 0) throw new Error(`OFF settledCount ${item.id}`)
    if ((item.clues.dismissCount ?? 0) !== 0) throw new Error(`OFF dismissCount ${item.id}`)
    if (item.clues.lastOpenedAt) throw new Error(`OFF lastOpenedAt ${item.id}`)
  }
}
