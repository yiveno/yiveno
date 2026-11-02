import { describe, expect, it } from 'vitest'

import {
  composeSpeechDictationPreview,
  composeSpeechDictationWithCaretSuffix,
  mergeSpeechTranscriptIntoClue,
  SPEECH_DICTATION_SILENCE_STOP_MS,
  speechRecognitionLangForUiLocale
} from '@/core/speech/speech-dictation'

describe('SPEECH_DICTATION_SILENCE_STOP_MS', () => {
  it('静默自动停窗口为 12s 量级', () => {
    expect(SPEECH_DICTATION_SILENCE_STOP_MS).toBe(12_000)
  })
})

describe('speechRecognitionLangForUiLocale', () => {
  it('en → en-US；zh_CN → zh-CN', () => {
    expect(speechRecognitionLangForUiLocale('en')).toBe('en-US')
    expect(speechRecognitionLangForUiLocale('zh_CN')).toBe('zh-CN')
  })
})

describe('mergeSpeechTranscriptIntoClue', () => {
  it('空底直接写入；有字补空格；空转写不变', () => {
    expect(mergeSpeechTranscriptIntoClue('', 'that article')).toBe('that article')
    expect(mergeSpeechTranscriptIntoClue('about AI', 'agents')).toBe('about AI agents')
    expect(mergeSpeechTranscriptIntoClue('about AI ', 'agents')).toBe('about AI agents')
    expect(mergeSpeechTranscriptIntoClue('hello', '  ')).toBe('hello')
  })
})

describe('composeSpeechDictationPreview', () => {
  it('定稿累加；interim 叠在定稿后', () => {
    const first = composeSpeechDictationPreview('', [
      { transcript: 'that article', isFinal: true },
      { transcript: 'about', isFinal: false }
    ])
    expect(first.nextCommittedPrefix).toBe('that article')
    expect(first.displayText).toBe('that article about')
    expect(first.hasFinal).toBe(true)

    const second = composeSpeechDictationPreview(first.nextCommittedPrefix, [
      { transcript: 'about memory', isFinal: true }
    ])
    expect(second.nextCommittedPrefix).toBe('that article about memory')
    expect(second.displayText).toBe('that article about memory')
  })
})

describe('composeSpeechDictationWithCaretSuffix', () => {
  it('转写插在光标处，suffix 仍在后；边界补空格；caretEnd 在转写末', () => {
    // 原文只有 URL，光标在最前 → before="" suffix=URL
    const result = composeSpeechDictationWithCaretSuffix(
      '',
      [{ transcript: 'hello', isFinal: true }],
      'https://example.com/'
    )
    expect(result.displayText).toBe('hello https://example.com/')
    expect(result.caretEnd).toBe('hello'.length)
  })

  it('光标在中间：前缀保留，转写插入，后缀原样', () => {
    const before = 'https://example.com/ '
    const after = 'more'
    const result = composeSpeechDictationWithCaretSuffix(
      before,
      [{ transcript: '你好', isFinal: true }],
      after
    )
    expect(result.displayText).toBe('https://example.com/ 你好 more')
    expect(result.caretEnd).toBe('https://example.com/ 你好'.length)
  })
})
