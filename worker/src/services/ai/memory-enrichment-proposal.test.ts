import { describe, expect, test } from 'bun:test'

import {
  parseEnrichmentProposalText,
  buildEnrichmentUserPrompt,
  filterEnrichmentProposal
} from './memory-enrichment-proposal'

describe('memory-enrichment-proposal', () => {
  test('解析围栏 JSON', () => {
    const proposal = parseEnrichmentProposalText(`\`\`\`json
{"objectType":"video","keywords":["wwii"],"entities":["Hitler"]}
\`\`\``)
    expect(proposal).toEqual({
      objectType: 'video',
      keywords: ['wwii'],
      entities: ['Hitler']
    })
  })

  test('拒绝 note 字段（strict）', () => {
    expect(parseEnrichmentProposalText(JSON.stringify({ keywords: ['a'], note: 'x' }))).toBeNull()
  })

  test('user prompt 含 rule hints', () => {
    const prompt = buildEnrichmentUserPrompt({
      title: 't',
      ruleHints: { tags: ['video'] }
    })
    expect(prompt).toContain('title: t')
    expect(prompt).toContain('rule_hints')
    expect(prompt).toContain('video')
  })

  test('含 CJK 的 token 丢弃；空字段变 undefined', () => {
    const filtered = filterEnrichmentProposal(
      {
        tags: ['history', '二战'],
        keywords: ['wwii', '战争'],
        entities: ['Hitler']
      },
      {
        title: 'WWII documentary about Hitler',
        text: 'A long look at wwii history.',
        url: 'https://example.com/wwii',
        domain: 'example.com'
      }
    )
    expect(filtered.tags).toEqual(['history'])
    expect(filtered.keywords).toEqual(['wwii'])
    expect(filtered.entities).toEqual(['Hitler'])
  })

  test('keywords/entities 未弱接地丢弃；tags 允许抽象', () => {
    const filtered = filterEnrichmentProposal(
      {
        tags: ['nostalgia'],
        keywords: ['wwii', 'unrelated-token'],
        entities: ['Hitler', 'MadeUpPerson']
      },
      {
        title: 'WWII documentary about Hitler',
        text: 'A long look at wwii history.',
        ruleHints: { keywords: ['wwii'], entities: ['Hitler'] }
      }
    )
    expect(filtered.tags).toEqual(['nostalgia'])
    expect(filtered.keywords).toEqual(['wwii'])
    expect(filtered.entities).toEqual(['Hitler'])
  })

  test('parse 带 context 时落地过滤', () => {
    const proposal = parseEnrichmentProposalText(
      JSON.stringify({
        tags: ['video'],
        keywords: ['wwii', '幽灵词'],
        entities: ['Hitler', '虚构实体']
      }),
      {
        title: 'WWII film about Hitler',
        text: 'wwii archival footage'
      }
    )
    expect(proposal).toEqual({
      tags: ['video'],
      keywords: ['wwii'],
      entities: ['Hitler']
    })
  })
})
