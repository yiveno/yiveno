import { describe, expect, it } from 'vitest'

import { testTranslateZh } from '@/core/i18n/test-translate-zh'
import {
  formatExtensionCommandShortcut,
  getExtensionCommandDisplayTitle,
  normalizeExtensionCommand
} from '@/core/commands/command-display'

describe('command-display', () => {
  it('normalizeExtensionCommand 丢弃无名命令', () => {
    expect(normalizeExtensionCommand({})).toBeNull()
    expect(
      normalizeExtensionCommand({
        name: '_execute_action',
        description: 'Open Yiveno Recall',
        shortcut: 'Alt+Shift+Y'
      })
    ).toEqual({
      name: '_execute_action',
      description: 'Open Yiveno Recall',
      shortcut: 'Alt+Shift+Y'
    })
  })

  it('getExtensionCommandDisplayTitle 对找回/记忆库/设置/划词使用产品文案', () => {
    expect(
      getExtensionCommandDisplayTitle(
        {
          name: '_execute_action',
          description: 'Open Yiveno Recall'
        },
        testTranslateZh
      )
    ).toBe('打开找回（Popup）')
    expect(
      getExtensionCommandDisplayTitle(
        {
          name: 'open_library',
          description: 'Open Yiveno Library'
        },
        testTranslateZh
      )
    ).toBe('打开记忆库')
    expect(
      getExtensionCommandDisplayTitle(
        {
          name: 'open_settings',
          description: 'Open Yiveno Settings'
        },
        testTranslateZh
      )
    ).toBe('打开设置')
    expect(
      getExtensionCommandDisplayTitle(
        {
          name: 'save_selection',
          description: 'Save selected text to Yiveno'
        },
        testTranslateZh
      )
    ).toBe('保存选中文字')
    expect(
      getExtensionCommandDisplayTitle(
        {
          name: 'save_selection_with_note',
          description: 'Save selected text with a note'
        },
        testTranslateZh
      )
    ).toBe('保存选中文字并备注')
  })

  it('formatExtensionCommandShortcut 处理未设置', () => {
    expect(formatExtensionCommandShortcut('Alt+Shift+Y', testTranslateZh)).toBe('Alt+Shift+Y')
    expect(formatExtensionCommandShortcut('', testTranslateZh)).toBe('未设置')
  })
})
