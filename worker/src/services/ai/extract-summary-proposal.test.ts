import { describe, expect, it } from 'bun:test'

import { ExtractCompleteRequestSchema, parseExtractSummaryText } from './extract-summary-proposal'

describe('extract-summary-proposal', () => {
  it('text 超 12000 → 校验失败', () => {
    const over = ExtractCompleteRequestSchema.safeParse({
      url: 'https://example.com/long',
      text: 'x'.repeat(12_001)
    })
    expect(over.success).toBe(false)
  })

  it('解析 JSON summary', () => {
    const parsed = parseExtractSummaryText('{"summary":"A short summary of the page content."}')
    expect(parsed?.summary).toBe('A short summary of the page content.')
  })

  it('解析失败返回 null（handler 据此 422 且不 commit 扣费）', () => {
    expect(parseExtractSummaryText('{')).toBeNull()
    expect(parseExtractSummaryText('{"summary":""}')).toBeNull()
    expect(parseExtractSummaryText('')).toBeNull()
  })
})
