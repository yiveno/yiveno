/**
 * Gumroad 购买 / 管理 URL（扩展侧；来自 Vite env）。
 */

export function getGumroadProductUrl(): string | null {
  const raw = import.meta.env.VITE_GUMROAD_PRODUCT_URL?.trim()
  return raw ? raw : null
}

export function getGumroadManageUrl(): string | null {
  const raw = import.meta.env.VITE_GUMROAD_MANAGE_URL?.trim()
  // 未配置时落到买家 Library（Gumroad 当前公开入口；/subscriptions 已 404）
  return raw ? raw : 'https://gumroad.com/library'
}

/**
 * 构建带 custom_fields 的升级链接（Gumroad webhook 用 user_id + tier）。
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
