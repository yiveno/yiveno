/**
 * 从摘录正文抽出适合预填到找回框的短线索（纯函数）。
 * 优先完整短语；过长则取前若干字。
 */

/** 预填线索最大字符数（中英混排按 code unit 截）。 */
export const RECALL_PREFILL_CLUE_MAX = 24

/** 压缩空白并截出预填线索；空串返回 null。 */
export function buildRecallPrefillClue(selectedText: string): string | null {
  const compact = selectedText.replace(/\s+/g, ' ').trim()
  if (!compact) {
    return null
  }
  if (compact.length <= RECALL_PREFILL_CLUE_MAX) {
    return compact
  }
  return `${compact.slice(0, RECALL_PREFILL_CLUE_MAX - 1)}…`
}

/** 存完浮层预览正文最大字符数。 */
export const CAPTURE_SAVED_PREVIEW_MAX = 48

/** 压缩并截断选区，供存完抓住感展示。 */
export function buildCaptureSavedPreview(selectedText: string): string {
  const compact = selectedText.replace(/\s+/g, ' ').trim()
  if (compact.length <= CAPTURE_SAVED_PREVIEW_MAX) {
    return compact
  }
  return `${compact.slice(0, CAPTURE_SAVED_PREVIEW_MAX - 1)}…`
}
