import { describe, expect, it } from 'vitest'

import { buildEnvironmentRecallSuggestions } from '@/core/recall/build-environment-recall-suggestions'

describe('buildEnvironmentRecallSuggestions', () => {
  it('无信号 → []', () => {
    expect(buildEnvironmentRecallSuggestions({})).toEqual([])
  })

  it('不再挂当前站芯片（已迁 composer 页上下文）', () => {
    expect(buildEnvironmentRecallSuggestions({})).toEqual([])
  })

  it('刚存 / 刚打开信号 → 对应闭集芯片', () => {
    const chips = buildEnvironmentRecallSuggestions({
      hasRecentlySavedSignal: true,
      hasRecentlyOpenedSignal: true
    })
    expect(chips.map(c => c.value)).toEqual(['just saved', 'opened recently'])
  })
})
