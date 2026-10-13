import { describe, expect, it } from 'vitest'

import { parseGetBookmarkLibraryTreePayload } from '@/core/messaging/import-messages'

describe('parseGetBookmarkLibraryTreePayload', () => {
  it('undefined 视为空 payload', () => {
    expect(parseGetBookmarkLibraryTreePayload(undefined)).toEqual({})
  })

  it('解析 clientHash', () => {
    expect(parseGetBookmarkLibraryTreePayload({ clientHash: 'abc' })).toEqual({
      clientHash: 'abc'
    })
  })

  it('非法 shape 抛错', () => {
    expect(() => parseGetBookmarkLibraryTreePayload({ clientHash: 1 })).toThrow()
    expect(() => parseGetBookmarkLibraryTreePayload({ extra: 'x' })).toThrow()
  })
})
