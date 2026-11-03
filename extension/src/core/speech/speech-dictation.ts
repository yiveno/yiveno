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
 * 听写无新转写（无 onresult）自动停止的静默窗口。
 * 等同点停止：保留已写入文案；不 cancel。浏览器 `no-speech` 另计。
 */
export const SPEECH_DICTATION_SILENCE_STOP_MS = 12_000

/**
 * UI locale → SpeechRecognition `lang`（BCP 47）的**默认**映射。
 * `speechLocale` 与 `uiLocale` 为独立轴（见 `Yiveno-国际化-CN-NA.md` §5.2）：
 * 当前无独立设置，默认跟随 UI；禁止在存储/类型层把二者焊死为同一字段。
 * 产品 clue 质量仍以美式英语为主；zh_CN UI 默认中文识别，仍走同一 composer 路径。
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
 * `committedPrefix` = 本轮听写开始时光标前原文 + 已定稿片段。
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

/**
 * 听写头（光标前+转写）与光标后原文拼接；边界无空白时补空格，避免粘连 URL。
 */
export function joinSpeechHeadAndCaretSuffix(head: string, caretSuffix: string): string {
  if (!caretSuffix) {
    return head
  }
  if (!head) {
    return caretSuffix
  }
  if (/\s$/u.test(head) || /^\s/u.test(caretSuffix)) {
    return `${head}${caretSuffix}`
  }
  return `${head} ${caretSuffix}`
}

/**
 * 听写插入光标处：前缀+转写 与 光标后原文（suffix）拼接。
 * `caretEnd` = 转写段末尾偏移（不含 suffix），供结束后钉光标。
 */
export function composeSpeechDictationWithCaretSuffix(
  committedPrefix: string,
  pieces: readonly SpeechRecognitionResultPiece[],
  caretSuffix: string
): {
  nextCommittedPrefix: string
  displayText: string
  caretEnd: number
  hasFinal: boolean
} {
  const merged = composeSpeechDictationPreview(committedPrefix, pieces)
  return {
    nextCommittedPrefix: merged.nextCommittedPrefix,
    displayText: joinSpeechHeadAndCaretSuffix(merged.displayText, caretSuffix),
    caretEnd: merged.displayText.length,
    hasFinal: merged.hasFinal
  }
}
