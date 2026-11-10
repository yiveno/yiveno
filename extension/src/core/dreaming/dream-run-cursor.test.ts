import { describe, expect, it } from 'vitest'

import {
  advanceDreamRunCursor,
  createDreamRunId,
  isSourceProcessedInDreamRun,
  pickPendingSourceIdsAfterCursor,
  startDreamRun
} from '@/core/dreaming/dream-run-cursor'

describe('dream-run-cursor', () => {
  it('createDreamRunId 带 dream_ 前缀', () => {
    expect(createDreamRunId(1_700_000_000_000)).toMatch(/^dream_/)
  })

  it('中断续跑：游标推进后已处理源跳过、后续源继续', () => {
    const started = startDreamRun(1_700_000_000_000)
    expect(started.lastCursor).toBe('')
    expect(isSourceProcessedInDreamRun(started, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')).toBe(false)

    const afterFirst = advanceDreamRunCursor(
      started,
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      1_700_000_000_100
    )
    expect(afterFirst.dreamRunId).toBe(started.dreamRunId)
    expect(afterFirst.lastCursor).toBe('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')
    expect(isSourceProcessedInDreamRun(afterFirst, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')).toBe(
      true
    )
    expect(isSourceProcessedInDreamRun(afterFirst, 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')).toBe(
      true
    )
    expect(isSourceProcessedInDreamRun(afterFirst, 'cccccccc-cccc-4ccc-8ccc-cccccccccccc')).toBe(
      false
    )

    const sorted = [
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
    ]
    expect(pickPendingSourceIdsAfterCursor(sorted, afterFirst, 2)).toEqual([
      'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
    ])
    expect(pickPendingSourceIdsAfterCursor(sorted, afterFirst, 1)).toEqual([
      'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
    ])
  })
})
