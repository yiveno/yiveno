import { describe, expect, test } from 'vitest'

import {
  GEO_DOMAIN_COOKIE,
  buildGeoDomainCookie,
  resolveGeoDomainRedirect
} from './resolve-geo-domain-redirect'

const base = {
  pathname: '/pricing',
  search: '',
  cookieHeader: null as string | null,
  userAgent: 'Mozilla/5.0',
  cnMarketLive: true
}

describe('resolveGeoDomainRedirect', () => {
  test('预览域 / 未知 host 不跳', () => {
    expect(
      resolveGeoDomainRedirect({
        ...base,
        hostname: 'yiveno-website.pages.dev',
        country: 'CN'
      }).type
    ).toBe('passthrough')
    expect(
      resolveGeoDomainRedirect({
        ...base,
        hostname: 'api.yiveno.com',
        country: 'US'
      }).type
    ).toBe('passthrough')
  })

  test('爬虫 UA 不跳', () => {
    const r = resolveGeoDomainRedirect({
      ...base,
      hostname: 'yiveno.com',
      country: 'CN',
      userAgent: 'Googlebot/2.1'
    })
    expect(r.type).toBe('passthrough')
  })

  test('CN + live → .cn；US → 留在 .com', () => {
    const cn = resolveGeoDomainRedirect({
      ...base,
      hostname: 'www.yiveno.com',
      country: 'CN'
    })
    expect(cn).toEqual({
      type: 'redirect',
      location: 'https://yiveno.cn/pricing'
    })

    expect(
      resolveGeoDomainRedirect({
        ...base,
        hostname: 'yiveno.com',
        country: 'US'
      }).type
    ).toBe('passthrough')
  })

  test('非 CN 访问 .cn → .com', () => {
    const r = resolveGeoDomainRedirect({
      ...base,
      hostname: 'yiveno.cn',
      country: 'US',
      pathname: '/account',
      search: '?x=1'
    })
    expect(r).toEqual({
      type: 'redirect',
      location: 'https://yiveno.com/account?x=1'
    })
  })

  test('cnMarketLive=false 时不自动跳到 .cn', () => {
    expect(
      resolveGeoDomainRedirect({
        ...base,
        hostname: 'yiveno.com',
        country: 'CN',
        cnMarketLive: false
      }).type
    ).toBe('passthrough')
  })

  test('无 country fail-open', () => {
    expect(
      resolveGeoDomainRedirect({
        ...base,
        hostname: 'yiveno.com',
        country: null
      }).type
    ).toBe('passthrough')
  })

  test('cookie stay 压过地区', () => {
    expect(
      resolveGeoDomainRedirect({
        ...base,
        hostname: 'yiveno.com',
        country: 'CN',
        cookieHeader: `${GEO_DOMAIN_COOKIE}=stay`
      }).type
    ).toBe('passthrough')
  })

  test('?geo_domain=cn 写 Cookie 并跳；清掉查询参数', () => {
    const r = resolveGeoDomainRedirect({
      ...base,
      hostname: 'yiveno.com',
      country: 'US',
      search: '?geo_domain=cn&ref=nav'
    })
    expect(r.type).toBe('redirect')
    if (r.type !== 'redirect') return
    expect(r.location).toBe('https://yiveno.cn/pricing?ref=nav')
    expect(r.setCookie).toBe(buildGeoDomainCookie('cn'))
  })

  test('?geo_domain=cn 且未 live：只写 Cookie，留在当前域并剥参', () => {
    const r = resolveGeoDomainRedirect({
      ...base,
      hostname: 'yiveno.com',
      country: 'CN',
      search: '?geo_domain=cn',
      cnMarketLive: false
    })
    expect(r.type).toBe('redirect')
    if (r.type !== 'redirect') return
    expect(r.location).toBe('https://yiveno.com/pricing')
    expect(r.setCookie).toBe(buildGeoDomainCookie('cn'))
  })

  test('港台澳按非大陆 → .com', () => {
    for (const country of ['HK', 'TW', 'MO']) {
      expect(
        resolveGeoDomainRedirect({
          ...base,
          hostname: 'yiveno.cn',
          country
        })
      ).toEqual({
        type: 'redirect',
        location: 'https://yiveno.com/pricing'
      })
    }
  })
})
