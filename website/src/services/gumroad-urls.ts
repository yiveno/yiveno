/**
 * 官网 Gumroad 购买 / 管理 URL。
 */

export function getGumroadProductUrl(): string | null {
  const raw = import.meta.env.PUBLIC_GUMROAD_PRODUCT_URL?.trim()
  return raw ? raw : null
}

export function getGumroadManageUrl(): string {
  const raw = import.meta.env.PUBLIC_GUMROAD_MANAGE_URL?.trim()
  return raw || 'https://app.gumroad.com/subscriptions'
}

/**
 * 构建带 custom_fields 的升级链接（webhook 用 user_id + tier=pro）。
 */
export function buildGumroadUpgradeUrl(accountId: string): string | null {
  const base = getGumroadProductUrl()
  if (!base) {
    return null
  }
  try {
    const url = new URL(base)
    url.searchParams.set('custom_fields[user_id]', accountId)
    url.searchParams.set('custom_fields[tier]', 'pro')
    return url.toString()
  } catch {
    return base
  }
}
