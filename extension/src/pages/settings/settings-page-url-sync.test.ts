import { describe, expect, it, vi } from 'vitest'

import {
  buildSettingsPageUrl,
  readSettingsSectionFromLocation,
  resolveSettingsHistoryWriteMode,
  shouldWriteSettingsHistoryUrl,
  writeSettingsSectionToHistory
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

  it('shouldWriteSettingsHistoryUrl 仅在变化时为 true', () => {
    expect(shouldWriteSettingsHistoryUrl('/a', '/a')).toBe(false)
    expect(shouldWriteSettingsHistoryUrl('/a?x=1', '/a?x=2')).toBe(true)
  })

  it('resolveSettingsHistoryWriteMode 首屏 replace、用户 push、popstate skip', () => {
    expect(resolveSettingsHistoryWriteMode({ isInitialSync: true, fromPopstate: false })).toBe(
      'replace'
    )
    expect(resolveSettingsHistoryWriteMode({ isInitialSync: false, fromPopstate: false })).toBe(
      'push'
    )
    expect(resolveSettingsHistoryWriteMode({ isInitialSync: false, fromPopstate: true })).toBe(
      'skip'
    )
  })

  it('writeSettingsSectionToHistory 用户切 tab 用 pushState', () => {
    const pushState = vi.fn()
    const replaceState = vi.fn()
    const location = {
      pathname: '/settings.html',
      search: '',
      hash: ''
    }

    const wrote = writeSettingsSectionToHistory('ai', location, { pushState, replaceState }, 'push')

    expect(wrote).toBe(true)
    expect(pushState).toHaveBeenCalledWith(null, '', '/settings.html?section=ai')
    expect(replaceState).not.toHaveBeenCalled()
  })

  it('writeSettingsSectionToHistory URL 未变时不写 history', () => {
    const pushState = vi.fn()
    const replaceState = vi.fn()
    const location = {
      pathname: '/settings.html',
      search: '?section=ai',
      hash: ''
    }

    const wrote = writeSettingsSectionToHistory('ai', location, { pushState, replaceState }, 'push')

    expect(wrote).toBe(false)
    expect(pushState).not.toHaveBeenCalled()
    expect(replaceState).not.toHaveBeenCalled()
  })
})
