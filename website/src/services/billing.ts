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

export async function createCheckoutSession(
  accessToken: string,
  plan: BillingPlanId
): Promise<string | null> {
  const res = await fetch(`${API_BASE}/api/billing/checkout-session`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json'
    },
    body: JSON.stringify({ plan })
  })
  if (!res.ok) return null
  const body = (await res.json()) as { success?: boolean; data?: { checkoutUrl?: string } }
  return body.data?.checkoutUrl ?? null
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
