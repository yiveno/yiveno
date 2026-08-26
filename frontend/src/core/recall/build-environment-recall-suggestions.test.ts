import { describe, expect, it } from 'vitest'

import { buildEnvironmentRecallSuggestions } from '@/core/recall/build-environment-recall-suggestions'

describe('buildEnvironmentRecallSuggestions', () => {
  it('无信号 → []', () => {
    expect(buildEnvironmentRecallSuggestions({})).toEqual([])
  })

  it('有当前站域名 → current-site 芯片，value 为 host', () => {
    expect(
      buildEnvironmentRecallSuggestions({
        currentTabDomain: 'www.Example.com'
      })
    ).toEqual([
      {
        id: 'env-current-site',
        labelKey: 'popup_env_chip_current_site',
        value: 'example.com'
      }
    ])
  })

  it('线索已含域名 → 不重复举当前站', () => {
    expect(
      buildEnvironmentRecallSuggestions({
        currentTabDomain: 'example.com',
        clueText: 'that thing on example.com'
      })
    ).toEqual([])
  })

  it('刚存 / 刚打开信号 → 对应闭集芯片', () => {
    const chips = buildEnvironmentRecallSuggestions({
      hasRecentlySavedSignal: true,
      hasRecentlyOpenedSignal: true
    })
    expect(chips.map(c => c.value)).toEqual(['just saved', 'opened recently'])
  })
})
