/**
 * Offscreen 内跑一轮 Web Speech 听写。
 * 只回终稿；interim 不触发动作；12s 无 onresult → 停。
 */

import {
  VOICE_SHORTCUT_SILENCE_STOP_MS,
  composeSpeechDictationPreview
} from '@/core/speech/speech-dictation'
import type { OffscreenSpeechDictationResponse } from '@/core/messaging/offscreen-speech'
import { requestExtensionMicrophoneAccess } from '@/infrastructure/browser/microphone-permission'
import { logger } from '@/infrastructure/logging/logger'
import {
  createBrowserSpeechRecognition,
  extractSpeechRecognitionPieces,
  isBrowserSpeechRecognitionAvailable
} from '@/infrastructure/speech/browser-speech-recognition'

/** 在当前文档（offscreen）跑听写，Promise 在静默停 / 错误 / 结束时 resolve。 */
export async function runOffscreenSpeechDictation(
  lang: string
): Promise<OffscreenSpeechDictationResponse> {
  if (!isBrowserSpeechRecognitionAvailable()) {
    logger.warn('VoiceRecall', 'offscreen 听写不可用：无 SpeechRecognition')
    return { ok: false, error: 'unavailable' }
  }

  // 已授权则立刻放行；未授权时 offscreen 通常弹不出提示 → not_allowed → SW fallback 面板
  const mic = await requestExtensionMicrophoneAccess()
  if (mic !== 'granted') {
    logger.info('VoiceRecall', 'offscreen 麦克风未授予，交面板 fallback')
    return { ok: false, error: 'not_allowed' }
  }

  const recognition = createBrowserSpeechRecognition({
    lang,
    continuous: true,
    interimResults: true
  })
  if (!recognition) {
    return { ok: false, error: 'unavailable' }
  }

  return await new Promise<OffscreenSpeechDictationResponse>(resolve => {
    let committed = ''
    let settled = false
    let silenceTimer: ReturnType<typeof setTimeout> | null = null
    let sawResult = false

    const finish = (response: OffscreenSpeechDictationResponse) => {
      if (settled) {
        return
      }
      settled = true
      if (silenceTimer !== null) {
        clearTimeout(silenceTimer)
        silenceTimer = null
      }
      recognition.onresult = null
      recognition.onerror = null
      recognition.onend = null
      try {
        recognition.stop()
      } catch {
        // 已结束
      }
      resolve(response)
    }

    const bumpSilence = () => {
      if (silenceTimer !== null) {
        clearTimeout(silenceTimer)
      }
      silenceTimer = setTimeout(() => {
        silenceTimer = null
        const transcript = committed.trim()
        logger.info('VoiceRecall', 'offscreen 听写静默停', {
          silenceMs: VOICE_SHORTCUT_SILENCE_STOP_MS,
          hasTranscript: transcript.length > 0
        })
        if (!transcript) {
          finish({ ok: false, error: 'no_speech' })
          return
        }
        finish({ ok: true, transcript, path: 'offscreen' })
      }, VOICE_SHORTCUT_SILENCE_STOP_MS)
    }

    recognition.onresult = event => {
      const pieces = extractSpeechRecognitionPieces(event)
      const hasText = pieces.some(piece => piece.transcript.trim().length > 0)
      if (!hasText) {
        return
      }
      sawResult = true
      const merged = composeSpeechDictationPreview(committed, pieces)
      committed = merged.nextCommittedPrefix
      bumpSilence()
    }

    recognition.onerror = event => {
      const code = event.error
      logger.warn('VoiceRecall', 'offscreen 听写错误', { error: code })
      if (code === 'not-allowed' || code === 'service-not-allowed') {
        finish({ ok: false, error: 'not_allowed' })
        return
      }
      if (code === 'no-speech') {
        const transcript = committed.trim()
        if (transcript) {
          finish({ ok: true, transcript, path: 'offscreen' })
        } else {
          finish({ ok: false, error: 'no_speech' })
        }
        return
      }
      if (code === 'aborted') {
        const transcript = committed.trim()
        logger.warn('VoiceRecall', 'offscreen 听写 aborted 收尾', {
          sawResult,
          committedLength: committed.length,
          hasTranscript: transcript.length > 0
        })
        if (transcript) {
          finish({ ok: true, transcript, path: 'offscreen' })
        } else {
          finish({ ok: false, error: 'aborted' })
        }
        return
      }
      finish({
        ok: false,
        error: 'failed',
        message: event.message ?? code
      })
    }

    recognition.onend = () => {
      if (settled) {
        return
      }
      const transcript = committed.trim()
      if (transcript) {
        finish({ ok: true, transcript, path: 'offscreen' })
        return
      }
      finish({ ok: false, error: sawResult ? 'failed' : 'no_speech' })
    }

    try {
      recognition.start()
      bumpSilence()
      logger.info('VoiceRecall', 'offscreen 听写开始', {
        lang,
        silenceStopMs: VOICE_SHORTCUT_SILENCE_STOP_MS
      })
    } catch (error) {
      finish({
        ok: false,
        error: 'failed',
        message: error instanceof Error ? error.message : String(error)
      })
    }
  })
}
