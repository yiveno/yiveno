/**
 * AI 路由选择策略纯函数（Batch 4）。
 *
 * 合格集内字典序：免费优先 → 日窗剩余比例高 → 分钟窗剩余比例高 → 付费 blended 单价低 → 注册表稳定序。
 * 预留线：interactive 恒 0；background 按 taskKind 分档。
 * 本模块不触 Env / 账本 IO / provider。
 */

import type { AiChatTaskKind } from '../../config/ai-task-kind'
import type { AiCandidateEntry } from './ai-candidate-registry'
import type { AiChatRequestPriority } from './ai-chat-provider'
import type { QuotaSnapshot } from './quota-ledger-state'

/** candidateId → 账本快照；缺失键或值为 null/undefined 视为无快照。 */
export type AiRoutingSnapshotMap = Readonly<Record<string, QuotaSnapshot | null | undefined>>

/**
 * background 预留线分档（日窗剩余比例须**高于**此值才可 reserve）。
 * - dreaming / extract：0.35
 * - enrichment / gs_samples / 其余 background：0.20
 */
export const BACKGROUND_RESERVE_FLOOR_BY_TASK: Readonly<Partial<Record<AiChatTaskKind, number>>> = {
  dreaming: 0.35,
  extract: 0.35,
  enrichment: 0.2,
  gs_samples: 0.2
}

/** 未在分档表登记的 background taskKind 默认预留线。 */
export const BACKGROUND_RESERVE_FLOOR_DEFAULT = 0.2

/**
 * 预留线：interactive 恒 0；background 按 taskKind 分档。
 */
export function reserveFloorForTask(
  taskKind: AiChatTaskKind,
  priority: AiChatRequestPriority
): number {
  if (priority !== 'background') return 0
  return BACKGROUND_RESERVE_FLOOR_BY_TASK[taskKind] ?? BACKGROUND_RESERVE_FLOOR_DEFAULT
}

/**
 * 隐私门：free_terms_unverified 不可路由（与 Batch 3 语义一致）。
 */
export function isPrivacyRoutable(candidate: AiCandidateEntry): boolean {
  return candidate.privacyTier !== 'free_terms_unverified'
}

/**
 * 付费 blended 单价：input×3 + output（每 1M token 加权和）。
 * 无 input/output 价格 → undefined（排序时排最后）。
 */
export function blendedPricePer1M(candidate: AiCandidateEntry): number | undefined {
  const price = candidate.paidPricePer1M
  if (!price) return undefined
  const hasInput = price.input !== undefined && Number.isFinite(price.input)
  const hasOutput = price.output !== undefined && Number.isFinite(price.output)
  if (!hasInput && !hasOutput) return undefined
  return (hasInput ? price.input! * 3 : 0) + (hasOutput ? price.output! : 0)
}

/**
 * 对合格候选按策略字典序稳定排序。
 *
 * 快照缺失：日/分钟剩余比例按 1 参与比较，但**排在有快照者之后**
 * （先比「是否有快照」，再比比例高低）。
 */
export function rankCandidates(
  candidates: readonly AiCandidateEntry[],
  snapshots: AiRoutingSnapshotMap
): AiCandidateEntry[] {
  return candidates
    .map((candidate, registryIndex) => ({ candidate, registryIndex }))
    .sort((a, b) =>
      compareCandidates(a.candidate, b.candidate, a.registryIndex, b.registryIndex, snapshots)
    )
    .map(entry => entry.candidate)
}

function compareCandidates(
  a: AiCandidateEntry,
  b: AiCandidateEntry,
  indexA: number,
  indexB: number,
  snapshots: AiRoutingSnapshotMap
): number {
  // 1. 免费优先（有 freeTier）
  const freeA = a.freeTier ? 1 : 0
  const freeB = b.freeTier ? 1 : 0
  if (freeA !== freeB) return freeB - freeA

  const snapA = snapshots[a.candidateId]
  const snapB = snapshots[b.candidateId]
  const hasSnapA = snapA != null
  const hasSnapB = snapB != null

  // 2. 日窗剩余：有快照优先，再比例高者优先；缺失按 1
  const dailyCmp = compareRemaining(hasSnapA, hasSnapB, dailyRatio(snapA), dailyRatio(snapB))
  if (dailyCmp !== 0) return dailyCmp

  // 3. 分钟窗剩余：同上
  const minuteCmp = compareRemaining(hasSnapA, hasSnapB, minuteRatio(snapA), minuteRatio(snapB))
  if (minuteCmp !== 0) return minuteCmp

  // 4. 付费 blended 单价低者优先；无价格排最后
  const priceCmp = comparePrice(blendedPricePer1M(a), blendedPricePer1M(b))
  if (priceCmp !== 0) return priceCmp

  // 5. 同分保持注册表顺序
  return indexA - indexB
}

/**
 * 有快照者排前；同有/同无时比例高者优先。
 * 缺失快照的比例已由调用方按 1 传入。
 */
function compareRemaining(
  hasSnapA: boolean,
  hasSnapB: boolean,
  ratioA: number,
  ratioB: number
): number {
  if (hasSnapA !== hasSnapB) return hasSnapA ? -1 : 1
  if (ratioA !== ratioB) return ratioB - ratioA
  return 0
}

function dailyRatio(snap: QuotaSnapshot | null | undefined): number {
  // 快照缺失：按 1；有快照但字段缺省（如付费无日限额）亦按 1
  if (snap == null) return 1
  return snap.dailyRemainingRatio ?? 1
}

function minuteRatio(snap: QuotaSnapshot | null | undefined): number {
  if (snap == null) return 1
  return snap.minuteRemainingRatio ?? 1
}

/** 有价格者优先于无价格；同有价格时低者优先。 */
function comparePrice(priceA: number | undefined, priceB: number | undefined): number {
  const hasA = priceA !== undefined
  const hasB = priceB !== undefined
  if (hasA !== hasB) return hasA ? -1 : 1
  if (!hasA || !hasB) return 0
  if (priceA !== priceB) return priceA - priceB
  return 0
}
