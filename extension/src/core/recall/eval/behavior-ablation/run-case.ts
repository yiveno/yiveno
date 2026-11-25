/**
 * 单任务 × 单臂：规则解析 + fake embed + fuseHybridMatches。
 */

import { fuseHybridMatches } from '@/application/recall/backends/hybrid-recall-backend'
import type { MemoryItem } from '@/core/memory/memory-item'
import type { ScoredCondition } from '@/core/recall/condition-credibility'
import {
  HYBRID_FAKE_EMBEDDING_DIM,
  makeFakeEmbedding
} from '@/core/recall/eval/hybrid-fake-embedding'
import { BEHAVIOR_ABLATION_NOW_MS } from '@/core/recall/eval/behavior-ablation/constants'
import type {
  ArmCaseResult,
  BehaviorAblationTask
} from '@/core/recall/eval/behavior-ablation/types'
import { parseRecallClue } from '@/core/recall/parse-recall-clue'
import type { RecallResult } from '@/core/recall/recall-result'
import { rankOfGold } from '@/core/recall/eval/metrics'

function rankedIdsFromResult(result: RecallResult | null): string[] {
  if (!result) {
    return []
  }
  const ids: string[] = []
  if (result.topPick) {
    ids.push(result.topPick.item.id)
  }
  for (const match of result.alsoPossible) {
    ids.push(match.item.id)
  }
  return ids
}

/**
 * 语音现行误打开：候选非空且排名第一不是目标。
 * （有候选默认开第一个；无置信度门。）
 */
export function isFalseOpen(rankedIds: readonly string[], targetId: string): boolean {
  if (rankedIds.length === 0) {
    return false
  }
  return rankedIds[0] !== targetId
}

export async function runArmCase(input: {
  task: BehaviorAblationTask
  arm: ArmCaseResult['arm']
  corpus: readonly MemoryItem[]
  conditions: readonly ScoredCondition[]
  nowMs?: number
}): Promise<ArmCaseResult> {
  const nowMs = input.nowMs ?? BEHAVIOR_ABLATION_NOW_MS
  const clue = input.task.clue.trim()
  const parsed = parseRecallClue(clue, { nowMs })
  const filterClue = parsed.contentTerms.join(' ').trim() || parsed.raw
  const queryVector = makeFakeEmbedding(input.task.embeddingAnchor, HYBRID_FAKE_EMBEDDING_DIM)

  const fused = await fuseHybridMatches({
    displayClue: clue,
    pairClue: clue,
    items: [...input.corpus],
    filterClue,
    parsed,
    clueEmbeddingText: input.task.embeddingAnchor,
    queryVector,
    trace: () => {},
    ...(input.conditions.length > 0 ? { conditions: input.conditions, conditionTurn: 0 } : {})
  })

  const result = fused?.result ?? null
  const rankedIds = rankedIdsFromResult(result)
  const rank = rankOfGold(rankedIds, input.task.targetId)
  const candidateNonEmpty = rankedIds.length > 0

  return {
    taskId: input.task.id,
    arm: input.arm,
    targetId: input.task.targetId,
    rankedIds,
    rank,
    candidateNonEmpty,
    falseOpen: isFalseOpen(rankedIds, input.task.targetId),
    top1Id: rankedIds[0] ?? null
  }
}
