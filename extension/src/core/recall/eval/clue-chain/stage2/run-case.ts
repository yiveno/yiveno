/**
 * Stage 2 单案：规则解析 + fake embed + fuseHybridMatches；零真实 LLM。
 * 归因：parse / filtered / rank / false_hit / ok / error。
 */

import { fuseHybridMatches } from '@/application/recall/backends/hybrid-recall-backend'
import type { MemoryItem } from '@/core/memory/memory-item'
import { CLUE_CHAIN_STAGE2_NOW_MS } from '@/core/recall/eval/clue-chain/stage2/constants'
import type {
  Stage2CaseResult,
  Stage2FailStage,
  Stage2Task
} from '@/core/recall/eval/clue-chain/stage2/types'
import {
  HYBRID_FAKE_EMBEDDING_DIM,
  makeFakeEmbedding
} from '@/core/recall/eval/hybrid-fake-embedding'
import { rankOfGold } from '@/core/recall/eval/metrics'
import { parseRecallClue } from '@/core/recall/parse-recall-clue'
import type { RecallResult } from '@/core/recall/recall-result'

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
 * 正例归因：
 * - parse：contentTerms 空且 raw 也撑不起 filter → 信号在解析丢
 * - filtered：有 terms，但目标不在邻域
 * - rank：目标在邻域但非 Top1（指标层再看 @k；归因只标「在候选但靠后」）
 * - ok：目标在邻域（命中邻域即 ok；R@k 另计）
 */
export function attributePositiveCase(input: {
  contentTerms: readonly string[]
  filterClue: string
  rankedIds: readonly string[]
  targetId: string
}): { stage: Stage2FailStage; detail: string } {
  const { contentTerms, filterClue, rankedIds, targetId } = input
  const parseEmpty = contentTerms.length === 0 && filterClue.trim().length === 0
  const rank = rankOfGold(rankedIds, targetId)

  if (parseEmpty && rank === null) {
    return { stage: 'parse', detail: '解析无可用 terms，目标未进邻域' }
  }
  if (rank === null) {
    return {
      stage: 'filtered',
      detail:
        contentTerms.length === 0
          ? '解析 terms 弱，目标未进邻域（过滤/池外）'
          : '目标不在最终邻域（过滤或未过融合门）'
    }
  }
  if (rank > 1) {
    return { stage: 'rank', detail: `目标在邻域第 ${rank}（非 Top1）` }
  }
  return { stage: 'ok', detail: '目标 Top1' }
}

/** 负例归因：有 Top Pick → false_hit；否则 ok。 */
export function attributeNegativeCase(rankedIds: readonly string[]): {
  stage: Stage2FailStage
  detail: string
} {
  if (rankedIds.length > 0) {
    return {
      stage: 'false_hit',
      detail: `负例误命中 Top1=${rankedIds[0]}（邻域 ${rankedIds.length}）`
    }
  }
  return { stage: 'ok', detail: '负例无命中' }
}

/** 跑单案（确定性轨）。 */
export async function runStage2Case(input: {
  task: Stage2Task
  corpus: readonly MemoryItem[]
  nowMs?: number
}): Promise<Stage2CaseResult> {
  const nowMs = input.nowMs ?? CLUE_CHAIN_STAGE2_NOW_MS
  const started = Date.now()
  const clue = input.task.clue.trim()

  try {
    const parsed = parseRecallClue(clue, { nowMs })
    const contentTerms = [...(parsed.contentTerms ?? [])]
    const filterClue = contentTerms.join(' ').trim() || parsed.raw
    const queryVector = makeFakeEmbedding(input.task.embeddingAnchor, HYBRID_FAKE_EMBEDDING_DIM)

    const fused = await fuseHybridMatches({
      displayClue: clue,
      pairClue: clue,
      items: [...input.corpus],
      filterClue,
      parsed,
      clueEmbeddingText: input.task.embeddingAnchor,
      queryVector,
      trace: () => {}
    })

    const result = fused?.result ?? null
    const rankedIds = rankedIdsFromResult(result)
    const top3 = rankedIds.slice(0, 3)
    const durationMs = Date.now() - started

    if (input.task.tier === 'negative' || input.task.targetId == null) {
      const attr = attributeNegativeCase(rankedIds)
      return {
        taskId: input.task.id,
        tier: input.task.tier,
        clusterId: input.task.clusterId,
        clue,
        targetId: null,
        rankedIds,
        top3,
        rank: null,
        contentTerms,
        stage: attr.stage,
        detail: attr.detail,
        durationMs,
        error: null
      }
    }

    const rank = rankOfGold(rankedIds, input.task.targetId)
    const attr = attributePositiveCase({
      contentTerms,
      filterClue,
      rankedIds,
      targetId: input.task.targetId
    })

    return {
      taskId: input.task.id,
      tier: input.task.tier,
      clusterId: input.task.clusterId,
      clue,
      targetId: input.task.targetId,
      rankedIds,
      top3,
      rank,
      contentTerms,
      stage: attr.stage,
      detail: attr.detail,
      durationMs,
      error: null
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return {
      taskId: input.task.id,
      tier: input.task.tier,
      clusterId: input.task.clusterId,
      clue,
      targetId: input.task.targetId,
      rankedIds: [],
      top3: [],
      rank: null,
      contentTerms: [],
      stage: 'error',
      detail: `跑案异常：${message}`,
      durationMs: Date.now() - started,
      error: message
    }
  }
}
