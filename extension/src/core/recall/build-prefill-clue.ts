/**
 * 从摘录正文抽出适合预填到找回框的短线索，以及存完浮层预览正文（纯函数）。
 *
 * 分工：
 * - `buildRecallPrefillClue`：业务意图「预填短线索进 composer」，属数据/交互契约，可字符截断。
 * - `buildCaptureSavedPreview`：展示预览；可见行数由 CSS line-clamp，JS 只归一空白与病态安全上限。
 */

/** 预填线索最大字符数（中英混排按 code unit 截；业务短线索，非布局省略）。 */
export const RECALL_PREFILL_CLUE_MAX = 24

/** 存完浮层预览病态安全上限（可见截断交给 `.saved-preview` line-clamp）。 */
export const CAPTURE_SAVED_PREVIEW_SAFETY_MAX = 500

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

/** 压缩选区供存完抓住感展示；不按布局宽度硬截。 */
export function buildCaptureSavedPreview(selectedText: string): string {
  const compact = selectedText.replace(/\s+/g, ' ').trim()
  if (compact.length <= CAPTURE_SAVED_PREVIEW_SAFETY_MAX) {
    return compact
  }
  return `${compact.slice(0, CAPTURE_SAVED_PREVIEW_SAFETY_MAX - 1)}…`
}
