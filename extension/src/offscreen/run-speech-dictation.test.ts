import { beforeEach, describe, expect, it, vi } from 'vitest'

import type {
  BrowserSpeechRecognition,
  BrowserSpeechRecognitionErrorEvent
} from '@/infrastructure/speech/browser-speech-recognition'

const requestExtensionMicrophoneAccess = vi.fn()
const createBrowserSpeechRecognition = vi.fn()
const isBrowserSpeechRecognitionAvailable = vi.fn()

vi.mock('@/infrastructure/browser/microphone-permission', () => ({
  requestExtensionMicrophoneAccess: (...args: unknown[]) =>
    requestExtensionMicrophoneAccess(...args)
}))

vi.mock('@/infrastructure/speech/browser-speech-recognition', async () => {
  const actual = await vi.importActual<
    typeof import('@/infrastructure/speech/browser-speech-recognition')
  >('@/infrastructure/speech/browser-speech-recognition')
  return {
    ...actual,
    createBrowserSpeechRecognition: (...args: unknown[]) => createBrowserSpeechRecognition(...args),
    isBrowserSpeechRecognitionAvailable: (...args: unknown[]) =>
      isBrowserSpeechRecognitionAvailable(...args)
  }
})

vi.mock('@/infrastructure/logging/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}))

function makeRecognition(): BrowserSpeechRecognition & {
  triggerError: (error: string) => void
  triggerResultFinal: (text: string) => void
} {
  const recognition = {
    continuous: true,
    interimResults: true,
    lang: 'en-US',
    start: vi.fn(),
    stop: vi.fn(),
    abort: vi.fn(),
    onresult: null as BrowserSpeechRecognition['onresult'],
    onerror: null as BrowserSpeechRecognition['onerror'],
    onend: null as BrowserSpeechRecognition['onend'],
    triggerError(error: string) {
      recognition.onerror?.({ error } as BrowserSpeechRecognitionErrorEvent)
    },
    triggerResultFinal(text: string) {
      recognition.onresult?.({
        resultIndex: 0,
        results: {
          length: 1,
          0: {
            isFinal: true,
            length: 1,
            0: { transcript: text }
          }
        }
      })
    }
  }
  return recognition
}

describe('runOffscreenSpeechDictation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useRealTimers()
    requestExtensionMicrophoneAccess.mockResolvedValue('granted')
    isBrowserSpeechRecognitionAvailable.mockReturnValue(true)
  })

  it('aborted 且有终稿 → ok', async () => {
    const recognition = makeRecognition()
    createBrowserSpeechRecognition.mockReturnValue(recognition)

    const { runOffscreenSpeechDictation } = await import('@/offscreen/run-speech-dictation')
    const promise = runOffscreenSpeechDictation('en-US')
    await Promise.resolve()
    recognition.triggerResultFinal('hello world')
    recognition.triggerError('aborted')
    await expect(promise).resolves.toEqual({
      ok: true,
      transcript: 'hello world',
      path: 'offscreen'
    })
  })

  it('aborted 且无终稿 → error aborted', async () => {
    const recognition = makeRecognition()
    createBrowserSpeechRecognition.mockReturnValue(recognition)

    const { runOffscreenSpeechDictation } = await import('@/offscreen/run-speech-dictation')
    const promise = runOffscreenSpeechDictation('en-US')
    await Promise.resolve()
    recognition.triggerError('aborted')
    await expect(promise).resolves.toEqual({
      ok: false,
      error: 'aborted'
    })
  })

  it('快捷键路径 2s 静默停并返回终稿', async () => {
    vi.useFakeTimers()
    const recognition = makeRecognition()
    createBrowserSpeechRecognition.mockReturnValue(recognition)

    const { runOffscreenSpeechDictation } = await import('@/offscreen/run-speech-dictation')
    const { VOICE_SHORTCUT_SILENCE_STOP_MS } = await import('@/core/speech/speech-dictation')
    const promise = runOffscreenSpeechDictation('en-US')
    await Promise.resolve()
    recognition.triggerResultFinal('shortcut clue')

    await vi.advanceTimersByTimeAsync(VOICE_SHORTCUT_SILENCE_STOP_MS - 1)
    // 尚未超时
    let settled = false
    void promise.then(() => {
      settled = true
    })
    await Promise.resolve()
    expect(settled).toBe(false)

    await vi.advanceTimersByTimeAsync(1)
    await expect(promise).resolves.toEqual({
      ok: true,
      transcript: 'shortcut clue',
      path: 'offscreen'
    })
  })
})
