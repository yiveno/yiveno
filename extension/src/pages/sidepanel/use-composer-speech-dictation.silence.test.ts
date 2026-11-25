import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'

import {
  SPEECH_DICTATION_SILENCE_STOP_MS,
  VOICE_SHORTCUT_SILENCE_STOP_MS
} from '@/core/speech/speech-dictation'
import type { BrowserSpeechRecognition } from '@/infrastructure/speech/browser-speech-recognition'

const createBrowserSpeechRecognition = vi.fn()
const isBrowserSpeechRecognitionAvailable = vi.fn()
const requestExtensionMicrophoneAccess = vi.fn()

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

vi.mock('@/infrastructure/browser/microphone-permission', () => ({
  requestExtensionMicrophoneAccess: (...args: unknown[]) =>
    requestExtensionMicrophoneAccess(...args),
  openExtensionMicrophoneSiteSettings: vi.fn()
}))

vi.mock('@/infrastructure/i18n/t', () => ({
  t: (key: string) => key,
  getEffectiveUiLocale: () => 'en'
}))

vi.mock('@/infrastructure/ui/use-app-toast', () => ({
  showAppToast: vi.fn()
}))

vi.mock('@/infrastructure/logging/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}))

function makeRecognition(): BrowserSpeechRecognition & {
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

describe('useComposerSpeechDictation 静默窗口', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    isBrowserSpeechRecognitionAvailable.mockReturnValue(true)
    requestExtensionMicrophoneAccess.mockResolvedValue('granted')
  })

  it('快捷键路径 silenceStopMs=3s：静默后 stop reason=silence', async () => {
    const recognition = makeRecognition()
    createBrowserSpeechRecognition.mockReturnValue(recognition)
    const model = ref('')
    const { useComposerSpeechDictation } =
      await import('@/pages/sidepanel/use-composer-speech-dictation')
    const speech = useComposerSpeechDictation({
      model,
      disabled: ref(false),
      silenceStopMs: VOICE_SHORTCUT_SILENCE_STOP_MS
    })

    speech.toggleListening()
    await nextTick()
    expect(speech.status.value).toBe('listening')
    recognition.triggerResultFinal('hello')

    await vi.advanceTimersByTimeAsync(VOICE_SHORTCUT_SILENCE_STOP_MS - 1)
    expect(speech.lastStopReason.value).not.toBe('silence')

    await vi.advanceTimersByTimeAsync(1)
    expect(speech.lastStopReason.value).toBe('silence')
    expect(model.value).toContain('hello')
  })

  it('手动听写默认 12s 静默，3s 内不停', async () => {
    const recognition = makeRecognition()
    createBrowserSpeechRecognition.mockReturnValue(recognition)
    const model = ref('')
    const { useComposerSpeechDictation } =
      await import('@/pages/sidepanel/use-composer-speech-dictation')
    const speech = useComposerSpeechDictation({
      model,
      disabled: ref(false)
      // 不传 silenceStopMs → 12s
    })

    speech.toggleListening()
    await nextTick()
    recognition.triggerResultFinal('manual')

    await vi.advanceTimersByTimeAsync(VOICE_SHORTCUT_SILENCE_STOP_MS)
    expect(speech.status.value).toBe('listening')
    expect(speech.lastStopReason.value).not.toBe('silence')

    await vi.advanceTimersByTimeAsync(
      SPEECH_DICTATION_SILENCE_STOP_MS - VOICE_SHORTCUT_SILENCE_STOP_MS
    )
    expect(speech.lastStopReason.value).toBe('silence')
  })
})

describe('useComposerSpeechDictation endSessionForSend 防回填', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useRealTimers()
    isBrowserSpeechRecognitionAvailable.mockReturnValue(true)
    requestExtensionMicrophoneAccess.mockResolvedValue('granted')
  })

  it('静默自动提交后：endSessionForSend 后迟到 onresult 不回填', async () => {
    const recognition = makeRecognition()
    createBrowserSpeechRecognition.mockReturnValue(recognition)
    const model = ref('')
    const { useComposerSpeechDictation } =
      await import('@/pages/sidepanel/use-composer-speech-dictation')
    const speech = useComposerSpeechDictation({
      model,
      disabled: ref(false),
      silenceStopMs: VOICE_SHORTCUT_SILENCE_STOP_MS
    })

    speech.toggleListening()
    await nextTick()
    recognition.triggerResultFinal('send me')
    // 模拟静默停（stop 仍可能补送 onresult）
    speech.stopListening('silence')
    expect(model.value).toContain('send me')

    // 发送路径：先关会话再清空（父组件清空 clue）
    speech.endSessionForSend()
    model.value = ''
    // 模拟 recognition.stop() 迟到终稿
    recognition.triggerResultFinal('late fillback')
    expect(model.value).toBe('')
    expect(speech.status.value).toBe('idle')
    expect(recognition.abort).toHaveBeenCalled()
  })

  it('listening 中 endSessionForSend：会话关闭且 model 保留发送文案', async () => {
    const recognition = makeRecognition()
    createBrowserSpeechRecognition.mockReturnValue(recognition)
    const model = ref('')
    const { useComposerSpeechDictation } =
      await import('@/pages/sidepanel/use-composer-speech-dictation')
    const speech = useComposerSpeechDictation({
      model,
      disabled: ref(false)
    })

    speech.toggleListening()
    await nextTick()
    recognition.triggerResultFinal('keep for send')
    expect(speech.status.value).toBe('listening')

    speech.endSessionForSend()
    expect(speech.status.value).toBe('idle')
    expect(model.value).toContain('keep for send')
    // 父组件清空后迟到结果不回填
    model.value = ''
    recognition.triggerResultFinal('should not appear')
    expect(model.value).toBe('')
  })

  it('手动停后 endSessionForSend：可正常清空且迟到结果不回填', async () => {
    const recognition = makeRecognition()
    createBrowserSpeechRecognition.mockReturnValue(recognition)
    const model = ref('')
    const { useComposerSpeechDictation } =
      await import('@/pages/sidepanel/use-composer-speech-dictation')
    const speech = useComposerSpeechDictation({
      model,
      disabled: ref(false)
    })

    speech.toggleListening()
    await nextTick()
    recognition.triggerResultFinal('manual then send')
    speech.stopListening('manual')
    expect(speech.lastStopReason.value).toBe('manual')

    speech.endSessionForSend()
    model.value = ''
    recognition.triggerResultFinal('ghost')
    expect(model.value).toBe('')
    expect(speech.status.value).toBe('idle')
  })
})
