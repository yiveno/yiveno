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

  it('getExtensionCommandDisplayTitle 对找回命令使用产品文案', () => {
    expect(
      getExtensionCommandDisplayTitle(
        {
          name: '_execute_action',
          description: 'Open Yiveno Recall'
        },
        testTranslateZh
      )
    ).toBe('打开找回（Popup）')
  })

  it('formatExtensionCommandShortcut 处理未设置', () => {
    expect(formatExtensionCommandShortcut('Alt+Shift+Y', testTranslateZh)).toBe('Alt+Shift+Y')
    expect(formatExtensionCommandShortcut('', testTranslateZh)).toBe('未设置')
  })
})
