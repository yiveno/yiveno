/**
 * 产品页 Tab 打开契约：默认「有则聚焦（必要时改址），无则新建」。
 *
 * - 扩展页 / 官网 login·account 等用户可感页 → 走本模块
 * - 例外（勿强行复用抢焦点）：官网 auth probe、logout 后台清 session、omnibox 预取等
 *   → 可显式 `forceNew` / `activeOnCreate: false`，或继续专用路径
 */

import type { LogScope } from '@/infrastructure/logging/log-scopes'
import { logger } from '@/infrastructure/logging/logger'

/** 如何匹配「已有可复用标签」。 */
export type FocusOrOpenTabMatch =
  | {
      /** chrome.tabs.query `url` 模式（推荐；避免全量扫 tab） */
      kind: 'urlPatterns'
      patterns: string | string[]
    }
  | {
      /** 全量 query 后谓词过滤（官网 path 等 query 模式不够用时） */
      kind: 'predicate'
      match: (tabUrl: string) => boolean
    }

export type FocusOrOpenTabInput = {
  /** 最终应对齐的 URL（新建或改址目标） */
  targetUrl: string
  match: FocusOrOpenTabMatch
  /**
   * 已有 tab 的 URL 是否可原样保留（仅激活）。
   * 未提供或解析失败 → 改址到 targetUrl。
   */
  canKeepExistingUrl?: (current: URL) => boolean
  /** 记住 tabId（扩展页常用）；失效时会清掉再扫 URL */
  sessionKey?: string
  /** 无命中时是否新建；默认 true */
  createIfMissing?: boolean
  /** 新建时是否前台激活；默认 true */
  activeOnCreate?: boolean
  /**
   * 复用已有 tab 时是否 `active: true`；默认 true。
   * logout 等后台清 session 应 false（只改址不抢焦点）。
   */
  activateOnReuse?: boolean
  /** 复用/新建后是否聚焦窗口；默认 true（logout 等可 false） */
  focusWindow?: boolean
  /** 跳过匹配，强制新建 */
  forceNew?: boolean
  /** 日志 scope；默认 Nav */
  logScope?: LogScope
}

export type FocusOrOpenTabResult =
  | { status: 'focused'; tabId: number; navigated: boolean }
  | { status: 'created'; tabId: number | null }
  | { status: 'not_found' }
  | { status: 'failed' }

async function readStoredTabId(key: string): Promise<number | null> {
  const result = await chrome.storage.session.get(key)
  const value = result[key]
  return typeof value === 'number' && Number.isInteger(value) ? value : null
}

async function writeStoredTabId(key: string, tabId: number): Promise<void> {
  await chrome.storage.session.set({ [key]: tabId })
}

async function clearStoredTabId(key: string): Promise<void> {
  await chrome.storage.session.remove(key)
}

/**
 * 若 tab 仍在则激活；可选聚焦窗口。
 * @returns false 表示 tab 已失效
 */
export async function focusExistingTabById(
  tabId: number,
  options: { focusWindow?: boolean } = {}
): Promise<boolean> {
  const focusWindow = options.focusWindow !== false
  try {
    const tab = await chrome.tabs.get(tabId)
    if (tab.id === undefined) {
      return false
    }
    await chrome.tabs.update(tab.id, { active: true })
    if (focusWindow && typeof tab.windowId === 'number') {
      await chrome.windows.update(tab.windowId, { focused: true })
    }
    return true
  } catch {
    return false
  }
}

async function findMatchingTab(match: FocusOrOpenTabMatch): Promise<chrome.tabs.Tab | null> {
  try {
    if (match.kind === 'urlPatterns') {
      const tabs = await chrome.tabs.query({ url: match.patterns })
      return tabs.find(tab => typeof tab.id === 'number') ?? null
    }
    const tabs = await chrome.tabs.query({})
    return (
      tabs.find(tab => {
        const tabUrl = tab.url ?? tab.pendingUrl ?? ''
        return tabUrl.length > 0 && match.match(tabUrl)
      }) ?? null
    )
  } catch {
    return null
  }
}

