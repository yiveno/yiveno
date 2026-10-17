/**
 * §7.1 当前页上下文模式（Contextual Clue）。
 * 与 clue 字符串分离；默认 none（当前域名不参与检索）。
 */

/** 当前页上下文如何参与 Recall。 */
export const PAGE_CONTEXT_MODES = [
  'none', // 不参与：全库按 clue；无同域加成/硬筛
  'boost', // 结合当前页：全库候选 + 同域软抬分
  'restrict' // 仅此站：硬筛 clues.domain === 当前域名
] as const

export type PageContextMode = (typeof PAGE_CONTEXT_MODES)[number]

/**
 * UI 双可选 → 管线三态。
 * 双开时 restrict 覆盖 boost（硬限后同域加成无增量）。
 */
export function resolvePageContextMode(input: {
  combineWithPage: boolean
  onlyThisSite: boolean
}): PageContextMode {
  if (input.onlyThisSite) {
    return 'restrict'
  }
  if (input.combineWithPage) {
    return 'boost'
  }
  return 'none'
}

/**
 * 页上下文只用当前活动标签。
 * 已有地址但不是 http(s)（chrome://、扩展页、新标签等）→ 不借用其它标签的域名。
 * 地址还没到、pendingUrl 已是普通网页 → 用 pending，避免加载空窗闪掉。
 */
export function urlForPageContext(
  tab: { url?: string | undefined; pendingUrl?: string | undefined } | undefined
): string | undefined {
  const url = tab?.url?.trim()
  if (url) {
    return url.startsWith('http://') || url.startsWith('https://') ? url : undefined
  }
  const pending = tab?.pendingUrl?.trim()
  if (pending && (pending.startsWith('http://') || pending.startsWith('https://'))) {
    return pending
  }
  return undefined
}

/** 规范化 host：小写、去首尾空白、去 www. 前缀。 */
export function normalizePageContextDomain(domain: string | undefined): string | undefined {
  const trimmed = domain?.trim().toLowerCase()
  if (!trimmed) {
    return undefined
  }
  return trimmed.replace(/^www\./, '')
}

/** 条目 domain 与当前页 domain 是否视为同站（v1：规范化后精确相等）。 */
export function isSamePageContextDomain(
  itemDomain: string | undefined,
  pageDomain: string | undefined
): boolean {
  const left = normalizePageContextDomain(itemDomain)
  const right = normalizePageContextDomain(pageDomain)
  if (!left || !right) {
    return false
  }
  return left === right
}
