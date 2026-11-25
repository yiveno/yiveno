/**
 * 画像可查性摘要：按状态分组 + §9.7 措辞（确定性，零 LLM）。
 */

import {
  portraitWordingKind,
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
}

/** 画像查询摘要。 */
export type PortraitSummary = {
  groups: Record<PortraitSummaryGroup, PortraitSummaryItem[]>
  /** 推断未进画像、待用户批准/忽略 */
  pendingInferences: PortraitSummaryItem[]
  /** 是否完全空（无任何非 invalid 事实） */
  empty: boolean
}

const GROUP_ORDER: PortraitSummaryGroup[] = ['verified', 'corroborated', 'unconfirmed', 'contested']

function toGroup(state: Exclude<PortraitFactState, 'invalid'>): PortraitSummaryGroup {
  return state
}

function toItem(fact: PortraitFactRecord): PortraitSummaryItem | null {
  if (fact.state === 'invalid') {
    return null
  }
  const sourceTypes = [...new Set(fact.sources.map(s => s.type))]
  const pendingInference = !fact.inPortrait && fact.sources.some(s => s.type === 'inference')
  return {
    factId: fact.id,
    slot: fact.slot,
    value: fact.value,
    credibility: fact.credibility,
    state: fact.state,
    inPortrait: fact.inPortrait,
    wording: portraitWordingKind(fact.credibility, fact.state),
    pendingInference,
    sourceTypes
  }
}

/**
 * 从 B 层行构建摘要（排除 invalid）。
 * pendingInferences：推断来源且未进画像，单独列出。
 */
export function buildPortraitSummary(facts: readonly PortraitFactRecord[]): PortraitSummary {
  const groups: Record<PortraitSummaryGroup, PortraitSummaryItem[]> = {
    verified: [],
    corroborated: [],
    unconfirmed: [],
    contested: []
  }
  const pendingInferences: PortraitSummaryItem[] = []
  let any = false

  for (const fact of facts) {
    const item = toItem(fact)
    if (!item) {
      continue
    }
    any = true
    groups[toGroup(item.state)].push(item)
    if (item.pendingInference) {
      pendingInferences.push(item)
    }
  }

  for (const key of GROUP_ORDER) {
    groups[key].sort((a, b) => b.credibility - a.credibility || a.value.localeCompare(b.value))
  }
  pendingInferences.sort((a, b) => a.value.localeCompare(b.value))

  return {
    groups,
    pendingInferences,
    empty: !any
  }
}
