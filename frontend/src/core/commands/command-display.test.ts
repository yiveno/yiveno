import { describe, expect, it } from 'vitest'

import { testTranslateEn } from '@/core/i18n/test-translate-en'
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

  it('getExtensionCommandDisplayTitle uses product-facing copy', () => {
    expect(
      getExtensionCommandDisplayTitle(
        {
          name: '_execute_action',
          description: 'Open Yiveno Recall'
        },
        testTranslateEn
      )
    ).toBe('Open Recall (side panel)')
    expect(
      getExtensionCommandDisplayTitle(
        {
          name: 'open_library',
          description: 'Open Yiveno Library'
        },
        testTranslateEn
      )
    ).toBe('Open Library')
    expect(
      getExtensionCommandDisplayTitle(
        {
          name: 'open_settings',
          description: 'Open Yiveno Settings'
        },
        testTranslateEn
      )
    ).toBe('Open Settings')
    expect(
      getExtensionCommandDisplayTitle(
        {
          name: 'save_selection',
          description: 'Save selected text to Yiveno'
        },
        testTranslateEn
      )
    ).toBe('Save Selected Text')
    expect(
      getExtensionCommandDisplayTitle(
        {
          name: 'save_selection_with_note',
          description: 'Save selected text with a note'
        },
        testTranslateEn
      )
    ).toBe('Save Selected Text With Note')
  })

  it('formatExtensionCommandShortcut 处理未设置', () => {
    expect(formatExtensionCommandShortcut('Alt+Shift+Y', testTranslateEn)).toBe('Alt+Shift+Y')
    expect(formatExtensionCommandShortcut('', testTranslateEn)).toBe('Not set')
  })
})
