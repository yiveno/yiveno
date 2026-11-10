import { describe, expect, it } from 'bun:test'

import {
  DREAMING_BATCH_MAX_SOURCES,
  DreamingCompileRequestSchema,
  parseDreamingCompileText
} from './dreaming-compile-proposal'

describe('dreaming-compile-proposal', () => {
  it('batch 上限为 8', () => {
    expect(DREAMING_BATCH_MAX_SOURCES).toBe(8)
    const over = DreamingCompileRequestSchema.safeParse({
      sources: Array.from({ length: 9 }, (_, index) => ({
        id: `11111111-1111-4111-8111-${String(index).padStart(12, '0')}`,
        type: 'text_excerpt',
        text: 'hello world excerpt body'
      }))
    })
    expect(over.success).toBe(false)
  })

  it('无 sourceQuote 的命题在 parse 后仍可被上层滤掉；合法 JSON 可解析', () => {
    const raw = JSON.stringify({
      results: [
        {
          sourceId: '22222222-2222-4222-8222-222222222222',
          propositions: [
            {
              text: 'People organize information.',
              sourceQuote: 'organize information'
            }
          ]
        }
      ]
    })
    const parsed = parseDreamingCompileText(raw)
    expect(parsed).not.toBeNull()
    expect(parsed!.results[0]!.propositions[0]!.sourceQuote).toBe('organize information')
  })
})
