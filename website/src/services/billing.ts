/**
 * 官网计费 API（Worker）。
 */

const API_BASE = (import.meta.env.PUBLIC_API_BASE_URL || 'https://api.yiveno.com').replace(
  /\/$/,
  ''
)

/** 可结账套餐。 */
export type BillingPlanId =
  | 'pro_monthly' // 标准月付
  | 'pro_annual' // 标准年付
  | 'founding_monthly' // Founding 月付
  | 'founding_annual' // Founding 年付

/**
 * 创建 hosted checkout 的结果。
 * - ok：已拿到 Dodo checkout URL
 * - already_subscribed：当前账号已是有效 Pro
 * - failed：其它失败
 */
export type StartCheckoutResult =
  | { status: 'ok'; checkoutUrl: string } // 已拿到 hosted URL
  | { status: 'already_subscribed' } // 当前账号已是有效 Pro
  | { status: 'failed' } // 其它失败

export async function createCheckoutSession(
  accessToken: string,
  plan: BillingPlanId
): Promise<StartCheckoutResult> {
  const res = await fetch(`${API_BASE}/api/billing/checkout-session`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json'
    },
    body: JSON.stringify({ plan })
  })
  if (res.status === 409) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null
    if (body?.error === 'already_subscribed') {
      return { status: 'already_subscribed' }
    }
    return { status: 'failed' }
  }
  if (!res.ok) return { status: 'failed' }
  const body = (await res.json()) as { success?: boolean; data?: { checkoutUrl?: string } }
  const checkoutUrl = body.data?.checkoutUrl
  if (!checkoutUrl) return { status: 'failed' }
  return { status: 'ok', checkoutUrl }
}

export async function createPortalSession(accessToken: string): Promise<string | null> {
  const res = await fetch(`${API_BASE}/api/billing/portal-session`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json'
    }
  })
  if (!res.ok) return null
  const body = (await res.json()) as { success?: boolean; data?: { portalUrl?: string } }
  return body.data?.portalUrl ?? null
}
