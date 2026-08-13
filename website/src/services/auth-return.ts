/**
 * 登录后回跳：用 sessionStorage 扛过 Google/Microsoft OAuth 离页，
 * 并用 query `next` / `intent` 在登录页展示意图。
 */

const STORAGE_NEXT = 'yiveno.auth.next'
const STORAGE_INTENT = 'yiveno.auth.intent'

/** 仅允许站内相对路径，防 open redirect */
export function sanitizeAuthNext(raw: string | null | undefined): string | null {
  if (!raw) return null
  const trimmed = raw.trim()
  if (!trimmed.startsWith('/')) return null
  if (trimmed.startsWith('//')) return null
  if (trimmed.includes('://')) return null
  if (trimmed.includes('\\')) return null
  return trimmed
}

export function sanitizeAuthIntent(raw: string | null | undefined): string | null {
  if (!raw) return null
  const trimmed = raw.trim()
  // 目前仅 subscribe；白名单扩展时改这里
  if (trimmed === 'subscribe') return trimmed
  return null
}

export function persistAuthReturn(next: string | null, intent: string | null): void {
  const safeNext = sanitizeAuthNext(next)
  const safeIntent = sanitizeAuthIntent(intent)
  if (safeNext) {
    sessionStorage.setItem(STORAGE_NEXT, safeNext)
  } else {
    sessionStorage.removeItem(STORAGE_NEXT)
  }
  if (safeIntent) {
    sessionStorage.setItem(STORAGE_INTENT, safeIntent)
  } else {
    sessionStorage.removeItem(STORAGE_INTENT)
  }
}

/** 从当前 URL query 写入 sessionStorage（登录页 / 回调防御） */
export function captureAuthReturnFromUrl(search?: string): void {
  const params = new URLSearchParams(search ?? window.location.search)
  const next = sanitizeAuthNext(params.get('next'))
  const intent = sanitizeAuthIntent(params.get('intent'))
  if (next || intent) {
    persistAuthReturn(next, intent)
  }
}

export function peekAuthReturn(): { next: string | null; intent: string | null } {
  return {
    next: sanitizeAuthNext(sessionStorage.getItem(STORAGE_NEXT)),
    intent: sanitizeAuthIntent(sessionStorage.getItem(STORAGE_INTENT))
  }
}

/** 读出并清空，供 AuthCallback / 已登录落点使用 */
export function consumeAuthReturn(): { next: string | null; intent: string | null } {
  const value = peekAuthReturn()
  sessionStorage.removeItem(STORAGE_NEXT)
  sessionStorage.removeItem(STORAGE_INTENT)
  return value
}

/**
 * 登录成功后的站内落点（扩展 handoff 优先，由调用方先处理）。
 * 有 next 时拼回 intent，便于目标页自动续意图。
 */
export function buildPostAuthHref(fallback = '/account'): string {
  const { next, intent } = consumeAuthReturn()
  if (!next) return fallback
  if (!intent) return next
  const url = new URL(next, window.location.origin)
  url.searchParams.set('intent', intent)
  return `${url.pathname}${url.search}${url.hash}`
}

/** 未登录点 Subscribe 等：跳登录并记住回跳 */
export function buildLoginHref(next: string, intent?: string | null): string {
  const safeNext = sanitizeAuthNext(next) ?? '/'
  const safeIntent = sanitizeAuthIntent(intent)
  persistAuthReturn(safeNext, safeIntent)
  const params = new URLSearchParams()
  params.set('next', safeNext)
  if (safeIntent) params.set('intent', safeIntent)
  return `/login?${params.toString()}`
}
