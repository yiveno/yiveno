import { describe, expect, it } from 'vitest'

import {
  DEFAULT_USER_SETTINGS,
  mergeUserSettings,
  parseUserSettings
} from '@/core/settings/user-settings'

describe('user-settings', () => {
  it('默认开启划词浮层与 AI；书签灌库默认关（须明示同意）', () => {
    expect(DEFAULT_USER_SETTINGS.selectionToolbarEnabled).toBe(true)
    expect(DEFAULT_USER_SETTINGS.aiFeaturesEnabled).toBe(true)
    expect(DEFAULT_USER_SETTINGS.chromeBookmarkIngestEnabled).toBe(false)
  })

  it('mergeUserSettings 合并局部更新', () => {
    expect(mergeUserSettings(DEFAULT_USER_SETTINGS, { selectionToolbarEnabled: false })).toEqual({
      selectionToolbarEnabled: false,
      aiFeaturesEnabled: true,
      chromeBookmarkIngestEnabled: false,
      mcpReadOnlyEnabled: false,
      uiLocalePreference: 'system'
    })
  })

  it('parseUserSettings 损坏数据回退默认；缺字段补默认', () => {
    expect(parseUserSettings({ selectionToolbarEnabled: false })).toEqual({
      selectionToolbarEnabled: false,
      aiFeaturesEnabled: true,
      chromeBookmarkIngestEnabled: false,
      mcpReadOnlyEnabled: false,
      uiLocalePreference: 'system'
    })
    expect(parseUserSettings({ selectionToolbarEnabled: 'yes' })).toEqual(DEFAULT_USER_SETTINGS)
    expect(parseUserSettings({ uiLocalePreference: 'zh_CN' }).uiLocalePreference).toBe('zh_CN')
  })
})
