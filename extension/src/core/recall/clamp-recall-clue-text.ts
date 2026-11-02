/**
 * Recall clue 长度门禁：与 `RECALL_CLUE_MAX_CHARS` / RECALL_WITH_CLUE 对齐。
 * 纯函数；composer / 听写在写入前调用。
 */

import { RECALL_CLUE_MAX_CHARS } from '@/core/messaging/recall-messages'

export type ClampRecallClueTextResult = {
  /** 截断后的文案（≤ 上限） */
  text: string
  /** 是否发生截断 */
  truncated: boolean
}

/** 将 clue 纯文本压到契约上限；未超则原样返回。 */
export function clampRecallClueText(
  raw: string,
  maxChars: number = RECALL_CLUE_MAX_CHARS
): ClampRecallClueTextResult {
  if (raw.length <= maxChars) {
    return { text: raw, truncated: false }
  }
  return { text: raw.slice(0, maxChars), truncated: true }
}

/**
 * 在已有 plain 上再插入一段时，最多还能写多少字符。
 * `selectedPlainLength` = 将被替换的选区纯文本长度（无选区传 0）。
 */
export function remainingRecallClueInsertCapacity(
  currentPlainLength: number,
  selectedPlainLength: number = 0,
  maxChars: number = RECALL_CLUE_MAX_CHARS
): number {
  const afterDelete = Math.max(0, currentPlainLength - Math.max(0, selectedPlainLength))
  return Math.max(0, maxChars - afterDelete)
}
