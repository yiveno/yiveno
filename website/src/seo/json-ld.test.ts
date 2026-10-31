import { describe, expect, test } from 'bun:test'
import {
  FAQ_ENTRIES,
  PRODUCT_DESCRIPTION,
  buildFaqPageJsonLd,
  buildHomeJsonLdGraph
} from './json-ld'

describe('buildHomeJsonLdGraph', () => {
  test('含 Organization / WebSite / SoftwareApplication，币种 USD，无 EUR', () => {
    const graph = buildHomeJsonLdGraph()
    const nodes = graph['@graph'] as Record<string, unknown>[]
    expect(nodes.map(n => n['@type'])).toEqual(['Organization', 'WebSite', 'SoftwareApplication'])
    const soft = nodes[2]!
    expect(soft.operatingSystem).toContain('Edge')
    expect(soft.description).toBe(PRODUCT_DESCRIPTION)
    const offers = soft.offers as Record<string, unknown>[]
    expect(offers).toHaveLength(2)
    expect(offers.every(o => o.priceCurrency === 'USD')).toBe(true)
    expect(JSON.stringify(graph)).not.toContain('EUR')
    expect(JSON.stringify(graph)).not.toContain('InStock')
  })

  test('Organization sameAs 仅真实 GitHub org', () => {
    const org = (buildHomeJsonLdGraph()['@graph'] as Record<string, unknown>[])[0]!
    expect(org.sameAs).toEqual(['https://github.com/yiveno'])
  })
})

describe('buildFaqPageJsonLd', () => {
  test('与 FAQ_ENTRIES 条数一致且含 Question/Answer', () => {
    const ld = buildFaqPageJsonLd(FAQ_ENTRIES)
    expect(ld['@type']).toBe('FAQPage')
    const main = ld.mainEntity as unknown[]
    expect(main).toHaveLength(FAQ_ENTRIES.length)
    expect(FAQ_ENTRIES[0]?.question).toContain('What is Yiveno')
  })
})
