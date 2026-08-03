/** 从官网环境读取站点根 URL。 */
export function getWebsiteBaseUrl(): string {
  const fromEnv = import.meta.env.VITE_WEBSITE_URL?.trim()
  return fromEnv ? fromEnv.replace(/\/$/, '') : 'https://yiveno.com'
}

/** 打开官网账户页（新标签）；附带 extension_id 供退出时回传扩展。 */
export async function openWebsiteAccountPage(): Promise<void> {
  const url = new URL('/account', `${getWebsiteBaseUrl()}/`)
  url.searchParams.set('extension_id', chrome.runtime.id)
  await chrome.tabs.create({ url: url.toString() })
}

/** 打开官网登录页（新标签；不含扩展 connect 参数时由调用方拼）。 */
export async function openWebsiteLoginPage(url?: string): Promise<void> {
  await chrome.tabs.create({ url: url ?? `${getWebsiteBaseUrl()}/login` })
}

/**
 * 扩展退出后清官网 Supabase session。
 * 优先把已打开的官网标签导航到 /logout；否则后台开一页（不抢焦点）。
 */
export async function openWebsiteLogoutFromExtension(): Promise<void> {
  const logoutUrl = new URL('/logout', `${getWebsiteBaseUrl()}/`)
  logoutUrl.searchParams.set('from_extension', '1')
  const target = logoutUrl.toString()
  const base = getWebsiteBaseUrl()

  try {
    const tabs = await chrome.tabs.query({})
    const existing = tabs.find(tab => {
      const url = tab.url ?? ''
      return url === base || url.startsWith(`${base}/`)
    })
    if (existing?.id != null) {
      await chrome.tabs.update(existing.id, { url: target })
      return
    }
  } catch {
    // tabs 查询失败时仍尝试新建
  }

  await chrome.tabs.create({ url: target, active: false })
}
