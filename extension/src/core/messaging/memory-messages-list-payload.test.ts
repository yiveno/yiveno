import { describe, expect, it } from 'vitest'

import { parseListMemoryItemsPayload } from '@/core/messaging/memory-messages'

describe('parseListMemoryItemsPayload offset', () => {
  it('接受 offset: 200', () => {
    expect(parseListMemoryItemsPayload({ type: 'text_excerpt', limit: 200, offset: 200 })).toEqual({
      type: 'text_excerpt',
      limit: 200,
      offset: 200
    })
  })

  it('拒绝 offset: -1', () => {
    expect(() => parseListMemoryItemsPayload({ offset: -1 })).toThrow()
  })
})
