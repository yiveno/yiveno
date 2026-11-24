import { describe, expect, it } from 'vitest'

import { parseRecordRecallDismissPayload } from '@/core/messaging/memory-messages'
import { RECALL_RESULT_POOL_LIMIT } from '@/core/recall/build-recall-result'

/** 生成可复现的 UUID v4 形（第 13 位固定 4，第 17 位固定 8）。 */
function makeUuid(index: number): string {
  const hex = index.toString(16).padStart(12, '0')
  return `11111111-1111-4111-8111-${hex}`
}

describe('parseRecordRecallDismissPayload', () => {
  it(`接受 ${RECALL_RESULT_POOL_LIMIT} 条 ids（对齐结果池上限）`, () => {
    const ids = Array.from({ length: RECALL_RESULT_POOL_LIMIT }, (_, i) => makeUuid(i))
    expect(parseRecordRecallDismissPayload({ ids })).toEqual({ ids })
  })

  it(`拒绝 ${RECALL_RESULT_POOL_LIMIT + 1} 条 ids`, () => {
    const ids = Array.from({ length: RECALL_RESULT_POOL_LIMIT + 1 }, (_, i) => makeUuid(i))
    expect(() => parseRecordRecallDismissPayload({ ids })).toThrow()
  })

  it('拒绝空数组', () => {
    expect(() => parseRecordRecallDismissPayload({ ids: [] })).toThrow()
  })
})
