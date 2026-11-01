import { describe, expect, it } from 'vitest'

import {
  composeSpeechDictationPreview,
  mergeSpeechTranscriptIntoClue,
  speechRecognitionLangForUiLocale
} from '@/core/speech/speech-dictation'

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
