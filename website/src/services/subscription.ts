const API_BASE = import.meta.env.PUBLIC_API_BASE_URL || 'https://api.yiveno.com'

/** 与 Worker `/api/website/subscription` 响应对齐。 */
export interface UserSubscription {
  tier: string
  status: string
  currentPeriodStart?: string
  currentPeriodEnd?: string
  cancelAtPeriodEnd?: boolean
}

/** 订阅拉取结果：区分「确认 Free/Pro」与「拉取失败（unknown）」。 */
export type SubscriptionLoadResult =
  | { status: 'ok'; subscription: UserSubscription; isPro: boolean }
  | { status: 'error'; errorCode: string }

/** 官网快照是否为有效 Pro（含周期结束取消、期内仍 Pro）。 */
export function isActiveProSnapshot(sub: UserSubscription | null | undefined): boolean {
  return sub?.tier === 'pro' && sub.status === 'active'
}

function parseErrorCode(body: unknown, httpStatus: number): string {
  if (
    typeof body === 'object' &&
    body !== null &&
    'error' in body &&
    typeof (body as { error: unknown }).error === 'string'
  ) {
    return (body as { error: string }).error
  }
  return `http_${httpStatus}`
}

/**
 * 查询当前登录用户订阅（须传 Supabase access token）。
 * 失败返回 `{ status: 'error' }`，**不得**当作 Free。
 */
export async function loadUserSubscription(accessToken: string): Promise<SubscriptionLoadResult> {
  try {
    const res = await fetch(`${API_BASE}/api/website/subscription`, {
      headers: {
        authorization: `Bearer ${accessToken}`
      }
    })
    const body: unknown = await res.json().catch(() => null)
    if (!res.ok) {
      return { status: 'error', errorCode: parseErrorCode(body, res.status) }
    }
    if (
      typeof body !== 'object' ||
      body === null ||
      typeof (body as { tier?: unknown }).tier !== 'string' ||
      typeof (body as { status?: unknown }).status !== 'string'
    ) {
      return { status: 'error', errorCode: 'invalid_subscription_response' }
    }
    const subscription = body as UserSubscription
    return {
      status: 'ok',
      subscription,
      isPro: isActiveProSnapshot(subscription)
    }
  } catch {
    return { status: 'error', errorCode: 'network_error' }
  }
}

/**
 * @deprecated 优先用 `loadUserSubscription`；失败时返回 null 会丢失 error 语义。
 */
export async function getUserSubscription(accessToken: string): Promise<UserSubscription | null> {
  const result = await loadUserSubscription(accessToken)
  if (result.status === 'ok') {
    return result.subscription
  }
  return null
}
