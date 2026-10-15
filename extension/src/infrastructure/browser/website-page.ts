/**
 * 官网产品页打开：login / account 走 {@link focusOrOpenTab}（有则聚焦，无则新建）。
 * logout：例外——不抢焦点，优先改址任一官网页。
 */

import { focusOrOpenTab, isSameOriginPathTabUrl } from '@/infrastructure/browser/focus-or-open-tab'
import { readWebsiteAuthUiState } from '@/infrastructure/auth/website-auth-ui-storage'
import { getAuthSession } from '@/infrastructure/identity/auth-session-service'
import { logger } from '@/infrastructure/logging/logger'

/** 从官网环境读取站点根 URL。 */
export function getWebsiteBaseUrl(): string {
  const fromEnv = import.meta.env.VITE_WEBSITE_URL?.trim()
  return fromEnv ? fromEnv.replace(/\/$/, '') : 'https://yiveno.com'
}

/**
 * 打开官网账户页（扩展已登录）。
 * - 桥态显示官网已是同一 userId → 直接 `/account`
 * - 否则 → `/auth/from-extension` 反向接通（扩展铸官网会话）后再进账户页
 */
export async function openWebsiteAccountPage(): Promise<void> {
  const extensionId = chrome.runtime.id
  const base = getWebsiteBaseUrl()
  let useReverseHandoff = true
  try {
    const [session, websiteUi] = await Promise.all([getAuthSession(), readWebsiteAuthUiState()])
    const extUserId = session?.userId?.trim()
    if (extUserId && websiteUi?.signedIn === true && websiteUi.userId?.trim() === extUserId) {
      useReverseHandoff = false
    }
  } catch (error) {
    logger.warn('Auth', '打开账户页前读官网 UI 态失败，走反向接通', error)
  }

  if (!useReverseHandoff) {
    const url = new URL('/account', `${base}/`)
    url.searchParams.set('extension_id', extensionId)
    await focusOrOpenTab({
      targetUrl: url.toString(),
      match: {
        kind: 'predicate',
        match: tabUrl => isSameOriginPathTabUrl(tabUrl, base, '/account')
      },
      canKeepExistingUrl: current => current.searchParams.get('extension_id') === extensionId,
      logScope: 'Auth'
    })
    return
  }

  const url = new URL('/auth/from-extension', `${base}/`)
  url.searchParams.set('extension_id', extensionId)
  url.searchParams.set('next', '/account')
  logger.info('Auth', '打开官网反向接通页', { next: '/account' })
  await focusOrOpenTab({
    targetUrl: url.toString(),
    match: {
      kind: 'predicate',
      match: tabUrl => isSameOriginPathTabUrl(tabUrl, base, '/auth/from-extension')
    },
    canKeepExistingUrl: current => current.searchParams.get('extension_id') === extensionId,
    logScope: 'Auth'
  })
}

/**
 * Connect 回退：打开/聚焦 `/account?connect_extension=1&extension_id=…` 原地 mint。
 * **不**进 `/login`（避免已登录仍出 Google 壳）。
 */
export async function openWebsiteAccountConnectPage(): Promise<void> {
  const url = new URL('/account', `${getWebsiteBaseUrl()}/`)
  url.searchParams.set('connect_extension', '1')
  url.searchParams.set('extension_id', chrome.runtime.id)
  const target = url.toString()
  const base = getWebsiteBaseUrl()

  await focusOrOpenTab({
    targetUrl: target,
    match: {
      kind: 'predicate',
      match: tabUrl => isSameOriginPathTabUrl(tabUrl, base, '/account')
    },
    canKeepExistingUrl: current =>
      current.searchParams.get('connect_extension') === '1' &&
      current.searchParams.get('extension_id') === chrome.runtime.id,
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
 * 打开官网 `/logout` 清本浏览器官网 session。
 * **仅**删除账号等须连带清官网的路径使用；普通扩展 Sign out **不**调用（退出解耦）。
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
