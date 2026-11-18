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
  it('默认分区为保存，且侧栏顺序固定（8 区）', () => {
    expect(DEFAULT_SETTINGS_SECTION).toBe('capture')
    expect(SETTINGS_SECTION_TABS.map(tab => tab.id)).toEqual([
      'capture',
      'third_party',
      'shortcuts',
      'account_sync',
      'ai',
      'privacy',
      'help_legal',
      'language'
    ])
  })

  it('third_party 排在 capture 之后；ai 紧跟 account_sync', () => {
    const ids = SETTINGS_SECTION_TABS.map(tab => tab.id)
    expect(ids.indexOf('third_party')).toBe(ids.indexOf('capture') + 1)
    expect(ids.indexOf('ai')).toBe(ids.indexOf('account_sync') + 1)
  })

  it('help_legal 在 privacy 之后、language 之前', () => {
    const ids = SETTINGS_SECTION_TABS.map(tab => tab.id)
    expect(ids.indexOf('help_legal')).toBe(ids.indexOf('privacy') + 1)
    expect(ids.indexOf('language')).toBe(ids.indexOf('help_legal') + 1)
  })

  it('resolveSettingsSectionTab 非法值回退保存；兼容旧 usage / data / help / legal', () => {
    expect(resolveSettingsSectionTab('shortcuts').id).toBe('shortcuts')
    expect(resolveSettingsSectionTab('account_sync').id).toBe('account_sync')
    expect(resolveSettingsSectionTab('privacy').id).toBe('privacy')
    expect(resolveSettingsSectionTab('ai').id).toBe('ai')
    expect(resolveSettingsSectionTab('help_legal').id).toBe('help_legal')
    expect(resolveSettingsSectionTab('help').id).toBe('help_legal')
    expect(resolveSettingsSectionTab('legal').id).toBe('help_legal')
    expect(resolveSettingsSectionTab('data').id).toBe('privacy')
    expect(resolveSettingsSectionTab('usage').id).toBe('capture')
    expect(resolveSettingsSectionTab('nope').id).toBe('capture')
    expect(resolveSettingsSectionTab(undefined).id).toBe('capture')
  })

  it('parseSettingsSectionFromLocationSearch 从 query 恢复分区', () => {
    expect(parseSettingsSectionFromLocationSearch('?section=shortcuts')).toBe('shortcuts')
    expect(parseSettingsSectionFromLocationSearch('?section=privacy')).toBe('privacy')
    expect(parseSettingsSectionFromLocationSearch('?section=help')).toBe('help_legal')
    expect(parseSettingsSectionFromLocationSearch('?section=legal')).toBe('help_legal')
    expect(parseSettingsSectionFromLocationSearch('?section=help_legal')).toBe('help_legal')
    expect(parseSettingsSectionFromLocationSearch('?section=data')).toBe('privacy')
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
