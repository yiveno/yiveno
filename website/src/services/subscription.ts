const API_BASE = import.meta.env.PUBLIC_API_BASE_URL || 'https://api.yiveno.com'

export interface UserSubscription {
  plan_id: string
  status: string
  current_period_start: string
  current_period_end: string
  cancel_at_period_end: boolean
}

export async function getUserSubscription(userId: string): Promise<UserSubscription | null> {
  try {
    const res = await fetch(`${API_BASE}/api/website/subscription?userId=${userId}`)
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}
