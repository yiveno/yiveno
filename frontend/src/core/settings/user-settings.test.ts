import { describe, expect, it } from 'vitest'

import {
  DEFAULT_USER_SETTINGS,
  mergeUserSettings,
  parseUserSettings
} from '@/core/settings/user-settings'

describe('user-settings', () => {
  it('默认开启划词浮层、AI 与书签灌库', () => {
    expect(DEFAULT_USER_SETTINGS.selectionToolbarEnabled).toBe(true)
    expect(DEFAULT_USER_SETTINGS.aiFeaturesEnabled).toBe(true)
    expect(DEFAULT_USER_SETTINGS.chromeBookmarkIngestEnabled).toBe(true)
  })

  it('mergeUserSettings 合并局部更新', () => {
    expect(mergeUserSettings(DEFAULT_USER_SETTINGS, { selectionToolbarEnabled: false })).toEqual({
      selectionToolbarEnabled: false,
      aiFeaturesEnabled: true,
      chromeBookmarkIngestEnabled: true,
      mcpReadOnlyEnabled: false
    })
  })

  it('parseUserSettings 损坏数据回退默认；缺字段补默认', () => {
    expect(parseUserSettings({ selectionToolbarEnabled: false })).toEqual({
      selectionToolbarEnabled: false,
      aiFeaturesEnabled: true,
      chromeBookmarkIngestEnabled: true,
      mcpReadOnlyEnabled: false
    })
    expect(parseUserSettings({ selectionToolbarEnabled: 'yes' })).toEqual(DEFAULT_USER_SETTINGS)
  })
})
