import { describe, expect, it } from 'vitest'

import {
  buildSettingsSectionLocationSearch,
  DEFAULT_SETTINGS_SECTION,
  hasSettingsSectionInLocationSearch,
  parseSettingsSectionFromLocationSearch,
  resolveSettingsSectionTab,
  SETTINGS_SECTION_TABS
} from '@/core/settings/settings-sections'

describe('settings-sections', () => {
  it('默认分区为保存，且侧栏顺序固定', () => {
    expect(DEFAULT_SETTINGS_SECTION).toBe('capture')
    expect(SETTINGS_SECTION_TABS.map(tab => tab.id)).toEqual([
      'capture',
      'shortcuts',
      'account_sync',
      'privacy',
      'ai'
    ])
  })

  it('resolveSettingsSectionTab 非法值回退保存；兼容旧 usage', () => {
    expect(resolveSettingsSectionTab('shortcuts').id).toBe('shortcuts')
    expect(resolveSettingsSectionTab('account_sync').id).toBe('account_sync')
    expect(resolveSettingsSectionTab('usage').id).toBe('capture')
    expect(resolveSettingsSectionTab('nope').id).toBe('capture')
    expect(resolveSettingsSectionTab(undefined).id).toBe('capture')
  })

  it('parseSettingsSectionFromLocationSearch 从 query 恢复分区', () => {
    expect(parseSettingsSectionFromLocationSearch('?section=shortcuts')).toBe('shortcuts')
    expect(parseSettingsSectionFromLocationSearch('?section=privacy')).toBe('privacy')
    expect(parseSettingsSectionFromLocationSearch('section=ai')).toBe('ai')
    expect(parseSettingsSectionFromLocationSearch('')).toBe('capture')
    expect(parseSettingsSectionFromLocationSearch('?section=nope')).toBe('capture')
  })

  it('hasSettingsSectionInLocationSearch 识别显式 section', () => {
    expect(hasSettingsSectionInLocationSearch('?section=sync')).toBe(true)
    expect(hasSettingsSectionInLocationSearch('?section=')).toBe(false)
    expect(hasSettingsSectionInLocationSearch('')).toBe(false)
  })

  it('buildSettingsSectionLocationSearch 默认保存不写 section', () => {
    expect(buildSettingsSectionLocationSearch('capture')).toBe('')
    expect(buildSettingsSectionLocationSearch('shortcuts')).toBe('?section=shortcuts')
    expect(buildSettingsSectionLocationSearch('account_sync')).toBe('?section=account_sync')
    expect(buildSettingsSectionLocationSearch('capture', '?section=ai&x=1')).toBe('?x=1')
  })
})
