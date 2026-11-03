/**
 * 官网软性按地区选域名（与页面显示语言无关）。
 *
 * - 中国大陆（CF `country=CN`）→ `yiveno.cn`
 * - 其它有国家码的访客 → `yiveno.com`
 * - 无国家码 / 预览域 / 爬虫 → 不跳
 * - Cookie / `?geo_domain=` 可钉死偏好或停留（软性，非硬锁）
 */

export type GeoDomainMarket = 'com' | 'cn'

/** Cookie / 查询参数：钉死市场，或 stay=不自动跳 */
export type GeoDomainPreference = GeoDomainMarket | 'stay'

export const GEO_DOMAIN_COOKIE = 'yiveno_geo_domain'
export const GEO_DOMAIN_QUERY = 'geo_domain'
export const GEO_DOMAIN_COOKIE_MAX_AGE_SEC = 60 * 60 * 24 * 365

const GLOBAL_HOSTS = new Set(['yiveno.com', 'www.yiveno.com'])
const CN_HOSTS = new Set(['yiveno.cn', 'www.yiveno.cn'])

/** 大陆市场：仅 CN；港台澳仍走 .com（品牌主市场海外） */
const CN_MARKET_COUNTRIES = new Set(['CN'])

const BOT_UA =
  /bot|crawl|spider|slurp|facebookexternalhit|preview|embedly|quora|linkedinbot|pinterest|redditbot|applebot|bingpreview|yandex|baiduspider|sogou|bytespider/i

export type ResolveGeoDomainRedirectInput = {
  hostname: string
  pathname: string
  search: string
  /** Cloudflare `request.cf.country`；缺省则 fail-open 不跳 */
  country: string | null | undefined
  cookieHeader: string | null | undefined
  userAgent: string | null | undefined
  /**
   * `.cn` 已挂到同一 Pages 项目且可对外服务时才为 true。
   * false 时绝不自动跳到 .cn（避免导到未接入域名）。
   */
  cnMarketLive: boolean
}

export type ResolveGeoDomainRedirectResult =
  | { type: 'passthrough'; setCookie?: string }
  | { type: 'redirect'; location: string; setCookie?: string }

function normalizeHost(hostname: string): string {
  return hostname.trim().toLowerCase().replace(/\.$/, '')
}

function isPreviewOrLocalHost(host: string): boolean {
  if (host === 'localhost' || host.endsWith('.localhost')) return true
  if (host.endsWith('.pages.dev')) return true
  if (host === '127.0.0.1' || host === '::1') return true
  return false
}

function marketForHost(host: string): GeoDomainMarket | null {
  if (GLOBAL_HOSTS.has(host)) return 'com'
  if (CN_HOSTS.has(host)) return 'cn'
  return null
}

/** 当前主机是否大陆市场域名（`yiveno.cn` / `www`）。 */
export function isCnMarketHost(hostname: string): boolean {
  return marketForHost(normalizeHost(hostname)) === 'cn'
}

function canonicalHostForMarket(market: GeoDomainMarket): string {
  return market === 'cn' ? 'yiveno.cn' : 'yiveno.com'
}

function parsePreference(raw: string | null | undefined): GeoDomainPreference | null {
  if (!raw) return null
  const v = raw.trim().toLowerCase()
  if (v === 'com' || v === 'cn' || v === 'stay') return v
  return null
}

function readCookie(cookieHeader: string | null | undefined, name: string): string | null {
  if (!cookieHeader) return null
  const parts = cookieHeader.split(';')
  for (const part of parts) {
    const idx = part.indexOf('=')
    if (idx <= 0) continue
    const key = part.slice(0, idx).trim()
    if (key !== name) continue
    return decodeURIComponent(part.slice(idx + 1).trim())
  }
  return null
}

export function buildGeoDomainCookie(value: GeoDomainPreference): string {
  // Domain 省略 → 仅当前 host；跨 .com/.cn 各自一份偏好即可（软性）
  return `${GEO_DOMAIN_COOKIE}=${encodeURIComponent(value)}; Path=/; Max-Age=${GEO_DOMAIN_COOKIE_MAX_AGE_SEC}; SameSite=Lax; Secure`
}