async function activateMatchedTab(input: {
  tab: chrome.tabs.Tab
  targetUrl: string
  canKeepExistingUrl?: (current: URL) => boolean
  activateOnReuse: boolean
  focusWindow: boolean
  sessionKey?: string
}): Promise<FocusOrOpenTabResult> {
  const tabId = input.tab.id
  if (typeof tabId !== 'number') {
    return { status: 'failed' }
  }

  const existingUrl = input.tab.url ?? input.tab.pendingUrl ?? ''
  // 无 canKeep 策略：只激活（扩展页）；有策略且不可保留：改址到 target
  let navigated = false
  if (input.canKeepExistingUrl) {
    try {
      const current = new URL(existingUrl)
      navigated = !input.canKeepExistingUrl(current)
    } catch {
      navigated = true
    }
  }

  if (navigated) {
    await chrome.tabs.update(tabId, {
      url: input.targetUrl,
      ...(input.activateOnReuse ? { active: true } : {})
    })
  } else if (input.activateOnReuse) {
    await chrome.tabs.update(tabId, { active: true })
  }

  if (input.activateOnReuse && input.focusWindow && typeof input.tab.windowId === 'number') {
    await chrome.windows.update(input.tab.windowId, { focused: true })
  }
  if (input.sessionKey) {
    await writeStoredTabId(input.sessionKey, tabId)
  }
  return { status: 'focused', tabId, navigated }
}

/**
 * 打开产品页 Tab：有匹配则聚焦（必要时改址），否则按策略新建。
 */
export async function focusOrOpenTab(input: FocusOrOpenTabInput): Promise<FocusOrOpenTabResult> {
  const scope: LogScope = input.logScope ?? 'Nav'
  const createIfMissing = input.createIfMissing !== false
  const activeOnCreate = input.activeOnCreate !== false
  const activateOnReuse = input.activateOnReuse !== false
  const focusWindow = input.focusWindow !== false

  try {
    if (!input.forceNew) {
      if (input.sessionKey) {
        const storedId = await readStoredTabId(input.sessionKey)
        if (storedId !== null) {
          const focused = activateOnReuse
            ? await focusExistingTabById(storedId, { focusWindow })
            : await chrome.tabs
                .get(storedId)
                .then(() => true)
                .catch(() => false)
          if (focused) {
            // session 命中：若 URL 策略要求改址，再读一次 tab 对齐
            if (input.canKeepExistingUrl) {
              try {
                const tab = await chrome.tabs.get(storedId)
                const existingUrl = tab.url ?? tab.pendingUrl ?? ''
                let keep = false
                try {
                  keep = input.canKeepExistingUrl(new URL(existingUrl))
                } catch {
                  keep = false
                }
                if (!keep) {
                  await chrome.tabs.update(storedId, {
                    url: input.targetUrl,
                    ...(activateOnReuse ? { active: true } : {})
                  })
                  return { status: 'focused', tabId: storedId, navigated: true }
                }
              } catch {
                // 读失败仍算已聚焦
              }
            }
            return { status: 'focused', tabId: storedId, navigated: false }
          }
          await clearStoredTabId(input.sessionKey)
        }
      }

      const matched = await findMatchingTab(input.match)
      if (matched) {
        return activateMatchedTab({
          tab: matched,
          targetUrl: input.targetUrl,
          ...(input.canKeepExistingUrl ? { canKeepExistingUrl: input.canKeepExistingUrl } : {}),
          activateOnReuse,
          focusWindow,
          ...(input.sessionKey ? { sessionKey: input.sessionKey } : {})
        })
      }
    }

    if (!createIfMissing) {
      return { status: 'not_found' }
    }

    const created = await chrome.tabs.create({
      url: input.targetUrl,
      active: activeOnCreate
    })
    if (typeof created.id === 'number') {
      if (input.sessionKey) {
        await writeStoredTabId(input.sessionKey, created.id)
      }
      if (focusWindow && activeOnCreate && typeof created.windowId === 'number') {
        await chrome.windows.update(created.windowId, { focused: true })
      }
      return { status: 'created', tabId: created.id }
    }

    logger.warn(scope, 'tabs.create 未返回 tabId', { preview: input.targetUrl.slice(0, 80) })
    return { status: 'created', tabId: null }
  } catch (error) {
    logger.error(scope, 'focusOrOpenTab 失败', { error, preview: input.targetUrl.slice(0, 80) })
    return { status: 'failed' }
  }
}

/** 规范化 path：去尾 `/`，空则 `/`。 */
export function normalizeUrlPathname(pathname: string): string {
  const trimmed = pathname.replace(/\/$/, '') || '/'
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`
}

/**
 * 判断 tabUrl 是否同 origin 且 pathname 匹配（忽略 query/hash）。
 */
export function isSameOriginPathTabUrl(
  tabUrl: string,
  originBase: string,
  pathName: string
): boolean {
  try {
    const parsed = new URL(tabUrl)
    const base = new URL(originBase)
    if (parsed.origin !== base.origin) {
      return false
    }
    return normalizeUrlPathname(parsed.pathname) === normalizeUrlPathname(pathName)
  } catch {
    return false
  }
}
