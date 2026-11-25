/**
 * 打开确认 → B 层晋升；dismiss → B 层矛盾；批准 / 忽略。
 */

import {
  applyPortraitApprove,
  applyPortraitContradiction,
  applyPortraitDecline,
  buildPortraitFactId,
  normalizePortraitValue,
  promoteConditionToPortraitFact,
  type PortraitFactRecord
} from '@/core/portrait/portrait-facts'
import type { ScoredCondition } from '@/core/recall/condition-credibility'
import { getCurrentOwnerId } from '@/infrastructure/identity/local-profile-service'
import { portraitFactsRepository } from '@/infrastructure/indexeddb/portrait-facts-repository'
import { logger } from '@/infrastructure/logging/logger'

/** 确认晋升：对活跃条件逐条晋升。 */
export async function promotePortraitOnConfirm(input: {
  conditions: readonly ScoredCondition[]
  sourceRef?: string
}): Promise<{ promoted: number }> {
  const active = input.conditions.filter(c => c.active !== false)
  if (active.length === 0) {
    return { promoted: 0 }
  }
  const ownerId = await getCurrentOwnerId()
  const nowIso = new Date().toISOString()
  const sourceRef = input.sourceRef ?? `confirm:${nowIso}`
  let promoted = 0
  for (const condition of active) {
    const id = buildPortraitFactId(ownerId, condition.slot, condition.value)
    const existing = await portraitFactsRepository.getById(id)
    const next = promoteConditionToPortraitFact({
      existing,
      ownerId,
      condition,
      nowIso,
      sourceRef
    })
    await portraitFactsRepository.put(next)
    promoted += 1
  }
  logger.info('Portrait', '确认晋升完成', { ownerId, promoted })
  return { promoted }
}

/**
 * dismiss：按条件值或显式 factId 对 B 层施矛盾。
 * 找不到同行则跳过（A 层矛盾已在会话态另行施加）。
 */
export async function refutePortraitOnDismiss(input: {
  conditions?: readonly ScoredCondition[]
  factIds?: readonly string[]
  domainValues?: readonly string[]
}): Promise<{ refuted: number }> {
  const ownerId = await getCurrentOwnerId()
  const nowIso = new Date().toISOString()
  const ids = new Set<string>(input.factIds ?? [])
  for (const condition of input.conditions ?? []) {
    if (condition.active === false) {
      continue
    }
    ids.add(buildPortraitFactId(ownerId, condition.slot, condition.value))
  }
  for (const domain of input.domainValues ?? []) {
    ids.add(buildPortraitFactId(ownerId, 'contentTerm', domain))
  }
  let refuted = 0
  for (const id of ids) {
    const existing = await portraitFactsRepository.getById(id)
    if (!existing || existing.state === 'invalid') {
      continue
    }
    const next = applyPortraitContradiction(existing, nowIso)
    await portraitFactsRepository.put(next)
    refuted += 1
  }
  if (refuted > 0) {
    logger.info('Portrait', 'dismiss 矛盾已施加', { ownerId, refuted })
  }
  return { refuted }
}

/** 批准推断项。 */
export async function approvePortraitFact(factId: string): Promise<PortraitFactRecord | null> {
  const existing = await portraitFactsRepository.getById(factId)
  if (!existing || existing.state === 'invalid') {
    return null
  }
  const ownerId = await getCurrentOwnerId()
  if (existing.ownerId !== ownerId) {
    return null
  }
  const next = applyPortraitApprove(existing, new Date().toISOString())
  await portraitFactsRepository.put(next)
  logger.info('Portrait', '用户批准画像事实', {
    factId: next.id,
    value: normalizePortraitValue(next.value)
  })
  return next
}

/** 忽略推断项（行保留）。 */
export async function declinePortraitFact(factId: string): Promise<PortraitFactRecord | null> {
  const existing = await portraitFactsRepository.getById(factId)
  if (!existing) {
    return null
  }
  const ownerId = await getCurrentOwnerId()
  if (existing.ownerId !== ownerId) {
    return null
  }
  const next = applyPortraitDecline(existing, new Date().toISOString())
  await portraitFactsRepository.put(next)
  logger.info('Portrait', '用户忽略画像事实', { factId: next.id })
  return next
}