function stripGeoDomainQuery(search: string): string {
  if (!search || search === '?') return ''
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
  params.delete(GEO_DOMAIN_QUERY)
  const s = params.toString()
  return s ? `?${s}` : ''
}

function buildLocation(market: GeoDomainMarket, pathname: string, search: string): string {
  const path = pathname.startsWith('/') ? pathname : `/${pathname}`
  return `https://${canonicalHostForMarket(market)}${path}${search}`
}

function inferredMarketFromCountry(country: string | null | undefined): GeoDomainMarket | null {
  if (!country) return null
  const code = country.trim().toUpperCase()
  if (!code) return null
  return CN_MARKET_COUNTRIES.has(code) ? 'cn' : 'com'
}

/**
 * 纯函数：决定是否 302，以及是否写偏好 Cookie。
 * 优先级：显式 `?geo_domain=` → Cookie 偏好 → CF country 建议 → 不跳。
 * 显示语言不在此处理（见 `Yiveno-国际化-CN-NA.md` §2.1）。
 */
export function resolveGeoDomainRedirect(
  input: ResolveGeoDomainRedirectInput
): ResolveGeoDomainRedirectResult {
  const host = normalizeHost(input.hostname)
  if (isPreviewOrLocalHost(host)) {
    return { type: 'passthrough' }
  }

  const currentMarket = marketForHost(host)
  if (!currentMarket) {
    return { type: 'passthrough' }
  }

  if (input.userAgent && BOT_UA.test(input.userAgent)) {
    return { type: 'passthrough' }
  }

  const urlSearch =
    input.search.startsWith('?') || input.search === '' ? input.search : `?${input.search}`
  const queryParams = new URLSearchParams(
    urlSearch.startsWith('?') ? urlSearch.slice(1) : urlSearch
  )
  const queryPref = parsePreference(queryParams.get(GEO_DOMAIN_QUERY))
  const cookiePref = parsePreference(readCookie(input.cookieHeader, GEO_DOMAIN_COOKIE))

  const cleanedSearch = stripGeoDomainQuery(urlSearch)

  // 显式查询参数：写 Cookie，并尽量落到对应域名（.cn 未 live 时 cn 只落 Cookie、不跳）
  if (queryPref) {
    const setCookie = buildGeoDomainCookie(queryPref)
    if (queryPref === 'stay') {
      if (cleanedSearch !== urlSearch) {
        return {
          type: 'redirect',
          location: `https://${canonicalHostForMarket(currentMarket)}${input.pathname}${cleanedSearch}`,
          setCookie
        }
      }
      return { type: 'passthrough', setCookie }
    }

    if (queryPref === 'cn' && !input.cnMarketLive) {
      if (cleanedSearch !== urlSearch) {
        return {
          type: 'redirect',
          location: `https://${canonicalHostForMarket(currentMarket)}${input.pathname}${cleanedSearch}`,
          setCookie
        }
      }
      return { type: 'passthrough', setCookie }
    }

    if (queryPref !== currentMarket) {
      return {
        type: 'redirect',
        location: buildLocation(queryPref, input.pathname, cleanedSearch),
        setCookie
      }
    }

    if (cleanedSearch !== urlSearch) {
      return {
        type: 'redirect',
        location: buildLocation(currentMarket, input.pathname, cleanedSearch),
        setCookie
      }
    }
    return { type: 'passthrough', setCookie }
  }

  // Cookie 钉死
  if (cookiePref === 'stay') {
    return { type: 'passthrough' }
  }
  if (cookiePref === 'com' || cookiePref === 'cn') {
    if (cookiePref === 'cn' && !input.cnMarketLive) {
      return { type: 'passthrough' }
    }
    if (cookiePref !== currentMarket) {
      return {
        type: 'redirect',
        location: buildLocation(cookiePref, input.pathname, cleanedSearch)
      }
    }
    return { type: 'passthrough' }
  }

  // 自动：按 CF 国家码
  const inferred = inferredMarketFromCountry(input.country)
  if (!inferred) {
    return { type: 'passthrough' }
  }
  if (inferred === 'cn' && !input.cnMarketLive) {
    return { type: 'passthrough' }
  }
  if (inferred === currentMarket) {
    return { type: 'passthrough' }
  }
  return {
    type: 'redirect',
    location: buildLocation(inferred, input.pathname, cleanedSearch)
  }
}
