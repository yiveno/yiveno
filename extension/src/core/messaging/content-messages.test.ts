import { describe, expect, it } from 'vitest'

import {
  parseContentSelectionCommandMessage,
  parseContentSelectionErrorMessage,
  parseContentVoiceFeedbackMessage,
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

  it('解析 SHOW_SELECTION_ERROR', () => {
    expect(
      parseContentSelectionErrorMessage({
        scope: 'content',
        type: 'SHOW_SELECTION_ERROR',
        errorCode: 'CAPTURE_UNSAVABLE_PAGE'
      })
    ).toEqual({
      scope: 'content',
      type: 'SHOW_SELECTION_ERROR',
      errorCode: 'CAPTURE_UNSAVABLE_PAGE'
    })
    expect(
      parseContentSelectionErrorMessage({
        scope: 'content',
        type: 'SELECTION_SAVE'
      })
    ).toBeNull()
    expect(
      parseContentSelectionErrorMessage({
        scope: 'background',
        type: 'SHOW_SELECTION_ERROR',
        errorCode: 'x'
      })
    ).toBeNull()
  })

  it('解析 SHOW_VOICE_FEEDBACK', () => {
    expect(
      parseContentVoiceFeedbackMessage({
        scope: 'content',
        type: 'SHOW_VOICE_FEEDBACK',
        message: 'Did not catch that',
        title: 'Yiveno'
      })
    ).toEqual({
      scope: 'content',
      type: 'SHOW_VOICE_FEEDBACK',
      message: 'Did not catch that',
      title: 'Yiveno'
    })
    expect(
      parseContentVoiceFeedbackMessage({
        scope: 'content',
        type: 'SHOW_VOICE_FEEDBACK',
        message: ''
      })
    ).toBeNull()
    expect(
      parseContentVoiceFeedbackMessage({
        scope: 'background',
        type: 'SHOW_VOICE_FEEDBACK',
        message: 'x'
      })
    ).toBeNull()
  })
})
