/**
 * 官网产品页打开：login / account 走 {@link focusOrOpenTab}（有则聚焦，无则新建）。
 * logout：例外——不抢焦点，优先改址任一官网页。
 */

import { focusOrOpenTab, isSameOriginPathTabUrl } from '@/infrastructure/browser/focus-or-open-tab'

/** 从官网环境读取站点根 URL。 */
export function getWebsiteBaseUrl(): string {
  const fromEnv = import.meta.env.VITE_WEBSITE_URL?.trim()
  return fromEnv ? fromEnv.replace(/\/$/, '') : 'https://yiveno.com'
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

  await focusOrOpenTab({
    targetUrl: target,
    match: {
      kind: 'predicate',
      match: tabUrl => isSameOriginPathTabUrl(tabUrl, base, '/account')
    },
    canKeepExistingUrl: current => current.searchParams.get('extension_id') === chrome.runtime.id,
    logScope: 'Auth'
  })
}

/**
 * 打开官网登录页：已有 `/login` 标签则激活并聚焦窗口，否则新建。
 * Connect / 头像登录会带 `connect_extension` + `extension_id`；已有纯 `/login` 时改址补参。
 */
export async function openWebsiteLoginPage(url?: string): Promise<void> {
  const target = url ?? `${getWebsiteBaseUrl()}/login`
  let wantConnect = false
  let wantExtensionId: string | null = null
  try {
    const parsed = new URL(target)
    wantConnect = parsed.searchParams.get('connect_extension') === '1'
    wantExtensionId = parsed.searchParams.get('extension_id')
  } catch {
    // 非法 URL：交给浏览器（仍走模块 forceNew，避免业务层裸 create）
    await focusOrOpenTab({
      targetUrl: target,
      match: { kind: 'predicate', match: () => false },
      forceNew: true,
      logScope: 'Auth'
    })
    return
  }

  const base = getWebsiteBaseUrl()
  await focusOrOpenTab({
    targetUrl: target,
    match: {
      kind: 'predicate',
      match: tabUrl => isSameOriginPathTabUrl(tabUrl, base, '/login')
    },
    canKeepExistingUrl: current => {
      if (wantConnect && current.searchParams.get('connect_extension') !== '1') {
        return false
      }
      if (wantExtensionId && current.searchParams.get('extension_id') !== wantExtensionId) {
        return false
      }
      return true
    },
    logScope: 'Auth'
  })
}

/**
 * 扩展退出后清官网 Supabase session。
 * 优先把已打开的官网标签导航到 /logout（不抢焦点）；否则后台开一页。
 */
export async function openWebsiteLogoutFromExtension(): Promise<void> {
  const logoutUrl = new URL('/logout', `${getWebsiteBaseUrl()}/`)
  logoutUrl.searchParams.set('from_extension', '1')
  const target = logoutUrl.toString()
  const base = getWebsiteBaseUrl()

  await focusOrOpenTab({
    targetUrl: target,
    match: {
      kind: 'predicate',
      match: tabUrl => tabUrl === base || tabUrl.startsWith(`${base}/`)
    },
    canKeepExistingUrl: () => false,
    activateOnReuse: false,
    activeOnCreate: false,
    focusWindow: false,
    logScope: 'Auth'
  })
}
