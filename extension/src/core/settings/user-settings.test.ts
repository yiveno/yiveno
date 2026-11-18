import { describe, expect, it } from 'vitest'

import {
  DEFAULT_USER_SETTINGS,
  mergeUserSettings,
  parseUserSettings
} from '@/core/settings/user-settings'

describe('user-settings', () => {
  it('默认开启划词浮层与 AI；书签导入与同步默认关', () => {
    expect(DEFAULT_USER_SETTINGS.selectionToolbarEnabled).toBe(true)
    expect(DEFAULT_USER_SETTINGS.aiFeaturesEnabled).toBe(true)
    expect(DEFAULT_USER_SETTINGS.linkStatusSweepEnabled).toBe(true)
    expect(DEFAULT_USER_SETTINGS.chromeBookmarkIngestEnabled).toBe(false)
    expect(DEFAULT_USER_SETTINGS.chromeBookmarkSyncEnabled).toBe(false)
    expect(DEFAULT_USER_SETTINGS.recallOutcomePairSoftAdjustEnabled).toBe(true)
    expect(DEFAULT_USER_SETTINGS.dualThreadLocalLearningEnabled).toBe(false)
    expect(DEFAULT_USER_SETTINGS.dualThreadContributeAggregatesEnabled).toBe(false)
  })

  it('mergeUserSettings 合并局部更新', () => {
    expect(mergeUserSettings(DEFAULT_USER_SETTINGS, { selectionToolbarEnabled: false })).toEqual({
      selectionToolbarEnabled: false,
      aiFeaturesEnabled: true,
      linkStatusSweepEnabled: true,
      chromeBookmarkIngestEnabled: false,
      chromeBookmarkSyncEnabled: false,
      mcpReadOnlyEnabled: false,
      recallOutcomePairSoftAdjustEnabled: true,
      dualThreadLocalLearningEnabled: false,
      dualThreadContributeAggregatesEnabled: false,
      uiLocalePreference: 'system'
    })
  })

  it('parseUserSettings 损坏数据回退默认；缺字段补默认', () => {
    expect(parseUserSettings({ selectionToolbarEnabled: false })).toEqual({
      selectionToolbarEnabled: false,
      aiFeaturesEnabled: true,
      linkStatusSweepEnabled: true,
      chromeBookmarkIngestEnabled: false,
      chromeBookmarkSyncEnabled: false,
      mcpReadOnlyEnabled: false,
      recallOutcomePairSoftAdjustEnabled: true,
      dualThreadLocalLearningEnabled: false,
      dualThreadContributeAggregatesEnabled: false,
      uiLocalePreference: 'system'
    })
    expect(parseUserSettings({ selectionToolbarEnabled: 'yes' })).toEqual(DEFAULT_USER_SETTINGS)
    expect(parseUserSettings({ uiLocalePreference: 'zh_CN' }).uiLocalePreference).toBe('zh_CN')
  })

  it('暗线同意 flag 缺省为 false', () => {
    expect(parseUserSettings({}).dualThreadLocalLearningEnabled).toBe(false)
    expect(parseUserSettings({}).dualThreadContributeAggregatesEnabled).toBe(false)
  })

  it('存量缺 sync 且 ingest 开 → sync 真', () => {
    expect(parseUserSettings({ chromeBookmarkIngestEnabled: true }).chromeBookmarkSyncEnabled).toBe(
      true
    )
  })

  it('存量缺 sync 且 ingest 关 → sync 假', () => {
    expect(
      parseUserSettings({ chromeBookmarkIngestEnabled: false }).chromeBookmarkSyncEnabled
    ).toBe(false)
  })

  it('存量已有 sync 值时不被 ingest 覆盖', () => {
    expect(
      parseUserSettings({
        chromeBookmarkIngestEnabled: true,
        chromeBookmarkSyncEnabled: false
      }).chromeBookmarkSyncEnabled
    ).toBe(false)
    expect(
      parseUserSettings({
        chromeBookmarkIngestEnabled: false,
        chromeBookmarkSyncEnabled: true
      }).chromeBookmarkSyncEnabled
    ).toBe(true)
  })
})
