/**
 * 画像 B 层：晋升 / dismiss 矛盾 / 批准 / 忽略。
 */

import {
  approvePortraitFact,
  declinePortraitFact,
  promotePortraitOnConfirm,
  refutePortraitOnDismiss
} from '@/application/portrait/promote-portrait-facts'
import {
  parsePortraitFactIdPayload,
  parsePortraitPromotePayload,
  parsePortraitRefutePayload,
  type PortraitMutationResponse
} from '@/core/messaging/recall-messages'
import { logger } from '@/infrastructure/logging/logger'

export async function handlePortraitPromoteOnConfirm(
  payload: unknown
): Promise<PortraitMutationResponse> {
  try {
    const parsed = parsePortraitPromotePayload(payload)
    await promotePortraitOnConfirm({ conditions: parsed.conditions })
    return { ok: true }
  } catch (error) {
    logger.warn('Portrait', '晋升失败', {
      error: error instanceof Error ? error.message : String(error)
    })
    return {
      ok: false,
      errorCode: 'PORTRAIT_FAILED',
      error: error instanceof Error ? error.message : String(error)
    }
  }
}

export async function handlePortraitRefuteOnDismiss(
  payload: unknown
): Promise<PortraitMutationResponse> {
  try {
    const parsed = parsePortraitRefutePayload(payload)
    await refutePortraitOnDismiss({
      ...(parsed.conditions ? { conditions: parsed.conditions } : {}),
      ...(parsed.domainValues ? { domainValues: parsed.domainValues } : {}),
      ...(parsed.factIds ? { factIds: parsed.factIds } : {})
    })
    return { ok: true }
  } catch (error) {
    logger.warn('Portrait', 'dismiss 矛盾失败', {
      error: error instanceof Error ? error.message : String(error)
    })
    return {
      ok: false,
      errorCode: 'PORTRAIT_FAILED',
      error: error instanceof Error ? error.message : String(error)
    }
  }
}

export async function handlePortraitApproveFact(
  payload: unknown
): Promise<PortraitMutationResponse> {
  try {
    const parsed = parsePortraitFactIdPayload(payload)
    const next = await approvePortraitFact(parsed.factId)
    if (!next) {
      return { ok: false, errorCode: 'PORTRAIT_FAILED', error: 'fact_not_found' }
    }
    return { ok: true }
  } catch (error) {
    return {
      ok: false,
      errorCode: 'PORTRAIT_FAILED',
      error: error instanceof Error ? error.message : String(error)
    }
  }
}

export async function handlePortraitDeclineFact(
  payload: unknown
): Promise<PortraitMutationResponse> {
  try {
    const parsed = parsePortraitFactIdPayload(payload)
    const next = await declinePortraitFact(parsed.factId)
    if (!next) {
      return { ok: false, errorCode: 'PORTRAIT_FAILED', error: 'fact_not_found' }
    }
    return { ok: true }
  } catch (error) {
    return {
      ok: false,
      errorCode: 'PORTRAIT_FAILED',
      error: error instanceof Error ? error.message : String(error)
    }
  }
}
