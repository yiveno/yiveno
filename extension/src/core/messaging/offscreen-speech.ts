/**
 * Offscreen 听写消息契约（SW ↔ offscreen document）。
 * 复用 browser-speech-recognition + speech-dictation；只回终稿。
 */

/** SW → offscreen：跑一轮听写直到静默停或错误。 */
export type OffscreenRunSpeechDictationMessage = {
  scope: 'offscreen'
  type: 'RUN_SPEECH_DICTATION'
  payload: {
    /** SpeechRecognition lang（BCP 47） */
    lang: string
  }
}

/** offscreen → SW：听写结果。 */
export type OffscreenSpeechDictationResponse =
  | { ok: true; transcript: string; path: 'offscreen' }
  | {
      ok: false
      error:
        | 'unavailable' // 无 SpeechRecognition
        | 'not_allowed' // 麦克风未授权 / 拒绝
        | 'no_speech' // 静默或浏览器 no-speech
        | 'failed' // 其它
      message?: string
    }

export function isOffscreenRunSpeechDictationMessage(
  message: unknown
): message is OffscreenRunSpeechDictationMessage {
  if (!message || typeof message !== 'object') {
    return false
  }
  const record = message as Record<string, unknown>
  return (
    record.scope === 'offscreen' &&
    record.type === 'RUN_SPEECH_DICTATION' &&
    typeof record.payload === 'object' &&
    record.payload !== null &&
    typeof (record.payload as { lang?: unknown }).lang === 'string'
  )
}
