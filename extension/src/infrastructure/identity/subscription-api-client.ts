/**
 * Worker 订阅状态 HTTP 客户端（仅 Background）。
 */

import type { SubscriptionSnapshot } from '@/core/identity/subscription-snapshot'
import { flowFail, flowOk, flowStart } from '@/infrastructure/logging/flow-log'

function getApiBaseUrl(): string {
  const fromEnv = import.meta.env.VITE_API_BASE_URL?.trim()
  return fromEnv ? fromEnv.replace(/\/$/, '') : 'http://localhost:8787'
}

type ApiSubscriptionData = {
  isPro: boolean
  tier: SubscriptionSnapshot['tier']
  status: SubscriptionSnapshot['status']
  currentPeriodEnd: string | null
  cancelAtPeriodEnd: boolean
}

/**
 * GET /api/account/subscription — 需 Supabase Bearer。
 */
export async function fetchRemoteSubscriptionStatus(
  accessToken: string
): Promise<Omit<SubscriptionSnapshot, 'fetchedAt'>> {
  const startedAt = flowStart('Subscription', '拉取云端订阅')
  try {
    const url = `${getApiBaseUrl()}/api/account/subscription`
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json'
      }
    })
    const body: unknown = await response.json().catch(() => null)
    if (!response.ok) {
      const errorCode =
        typeof body === 'object' &&
        body !== null &&
        'error' in body &&
        typeof (body as { error: unknown }).error === 'string'
          ? (body as { error: string }).error
          : `http_${response.status}`
      throw new Error(errorCode)
    }
    if (
      typeof body !== 'object' ||
      body === null ||
      !('success' in body) ||
      (body as { success: unknown }).success !== true ||
      !('data' in body)
    ) {
      throw new Error('invalid_subscription_response')
    }
    const data = (body as { data: ApiSubscriptionData }).data
    flowOk('Subscription', '拉取云端订阅', startedAt, {
      isPro: data.isPro,
      tier: data.tier
    })
    return {
      isPro: Boolean(data.isPro),
      tier: data.tier,
      status: data.status,
      currentPeriodEnd: data.currentPeriodEnd,
      cancelAtPeriodEnd: Boolean(data.cancelAtPeriodEnd)
    }
  } catch (error) {
    flowFail('Subscription', '拉取云端订阅', startedAt, error)
    throw error
  }
}
