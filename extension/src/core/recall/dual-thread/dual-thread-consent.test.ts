import { describe, expect, it } from 'vitest'

import {
  hasAnyFailureStageCounts,
  resolveDualThreadContributeBlockReason,
  resolveDualThreadContributionDisplay,
  shouldAttemptDualThreadSketchUpload
} from '@/core/recall/dual-thread/dual-thread-consent'
import { buildDualThreadAggregateSketch } from '@/core/recall/dual-thread/dual-thread-aggregate'

describe('dual-thread-consent', () => {
  it('开关 2：本地学习关 → need_local_learning', () => {
    expect(
      resolveDualThreadContributeBlockReason({
        localLearningEnabled: false,
        signedIn: true
      })
    ).toBe('need_local_learning')
  })

  it('开关 2：本地学习开但未登录 → need_sign_in', () => {
    expect(
      resolveDualThreadContributeBlockReason({
        localLearningEnabled: true,
        signedIn: false
      })
    ).toBe('need_sign_in')
  })

  it('开关 2：两者满足 → null（可用）', () => {
    expect(
      resolveDualThreadContributeBlockReason({
        localLearningEnabled: true,
        signedIn: true
      })
    ).toBeNull()
  })

  it('上传节流：24h 内不重复发；超 24h 可发', () => {
    const nowMs = Date.parse('2026-11-17T12:00:00.000Z')
    const within = {
      localLearningEnabled: true,
      contributeEnabled: true,
      hasAccessToken: true,
      lastSuccessAtIso: '2026-11-17T00:00:00.000Z',
      nowMs
    }
    expect(shouldAttemptDualThreadSketchUpload(within)).toBe(false)

    const after = {
      ...within,
      lastSuccessAtIso: '2026-11-16T11:59:00.000Z'
    }
    expect(shouldAttemptDualThreadSketchUpload(after)).toBe(true)

    expect(
      shouldAttemptDualThreadSketchUpload({
        ...within,
        lastSuccessAtIso: null
      })
    ).toBe(true)

    expect(
      shouldAttemptDualThreadSketchUpload({
        ...within,
        contributeEnabled: false,
        lastSuccessAtIso: null
      })
    ).toBe(false)
  })

  it('失败环节全零 → hasAnyFailureStageCounts false', () => {
    const sketch = buildDualThreadAggregateSketch({
      events: [],
      nowIso: '2026-11-17T00:00:00.000Z'
    })
    expect(hasAnyFailureStageCounts(sketch.failureStageCounts)).toBe(false)
  })

  it('贡献展示：失败 / 从未 / 今天 / 昨天 / 日期', () => {
    // 用本地日历构造，避免写死 +08:00 墙钟在 UTC CI 跨日判 yesterday
    const now = new Date(2026, 10, 17, 15, 0, 0)
    expect(
      resolveDualThreadContributionDisplay({
        state: { lastSuccessAtIso: null, lastAttemptFailed: true },
        now
      })
    ).toEqual({ kind: 'failed' })
    expect(
      resolveDualThreadContributionDisplay({
        state: { lastSuccessAtIso: null, lastAttemptFailed: false },
        now
      })
    ).toEqual({ kind: 'never' })
    expect(
      resolveDualThreadContributionDisplay({
        state: {
          lastSuccessAtIso: new Date(2026, 10, 17, 2, 0, 0).toISOString(),
          lastAttemptFailed: false
        },
        now
      })
    ).toEqual({ kind: 'today' })
    expect(
      resolveDualThreadContributionDisplay({
        state: {
          lastSuccessAtIso: new Date(2026, 10, 16, 10, 0, 0).toISOString(),
          lastAttemptFailed: false
        },
        now
      })
    ).toEqual({ kind: 'yesterday' })
    expect(
      resolveDualThreadContributionDisplay({
        state: {
          lastSuccessAtIso: new Date(2026, 10, 10, 10, 0, 0).toISOString(),
          lastAttemptFailed: false
        },
        now
      })
    ).toEqual({ kind: 'date', isoDate: '2026-11-10' })
  })
})
