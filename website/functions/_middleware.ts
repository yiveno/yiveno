/**
 * Cloudflare Pages：软性按地区跳转 .com ↔ .cn（与 UI 语言无关）。
 * 纯逻辑见 `src/geo/resolve-geo-domain-redirect.ts`。
 */

import { resolveGeoDomainRedirect } from '../src/geo/resolve-geo-domain-redirect'

type GeoEnv = {
  /** `"1"` / `"true"`：`.cn` 已挂 Pages 且可服务时再打开自动跳转 */
  GEO_CN_MARKET_LIVE?: string
}

/** Pages middleware 上下文（避免强依赖 workers-types） */
type PagesMiddlewareContext = {
  request: Request
  env: GeoEnv
  next: () => Promise<Response>
}

function isCnMarketLive(env: GeoEnv | undefined): boolean {
  const v = env?.GEO_CN_MARKET_LIVE?.trim().toLowerCase()
  return v === '1' || v === 'true' || v === 'yes'
}

export async function onRequest(context: PagesMiddlewareContext): Promise<Response> {
  const url = new URL(context.request.url)
  const cf = (context.request as Request & { cf?: { country?: string } }).cf

  const decision = resolveGeoDomainRedirect({
    hostname: url.hostname,
    pathname: url.pathname,
    search: url.search,
    country: cf?.country ?? null,
    cookieHeader: context.request.headers.get('cookie'),
    userAgent: context.request.headers.get('user-agent'),
    cnMarketLive: isCnMarketLive(context.env)
  })

  if (decision.type === 'redirect') {
    const headers = new Headers()
    headers.set('Location', decision.location)
    headers.set('Cache-Control', 'no-store')
    if (decision.setCookie) {
      headers.append('Set-Cookie', decision.setCookie)
    }
    return new Response(null, { status: 302, headers })
  }

  const response = await context.next()
  if (!decision.setCookie) {
    return response
  }

  const headers = new Headers(response.headers)
  headers.append('Set-Cookie', decision.setCookie)
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  })
}
