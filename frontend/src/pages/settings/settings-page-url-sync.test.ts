import { describe, expect, it } from 'vitest'

import {
  buildSettingsPageUrl,
  readSettingsSectionFromLocation,
  shouldReplaceSettingsHistoryUrl
} from '@/pages/settings/settings-page-url-sync'

describe('settings-page-url-sync', () => {
  it('readSettingsSectionFromLocation 解析 query', () => {
    expect(readSettingsSectionFromLocation({ search: '?section=ai' })).toBe('ai')
    expect(readSettingsSectionFromLocation({ search: '' })).toBe('capture')
  })

  it('buildSettingsPageUrl 默认分区去掉 section', () => {
    expect(
      buildSettingsPageUrl('capture', {
        pathname: '/settings.html',
        search: '?section=shortcuts',
        hash: ''
      })
    ).toBe('/settings.html')
  })

  it('buildSettingsPageUrl 非默认分区写入 section', () => {
    expect(
      buildSettingsPageUrl('privacy', {
        pathname: '/settings.html',
        search: '',
        hash: '#top'
      })
    ).toBe('/settings.html?section=privacy#top')
  })

  it('shouldReplaceSettingsHistoryUrl 仅在变化时为 true', () => {
    expect(shouldReplaceSettingsHistoryUrl('/a', '/a')).toBe(false)
    expect(shouldReplaceSettingsHistoryUrl('/a?x=1', '/a?x=2')).toBe(true)
  })
})
