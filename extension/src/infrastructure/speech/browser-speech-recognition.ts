/**
 * 浏览器 Web Speech（SpeechRecognition）探测与最小封装。
 * 仅扩展页 / Side Panel 使用；SW 无 window。
 */

import { logger } from '@/infrastructure/logging/logger'

/** 与 DOM SpeechRecognitionResultList 对齐的最小 shape。 */
export type BrowserSpeechRecognitionResultList = {
  length: number
  [index: number]: {
    isFinal: boolean
    length: number
    [altIndex: number]: { transcript: string }
  }
}

/** 与 DOM SpeechRecognitionEvent 对齐的最小 shape。 */
export type BrowserSpeechRecognitionEvent = {
  resultIndex: number
  results: BrowserSpeechRecognitionResultList
}

/** 与 DOM SpeechRecognitionErrorEvent 对齐的最小 shape。 */
export type BrowserSpeechRecognitionErrorEvent = {
  error: string
  message?: string
}

/** Chrome / 标准 SpeechRecognition 构造器最小接口。 */
export type BrowserSpeechRecognitionCtor = new () => BrowserSpeechRecognition

/** 运行时 SpeechRecognition 实例最小接口。 */
export type BrowserSpeechRecognition = {
  continuous: boolean
  interimResults: boolean
  lang: string
  start: () => void
  stop: () => void
  abort: () => void
  onresult: ((event: BrowserSpeechRecognitionEvent) => void) | null
  onerror: ((event: BrowserSpeechRecognitionErrorEvent) => void) | null
  onend: (() => void) | null
}

/** 取可用的 SpeechRecognition 构造器；不支持则 null。 */
export function getBrowserSpeechRecognitionCtor(): BrowserSpeechRecognitionCtor | null {
  if (typeof window === 'undefined') {
    return null
  }
  const w = window as Window & {
    SpeechRecognition?: BrowserSpeechRecognitionCtor
    webkitSpeechRecognition?: BrowserSpeechRecognitionCtor
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

/** 当前环境是否可用语音转写。 */
export function isBrowserSpeechRecognitionAvailable(): boolean {
  return getBrowserSpeechRecognitionCtor() !== null
}

/**
 * 创建并配置一次听写会话实例（未 start）。
 * 失败返回 null（无构造器）。
 */
export function createBrowserSpeechRecognition(options: {
  lang: string
  continuous?: boolean
  interimResults?: boolean
}): BrowserSpeechRecognition | null {
  const Ctor = getBrowserSpeechRecognitionCtor()
  if (!Ctor) {
    logger.info('SidePanel', '语音转写不可用：无 SpeechRecognition')
    return null
  }
  const recognition = new Ctor()
  recognition.lang = options.lang
  recognition.continuous = options.continuous ?? true
  recognition.interimResults = options.interimResults ?? true
  return recognition
}

/**
 * 从 result 事件抽出从 resultIndex 起的 piece 列表（供 core 归并）。
 */
export function extractSpeechRecognitionPieces(
  event: BrowserSpeechRecognitionEvent
): { transcript: string; isFinal: boolean }[] {
  const pieces: { transcript: string; isFinal: boolean }[] = []
  for (let i = event.resultIndex; i < event.results.length; i += 1) {
    const result = event.results[i]
    if (!result || result.length < 1) {
      continue
    }
    const transcript = result[0]?.transcript ?? ''
    pieces.push({ transcript, isFinal: Boolean(result.isFinal) })
  }
  return pieces
}
