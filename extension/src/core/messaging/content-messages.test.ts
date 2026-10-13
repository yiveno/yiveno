import { describe, expect, it } from 'vitest'

import {
  parseContentSelectionCommandMessage,
  isContentScopedMessage
} from '@/core/messaging/content-messages'

describe('content-messages', () => {
  it('解析划词快捷键命令', () => {
    expect(
      parseContentSelectionCommandMessage({
        scope: 'content',
        type: 'SELECTION_SAVE'
      })
    ).toEqual({ scope: 'content', type: 'SELECTION_SAVE' })
    expect(
      parseContentSelectionCommandMessage({
        scope: 'content',
        type: 'SELECTION_OPEN_NOTE'
      })
    ).toEqual({ scope: 'content', type: 'SELECTION_OPEN_NOTE' })
  })

  it('拒绝非 content / 未知 type', () => {
    expect(
      parseContentSelectionCommandMessage({ scope: 'background', type: 'SELECTION_SAVE' })
    ).toBeNull()
    expect(parseContentSelectionCommandMessage({ scope: 'content', type: 'UNKNOWN' })).toBeNull()
    expect(isContentScopedMessage({ scope: 'content', type: 'x' })).toBe(true)
    expect(isContentScopedMessage({ scope: 'background', type: 'x' })).toBe(false)
  })
})
