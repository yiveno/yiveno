/**
 * Side Panel composer：麦克风听写 → 写入 clue 文案（不自动提交）。
 * 转写插入**点麦时光标位置**；取消还原整段；结束后由 UI 把 caret 钉在转写段末尾。
 * 无新转写超过静默窗口 → 自动 stop（保留文案）。
 * Side Panel 常无法弹出麦克风授权 → 壳内轻条引导；页内 getUserMedia，再不行开站点设置。
 */

import { onUnmounted, ref, type Ref } from 'vue'

import { RECALL_CLUE_MAX_CHARS } from '@/core/messaging/recall-messages'
import { clampRecallClueText } from '@/core/recall/clamp-recall-clue-text'
import {
  composeSpeechDictationWithCaretSuffix,
  SPEECH_DICTATION_SILENCE_STOP_MS,
  speechRecognitionLangForUiLocale,
  type SpeechDictationStatus
} from '@/core/speech/speech-dictation'
import { t } from '@/infrastructure/i18n/t'
import { showAppToast } from '@/infrastructure/ui/use-app-toast'
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
  /**
   * 点麦瞬间的纯文本光标偏移（与 contenteditable 序列化同规）。
   * 缺省 / 非法 → 插到文末。
   */
  getInsertOffset?: () => number
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
  /**
   * 本轮听写结束后建议的 caret 偏移（转写段末尾，不含光标后原文）。
   * idle 时为 null。
   */
  const caretAfterInsert = ref<number | null>(null)

  let recognition: BrowserSpeechRecognition | null = null
  /** 本轮听写开始时的完整 clue（取消时还原） */
  let sessionStartText = ''
  /** 点麦时光标前原文 + 已定稿转写 */
  let committedPrefix = ''
  /** 点麦时光标后原文（听写过程中不变） */
  let caretSuffix = ''
  let intentionalStop = false
  /** 无转写静默自动停 */
  let silenceTimer: ReturnType<typeof setTimeout> | null = null
  /** 听写超长 tip 节流 */
  let lastClueTooLongTipAt = 0

  function clearSilenceWatch(): void {
    if (silenceTimer !== null) {
      clearTimeout(silenceTimer)
      silenceTimer = null
    }
  }

  /** 有转写活动或刚开麦时重置；超时 → stop（保留文案）。 */
  function bumpSilenceWatch(): void {
    clearSilenceWatch()
    if (status.value !== 'listening') {
      return
    }
    silenceTimer = setTimeout(() => {
      silenceTimer = null
      if (status.value !== 'listening') {
        return
      }
      logger.info('SidePanel', '语音转写静默超时，自动停止', {
        silenceMs: SPEECH_DICTATION_SILENCE_STOP_MS
      })
      stopListening()
    }, SPEECH_DICTATION_SILENCE_STOP_MS)
  }

  function clearRecognitionHandlers(instance: BrowserSpeechRecognition): void {
    instance.onresult = null
    instance.onerror = null
    instance.onend = null
  }

  function teardownRecognition(): void {
    clearSilenceWatch()
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

  function resolveInsertOffset(full: string): number {
    const raw = options.getInsertOffset?.()
    if (typeof raw !== 'number' || !Number.isFinite(raw)) {
      return full.length
    }
    return Math.max(0, Math.min(full.length, Math.floor(raw)))
  }

  function stopListening(): void {
    clearSilenceWatch()
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
    caretAfterInsert.value = null
    teardownRecognition()
    status.value = 'idle'
    lastErrorKey.value = null
    logger.info('SidePanel', '语音转写已取消，还原 clue')
  }

  /** 听写遇无权限：壳内轻条，不新开扩展页。 */
  function enterPermissionNeeded(): void {
    clearSilenceWatch()
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
    const insertAt = resolveInsertOffset(sessionStartText)
    committedPrefix = sessionStartText.slice(0, insertAt)
    caretSuffix = sessionStartText.slice(insertAt)
    caretAfterInsert.value = insertAt
    const lang = speechRecognitionLangForUiLocale(getEffectiveUiLocale())
    const instance = createBrowserSpeechRecognition({ lang })
    if (!instance) {
      lastErrorKey.value = 'sidepanel_voice_error_generic'
      return
    }

    recognition = instance
    instance.onresult = event => {
      const pieces = extractSpeechRecognitionPieces(event)
      const hasText = pieces.some(piece => piece.transcript.trim().length > 0)
      if (hasText) {
        bumpSilenceWatch()
      }
      const merged = composeSpeechDictationWithCaretSuffix(committedPrefix, pieces, caretSuffix)
      const clamped = clampRecallClueText(merged.displayText)
      if (clamped.truncated) {
        const now = Date.now()
        if (now - lastClueTooLongTipAt >= 2500) {
          lastClueTooLongTipAt = now
          showAppToast({
            tone: 'warning',
            message: t('sidepanel_clue_too_long', String(RECALL_CLUE_MAX_CHARS))
          })
        }
        // 定稿前缀也压到上限内，避免后续 interim 继续涨
        committedPrefix = clampRecallClueText(merged.nextCommittedPrefix).text
        caretAfterInsert.value = Math.min(merged.caretEnd, clamped.text.length)
        options.model.value = clamped.text
        return
      }
      committedPrefix = merged.nextCommittedPrefix
      caretAfterInsert.value = merged.caretEnd
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
        // 浏览器判定无声：收口听写壳（保留已有转写），不依赖仅改 title
        if (status.value === 'listening') {
          stopListening()
        }
      } else if (code !== 'aborted') {
        lastErrorKey.value = 'sidepanel_voice_error_generic'
      }
    }

    instance.onend = () => {
      clearSilenceWatch()
      clearRecognitionHandlers(instance)
      if (recognition === instance) {
        recognition = null
      }
      if (status.value === 'requesting_permission') {
        return
      }
      status.value = 'idle'
      if (!intentionalStop) {
        logger.info('SidePanel', '语音转写会话结束', {
          insertAt,
          caretEnd: caretAfterInsert.value
        })
      }
      intentionalStop = false
    }

    try {
      instance.start()
      status.value = 'listening'
      bumpSilenceWatch()
      logger.info('SidePanel', '语音转写开始', {
        lang,
        insertAt,
        suffixLen: caretSuffix.length,
        silenceStopMs: SPEECH_DICTATION_SILENCE_STOP_MS
      })
    } catch (error) {
      logger.warn('SidePanel', '语音转写 start 失败', {
        error: error instanceof Error ? error.message : String(error)
      })
      teardownRecognition()
      lastErrorKey.value = 'sidepanel_voice_error_generic'
      status.value = 'idle'
      caretAfterInsert.value = null
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
    caretAfterInsert.value = null
  })

  return {
    supported,
    status,
    lastErrorKey,
    permissionBusy,
    caretAfterInsert,
    toggleListening,
    stopListening,
    cancelListening,
    allowMicrophoneFromPanel,
    dismissPermissionPrompt
  }
}
