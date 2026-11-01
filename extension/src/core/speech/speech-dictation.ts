/**
 * Composer 语音转写（dictation）纯函数：语言、转写拼接、结果归并。
 * 不碰 Chrome / DOM；浏览器 SpeechRecognition 接线在 infrastructure / pages。
 */

import type { UiLocaleId } from '@/core/i18n/ui-locale'

/**
 * 语音转写会话状态（UI）。
 * - idle：未听
 * - listening：正在听
 * - requesting_permission：壳内轻条引导授权（页内 getUserMedia / 站点设置）
 */
export type SpeechDictationStatus =
  | 'idle' // 未听
  | 'listening' // 正在听
  | 'requesting_permission' // 壳内轻条引导授权

/**
 * UI locale → SpeechRecognition `lang`（BCP 47）。
 * 产品 clue 以美式英语为主；zh_CN UI 时跟浏览器中文识别，仍走同一 composer 路径。
 */
export function speechRecognitionLangForUiLocale(locale: UiLocaleId): string {
  return locale === 'zh_CN' ? 'zh-CN' : 'en-US'
}

/**
 * 把一段转写拼进已有 clue 文案。
 * 空底直接写入；有字时按需补空格，避免粘连。
 */
export function mergeSpeechTranscriptIntoClue(base: string, transcript: string): string {
  const trimmedTranscript = transcript.trim()
  if (!trimmedTranscript) {
    return base
  }
  const trimmedBase = base.replace(/\s+$/u, '')
  if (!trimmedBase) {
    return trimmedTranscript
  }
  const needsSpace = !/[\s([{]/u.test(trimmedBase.slice(-1))
  return needsSpace ? `${trimmedBase} ${trimmedTranscript}` : `${trimmedBase}${trimmedTranscript}`
}

/** 单次 SpeechRecognition `result` 事件里的一条结果。 */
export type SpeechRecognitionResultPiece = {
  transcript: string
  isFinal: boolean
}

/**
 * 从 result 列表归并：已定稿串 + 当前临时串（供 interim 预览）。
 * `committedPrefix` = 本轮听写开始前的 clue 快照 + 已定稿片段。
 */
export function composeSpeechDictationPreview(
  committedPrefix: string,
  pieces: readonly SpeechRecognitionResultPiece[]
): { nextCommittedPrefix: string; displayText: string; hasFinal: boolean } {
  let nextCommitted = committedPrefix
  let interim = ''
  let hasFinal = false
  for (const piece of pieces) {
    const text = piece.transcript.trim()
    if (!text) {
      continue
    }
    if (piece.isFinal) {
      hasFinal = true
      nextCommitted = mergeSpeechTranscriptIntoClue(nextCommitted, text)
    } else {
      interim = interim ? `${interim} ${text}` : text
    }
  }
  const displayText = interim
    ? mergeSpeechTranscriptIntoClue(nextCommitted, interim)
    : nextCommitted
  return { nextCommittedPrefix: nextCommitted, displayText, hasFinal }
}
