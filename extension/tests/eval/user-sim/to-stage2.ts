/**
 * user-sim 查询 → Stage2 任务适配。
 * embeddingAnchor 只用 clue 本身：确定性轨的 fake embedding 是 hash 向量，
 * 语义路径在此轨上等效关闭，指标测的是解析/过滤/排序与行为信号，不含语义加成。
 * 真实 embedding 轨（retrieval-ablation:real 同类）另行接入，不在本批范围。
 */

import type { Stage2Task } from '../clue-chain/stage2/types'
import type { UserSimClueType, UserSimDataset } from './generate'

const TIER_BY_CLUE_TYPE: Record<UserSimClueType, Stage2Task['tier']> = {
  concrete: 'concrete',
  paraphrase: 'semi_fuzzy',
  temporal: 'semi_fuzzy',
  associative: 'vague',
  vague: 'vague',
  negative: 'negative'
}

export function toStage2Tasks(data: UserSimDataset): Stage2Task[] {
  return data.groundTruth.queries.map(q => ({
    id: `${data.meta.persona}:${q.id}`,
    tier: TIER_BY_CLUE_TYPE[q.type],
    clue: q.clue,
    targetId: q.targetId,
    clusterId:
      q.targetId != null ? (data.groundTruth.itemTopics[q.targetId] ?? 'unknown') : `neg-${q.id}`,
    embeddingAnchor: q.clue,
    note: `user-sim ${q.type}; ${q.note}`
  }))
}
