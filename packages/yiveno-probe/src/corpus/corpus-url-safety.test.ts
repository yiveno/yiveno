/**
 * 探针精选 URL 安全：禁止「像真文的 CMS 数字 id」导致站点 302 到无关真文。
 * 案例：Atlantic `/…/677000/`（假 attention 文）→ 真文 My Father, the Giant。
 */

import { describe, expect, it } from 'vitest'

import {
  RECALL_PROBE_PERSONA_ORDER,
  buildDiversityBookmarkSeeds,
  buildDiversityExcerptSeeds,
  buildNoiseBookmarkSeeds,
  buildNoiseExcerptSeeds,
  resolveProbeCorpora
} from '../index'

/** 路径末尾为 ≥5 位数字段 → 常见出版商文章 id（易撞真文并重定向）。 */
const TRAILING_CMS_ID = /\/\d{5,}\/?$/i

/** 这些主机上的探针 URL 必须带保留段，或不得用 trailing CMS id。 */
const PUBLISHER_HOSTS_NEEDING_PROBE_SAFE_PATH = new Set([
  'www.theatlantic.com',
  'theatlantic.com',
  'www.newyorker.com',
  'newyorker.com',
  'www.nytimes.com',
  'nytimes.com',
  'www.wired.com',
  'wired.com',
  'www.nature.com',
  'nature.com'
])

function pathHasProbeReserve(pathname: string): boolean {
  return (
    pathname.includes('/yiveno-probe/') ||
    pathname.includes('/yiveno-div') ||
    pathname.includes('/probe')
  )
}

function assertProbeSafeUrl(url: string, label: string): void {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    throw new Error(`${label}: 非法 URL ${url}`)
  }
  if (!PUBLISHER_HOSTS_NEEDING_PROBE_SAFE_PATH.has(parsed.hostname)) return
  if (pathHasProbeReserve(parsed.pathname)) return
  expect(
    TRAILING_CMS_ID.test(parsed.pathname),
    `${label}: ${url} 落在出版商主机且路径像真文 CMS id；请改用 /yiveno-probe/… 或 /yiveno-div（见 README）`
  ).toBe(false)
}

describe('probe corpus URL safety', () => {
  it('精选语料：出版商主机禁止 trailing 数字文章 id（除非 yiveno-probe 保留路径）', () => {
    for (const persona of RECALL_PROBE_PERSONA_ORDER) {
      const [corpus] = resolveProbeCorpora([persona])
      expect(corpus).toBeDefined()
      for (const bm of corpus!.bookmarks) {
        assertProbeSafeUrl(bm.url, `${persona} bookmark ${bm.key}`)
      }
      for (const ex of corpus!.excerpts) {
        assertProbeSafeUrl(ex.sourceUrl, `${persona} excerpt ${ex.key}`)
      }
    }
  })

  it('半仿真 / 无关干扰生成器：同样遵守出版商路径纪律', () => {
    for (const persona of RECALL_PROBE_PERSONA_ORDER) {
      for (const bm of buildDiversityBookmarkSeeds(persona, 20, { seed: 1 })) {
        assertProbeSafeUrl(bm.url, `diversity ${bm.key}`)
      }
      for (const ex of buildDiversityExcerptSeeds(persona, 10, { seed: 1 })) {
        assertProbeSafeUrl(ex.sourceUrl, `diversity excerpt ${ex.key}`)
      }
    }
    for (const bm of buildNoiseBookmarkSeeds(20, { seed: 1 })) {
      assertProbeSafeUrl(bm.url, `noise ${bm.key}`)
    }
    for (const ex of buildNoiseExcerptSeeds(10, { seed: 1 })) {
      assertProbeSafeUrl(ex.sourceUrl, `noise excerpt ${ex.key}`)
    }
  })

  it('Atlantic 注意力探针已改为 yiveno-probe 路径（回归 NS03）', () => {
    const [corpus] = resolveProbeCorpora(['researcher'])
    const atlantic = corpus!.bookmarks.find(b => b.key === 'atlantic-attention')
    expect(atlantic?.url).toBe('https://www.theatlantic.com/yiveno-probe/attention-economy-myth/')
    expect(atlantic?.url).not.toMatch(/677000/)
  })
})
