/**
 * Side Panel composer：麦克风听写 → 写入 clue 文案（不自动提交）。
 * Side Panel 常无法弹出麦克风授权 → 壳内轻条引导；页内 getUserMedia，再不行开站点设置。
 */

import { onUnmounted, ref, type Ref } from 'vue'

import {
  composeSpeechDictationPreview,
  speechRecognitionLangForUiLocale,
  type SpeechDictationStatus
} from '@/core/speech/speech-dictation'
import {
  openExtensionMicrophoneSiteSettings,
  requestExtensionMicrophoneAccess
} from '@/infrastructure/browser/microphone-permission'
import { getEffectiveUiLocale } from '@/infrastructure/i18n/t'
import { logger } from '@/infrastructure/logging/logger'
import {
  createBrowserSpeechRecognition,
  extractSpeechRecognitionPieces,
  isBrowserSpeechRecognitionAvailable,
  type BrowserSpeechRecognition
} from '@/infrastructure/speech/browser-speech-recognition'

export type UseComposerSpeechDictationOptions = {
  /** clue 双向绑定 */
  model: Ref<string>
  /** 与 composer 同禁（召回中等） */
  disabled: Ref<boolean>
}

export function useComposerSpeechDictation(options: UseComposerSpeechDictationOptions) {
  const supported = isBrowserSpeechRecognitionAvailable()
  const status = ref<SpeechDictationStatus>('idle')
  const lastErrorKey = ref<
    | null
    | 'sidepanel_voice_error_not_allowed'
    | 'sidepanel_voice_error_no_speech'
    | 'sidepanel_voice_error_generic'
  >(null)
  /** 页内点「允许」进行中 */
  const permissionBusy = ref(false)

  let recognition: BrowserSpeechRecognition | null = null
  /** 本轮听写开始时的 clue（取消时还原） */
  let sessionStartText = ''
  /** 本轮听写开始时的 clue + 已定稿转写 */
  let committedPrefix = ''
  let intentionalStop = false

  function clearRecognitionHandlers(instance: BrowserSpeechRecognition): void {
    instance.onresult = null
    instance.onerror = null
    instance.onend = null
  }

  function teardownRecognition(): void {
    if (!recognition) {
      return
    }
    clearRecognitionHandlers(recognition)
    try {
      recognition.abort()
    } catch {
      // 已结束时 abort 可能抛；忽略
    }
    recognition = null
  }

  function stopListening(): void {
    if (!recognition || status.value !== 'listening') {
      if (status.value !== 'requesting_permission') {
        status.value = 'idle'
      }
      return
    }
    intentionalStop = true
    try {
      recognition.stop()
    } catch (error) {
      logger.warn('SidePanel', '停止语音转写失败', {
        error: error instanceof Error ? error.message : String(error)
      })
      teardownRecognition()
      status.value = 'idle'
    }
  }

  /** 取消听写：丢弃本轮转写，还原点麦前 clue。 */
  function cancelListening(): void {
    if (status.value !== 'listening' && status.value !== 'requesting_permission') {
      return
    }
    intentionalStop = true
    options.model.value = sessionStartText
    teardownRecognition()
    status.value = 'idle'
    lastErrorKey.value = null
    logger.info('SidePanel', '语音转写已取消，还原 clue')
  }

  /** 听写遇无权限：壳内轻条，不新开扩展页。 */
  function enterPermissionNeeded(): void {
    status.value = 'requesting_permission'
    lastErrorKey.value = 'sidepanel_voice_error_not_allowed'
    logger.info('SidePanel', '语音转写需麦克风授权，显示壳内提示')
  }

  function dismissPermissionPrompt(): void {
    if (status.value === 'requesting_permission') {
      status.value = 'idle'
    }
  }

  /**
   * 轻条「允许」：先在 Side Panel 内 getUserMedia；仍失败则打开浏览器站点设置。
   */
  async function allowMicrophoneFromPanel(): Promise<void> {
    if (permissionBusy.value || options.disabled.value) {
      return
    }
    permissionBusy.value = true
    try {
      const result = await requestExtensionMicrophoneAccess()
      if (result === 'granted') {
        lastErrorKey.value = null
        status.value = 'idle'
        logger.info('SidePanel', '壳内麦克风已授权，可再点麦听写')
        return
      }
      logger.info('SidePanel', '壳内授权失败，打开站点设置兜底')
      await openExtensionMicrophoneSiteSettings()
    } catch (error) {
      logger.warn('SidePanel', '壳内麦克风授权流程失败', {
        error: error instanceof Error ? error.message : String(error)
      })
      try {
        await openExtensionMicrophoneSiteSettings()
      } catch (settingsError) {
        logger.warn('SidePanel', '打开麦克风站点设置失败', {
          error: settingsError instanceof Error ? settingsError.message : String(settingsError)
        })
      }
    } finally {
      permissionBusy.value = false
    }
  }

  function startListening(): void {
    if (!supported || options.disabled.value) {
      return
    }
    if (status.value === 'listening') {
      stopListening()
      return
    }

    lastErrorKey.value = null
    intentionalStop = false
    sessionStartText = options.model.value
    committedPrefix = options.model.value
    const lang = speechRecognitionLangForUiLocale(getEffectiveUiLocale())
    const instance = createBrowserSpeechRecognition({ lang })
    if (!instance) {
      lastErrorKey.value = 'sidepanel_voice_error_generic'
      return
    }

    recognition = instance
    instance.onresult = event => {
      const pieces = extractSpeechRecognitionPieces(event)
      const merged = composeSpeechDictationPreview(committedPrefix, pieces)
      committedPrefix = merged.nextCommittedPrefix
      options.model.value = merged.displayText
    }

    instance.onerror = event => {
      const code = event.error
      logger.warn('SidePanel', '语音转写错误', { error: code, message: event.message })
      if (code === 'not-allowed' || code === 'service-not-allowed') {
        teardownRecognition()
        enterPermissionNeeded()
        return
      }
      if (code === 'no-speech') {
        lastErrorKey.value = 'sidepanel_voice_error_no_speech'
      } else if (code !== 'aborted') {
        lastErrorKey.value = 'sidepanel_voice_error_generic'
      }
    }

    instance.onend = () => {
      clearRecognitionHandlers(instance)
      if (recognition === instance) {
        recognition = null
      }
      if (status.value === 'requesting_permission') {
        return
      }
      status.value = 'idle'
      if (!intentionalStop) {
        logger.info('SidePanel', '语音转写会话结束')
      }
      intentionalStop = false
    }

    try {
      instance.start()
      status.value = 'listening'
      logger.info('SidePanel', '语音转写开始', { lang })
    } catch (error) {
      logger.warn('SidePanel', '语音转写 start 失败', {
        error: error instanceof Error ? error.message : String(error)
      })
      teardownRecognition()
      lastErrorKey.value = 'sidepanel_voice_error_generic'
      status.value = 'idle'
    }
  }

  function toggleListening(): void {
    if (status.value === 'listening') {
      stopListening()
      return
    }
    startListening()
  }

  onUnmounted(() => {
    intentionalStop = true
    teardownRecognition()
    status.value = 'idle'
  })

  return {
    supported,
    status,
    lastErrorKey,
    permissionBusy,
    toggleListening,
    stopListening,
    cancelListening,
    allowMicrophoneFromPanel,
    dismissPermissionPrompt
  }
}
