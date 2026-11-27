/**
 * 画像可查性摘要：按状态分组 + §9.7 措辞（确定性，零 LLM）。
 */

import { clusterPendingInferences } from '@/core/portrait/cluster-pending-inferences'
import { isPortraitFunctionalTopicAnchor } from '@/core/portrait/portrait-functional-terms'
import {
  portraitContestedSlots,
  portraitWordingKind,
  resolvePortraitFactState,
  type PortraitFactRecord,
  type PortraitFactState,
  type PortraitWordingKind
} from '@/core/portrait/portrait-facts'

/** 摘要分组键（invalid 不进摘要）。 */
export type PortraitSummaryGroup =
  | 'verified' // 已核实
  | 'corroborated' // 已佐证
  | 'unconfirmed' // 未确认
  | 'contested' // 有争议

/** 展示门槛：独立来源 ref 数 ≥2，或 credibility ≥0.5。 */
export const PENDING_DISPLAY_MIN_SOURCE_REFS = 2
export const PENDING_DISPLAY_MIN_CREDIBILITY = 0.5

/** 单条摘要项（供 UI / i18n 渲染）。 */
export type PortraitSummaryItem = {
  factId: string
  slot: PortraitFactRecord['slot']
  value: string
  credibility: number
  state: Exclude<PortraitFactState, 'invalid'>
  inPortrait: boolean
  wording: PortraitWordingKind
  /** 推断来源且未进画像 → 供批准/忽略 */
  pendingInference: boolean
  sourceTypes: string[]
  /** 推断来源 note ref（共现聚类用） */
  sourceNoteRefs: string[]
}

/** 待确认簇（摘要层；与 cluster 纯函数输出同形，items 带摘要字段）。 */
export type PortraitPendingCluster = {
  clusterId: string
  label: string
  count: number
  items: PortraitSummaryItem[]
}

/** 画像查询摘要。 */
export type PortraitSummary = {
  groups: Record<PortraitSummaryGroup, PortraitSummaryItem[]>
  /** 达门槛的待确认推断，已按共现聚成簇 */
  clusters: PortraitPendingCluster[]
  /** 未达门槛 / 功能词过滤而未展示的 pending 计数 */
  hiddenPendingCount: number
  /** 是否完全空（无任何可见非 invalid 事实） */
  empty: boolean
}

const GROUP_ORDER: PortraitSummaryGroup[] = ['verified', 'corroborated', 'unconfirmed', 'contested']

function toGroup(state: Exclude<PortraitFactState, 'invalid'>): PortraitSummaryGroup {
  return state
}

/** 独立来源数：sources 中不同 ref（同一 note 多次只算 1）。 */
export function countDistinctPortraitSourceRefs(sources: readonly { ref: string }[]): number {
  return new Set(sources.map(s => s.ref)).size
}

/** 是否达到 pending 展示门槛。 */
export function meetsPendingInferenceDisplayThreshold(fact: {
  credibility: number
  sources: readonly { ref: string }[]
}): boolean {
  return (
    fact.credibility >= PENDING_DISPLAY_MIN_CREDIBILITY ||
    countDistinctPortraitSourceRefs(fact.sources) >= PENDING_DISPLAY_MIN_SOURCE_REFS
  )
}

function toItem(
  fact: PortraitFactRecord,
  contested: ReadonlySet<string>
): PortraitSummaryItem | null {
  if (fact.state === 'invalid') {
    return null
  }
  const sourceTypes = [...new Set(fact.sources.map(s => s.type))]
  const effectiveState = resolvePortraitFactState(fact.credibility, {
    hasCloseContradiction: contested.has(fact.slot)
  })
  if (effectiveState === 'invalid') {
    return null
  }
  const pendingInference = !fact.inPortrait && fact.sources.some(s => s.type === 'inference')
  const sourceNoteRefs = [
    ...new Set(fact.sources.filter(s => s.type === 'inference').map(s => s.ref))
  ]
  return {
    factId: fact.id,
    slot: fact.slot,
    value: fact.value,
    credibility: fact.credibility,
    state: effectiveState,
    inPortrait: fact.inPortrait,
    wording: portraitWordingKind(fact.credibility, effectiveState, sourceTypes),
    pendingInference,
    sourceTypes,
    sourceNoteRefs
  }
}

/**
 * 从 B 层行构建摘要（排除 invalid）。
 * pending：推断未进画像且达门槛 → 聚成簇；未达门槛/功能词 → hiddenPendingCount。
 * 读侧按互斥槽重算 contested，存量误标 contentTerm 可自愈。
 */
export function buildPortraitSummary(facts: readonly PortraitFactRecord[]): PortraitSummary {
  const contested = portraitContestedSlots(facts)
  const groups: Record<PortraitSummaryGroup, PortraitSummaryItem[]> = {
    verified: [],
    corroborated: [],
    unconfirmed: [],
    contested: []
  }
  const pendingItems: PortraitSummaryItem[] = []
  let hiddenPendingCount = 0
  let any = false

  for (const fact of facts) {
    const item = toItem(fact, contested)
    if (!item) {
      continue
    }
    if (item.pendingInference) {
      // 功能词存量行 / 未达门槛 → 不展示、不进摘要分组
      if (
        isPortraitFunctionalTopicAnchor(item.value) ||
        !meetsPendingInferenceDisplayThreshold(fact)
      ) {
        hiddenPendingCount += 1
        continue
      }
      pendingItems.push(item)
    }
    any = true
    groups[toGroup(item.state)].push(item)
  }

  for (const key of GROUP_ORDER) {
    groups[key].sort((a, b) => b.credibility - a.credibility || a.value.localeCompare(b.value))
  }

  const rawClusters = clusterPendingInferences(
    pendingItems.map(item => ({
      factId: item.factId,
      value: item.value,
      credibility: item.credibility,
      sourceNoteRefs: item.sourceNoteRefs
    }))
  )
  const byFactId = new Map(pendingItems.map(item => [item.factId, item]))
  const clusters: PortraitPendingCluster[] = rawClusters.map(cluster => ({
    clusterId: cluster.clusterId,
    label: cluster.label,
    count: cluster.count,
    items: cluster.items
      .map(row => byFactId.get(row.factId))
      .filter((row): row is PortraitSummaryItem => row != null)
  }))

  return {
    groups,
    clusters,
    hiddenPendingCount,
    empty: !any
  }
}
