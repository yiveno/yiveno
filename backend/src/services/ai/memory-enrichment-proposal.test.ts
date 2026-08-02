import { describe, expect, test } from 'bun:test'

import {
  parseEnrichmentProposalText,
  buildEnrichmentUserPrompt
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
})
