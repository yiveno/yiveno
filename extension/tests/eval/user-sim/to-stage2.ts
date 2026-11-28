/**
 * user-sim 查询 → Stage2 任务适配。
 * embeddingAnchor 按 Stage2 的 fake 语义空间标定：concrete 对齐目标 aspect，
 * semi_fuzzy 对齐 topic 共享方向 + aspect 首词，vague 只对齐 topic 共享方向，
 * negative 使用正交锚。物品 embedding 由 generate.ts 用同一标定生成。
 * 这测的是确定性轨的解析/过滤/排序，不代表真实 embedding 质量；真实轨另行接入。
 */

import type { Stage2Task } from '../clue-chain/stage2/types'
import { userSimAspectSlug, type UserSimClueType, type UserSimDataset } from './generate'

const TIER_BY_CLUE_TYPE: Record<UserSimClueType, Stage2Task['tier']> = {
  concrete: 'concrete',
  paraphrase: 'semi_fuzzy',
  temporal: 'semi_fuzzy',
  associative: 'vague',
  vague: 'vague',
  negative: 'negative'
}

function embeddingAnchorFor(
  data: UserSimDataset,
  queryId: string,
  type: UserSimClueType,
  targetId: string | null
): string {
  if (type === 'negative' || targetId == null) {
    return `negative::${queryId}::orthogonal`
  }
  const topic = data.groundTruth.itemTopics[targetId] ?? 'unknown'
  const aspect = data.groundTruth.itemAspects[targetId] ?? 'detail'
  const slug = userSimAspectSlug(aspect)
  if (type === 'concrete') {
    return `${topic}::${slug}`
  }
  if (type === 'paraphrase' || type === 'temporal') {
    return `${topic}::shared::${slug.split('-')[0] ?? 'x'}`
  }
  return `${topic}::shared`
}

export function toStage2Tasks(data: UserSimDataset): Stage2Task[] {
  return data.groundTruth.queries.map(q => ({
    id: `${data.meta.persona}:${q.id}`,
    tier: TIER_BY_CLUE_TYPE[q.type],
    clue: q.clue,
    targetId: q.targetId,
    clusterId:
      q.targetId != null ? (data.groundTruth.itemTopics[q.targetId] ?? 'unknown') : `neg-${q.id}`,
    embeddingAnchor: embeddingAnchorFor(data, q.id, q.type, q.targetId),
    note: `user-sim ${q.type}; ${q.note}`
  }))
}
