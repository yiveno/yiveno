/** 从官网环境读取站点根 URL。 */
export function getWebsiteBaseUrl(): string {
  const fromEnv = import.meta.env.VITE_WEBSITE_URL?.trim()
  return fromEnv ? fromEnv.replace(/\/$/, '') : 'https://yiveno.com'
}

/**
 * 判断标签是否已是官网账户页（忽略 query，避免重复开 tab）。
 */
function isWebsiteAccountTabUrl(tabUrl: string, websiteBase: string): boolean {
  try {
    const parsed = new URL(tabUrl)
    const base = new URL(websiteBase)
    if (parsed.origin !== base.origin) {
      return false
    }
    const path = parsed.pathname.replace(/\/$/, '') || '/'
    return path === '/account'
  } catch {
    return false
  }
}

/**
 * 打开官网账户页：已有 `/account` 标签则激活并聚焦窗口，否则新建。
 * 附带 extension_id，供退出 / 补推 session 回传扩展。
 */
export async function openWebsiteAccountPage(): Promise<void> {
  const url = new URL('/account', `${getWebsiteBaseUrl()}/`)
  url.searchParams.set('extension_id', chrome.runtime.id)
  const target = url.toString()
  const base = getWebsiteBaseUrl()

  try {
    const tabs = await chrome.tabs.query({})
    const existing = tabs.find(tab => {
      const tabUrl = tab.url ?? tab.pendingUrl ?? ''
      return tabUrl.length > 0 && isWebsiteAccountTabUrl(tabUrl, base)
    })
    if (existing?.id != null) {
      const existingUrl = existing.url ?? existing.pendingUrl ?? ''
      let navigate = true
      try {
        const current = new URL(existingUrl)
        if (current.searchParams.get('extension_id') === chrome.runtime.id) {
          navigate = false
        }
      } catch {
        // 无法解析则带参重开账户页
      }
      await chrome.tabs.update(
        existing.id,
        navigate ? { url: target, active: true } : { active: true }
      )
      if (typeof existing.windowId === 'number') {
        await chrome.windows.update(existing.windowId, { focused: true })
      }
      return
    }
  } catch {
    // tabs 查询失败时回退新建
  }

  await chrome.tabs.create({ url: target })
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
