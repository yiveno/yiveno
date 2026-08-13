/**
 * Popup 空状态 / 恢复文案选择（纯函数；文案经注入的 translate）。
 */
import type { TranslateFn } from '@/core/i18n/translate'

/** Popup 侧记忆库是否已有可检内容。 */
export type PopupLibraryState =
  | 'unknown' // 尚未判定
  | 'empty' // 空库
  | 'ready' // 有条目可找回

export interface PopupEmptyCopy {
  title: string
  body: string
  showShortenRetry: boolean
}

/** idle 区引导（有库时不展示额外空态块，除非仍在安装引导 Capture-first 阶段）。 */
export function getPopupIdleEmptyCopy(
  library: PopupLibraryState,
  importing: boolean,
  translate: TranslateFn,
  options: { captureFirst?: boolean } = {}
): PopupEmptyCopy | null {
  if (options.captureFirst) {
    return {
      title: translate('popup_capture_first_title'),
      body: importing
        ? translate('popup_capture_first_body_importing')
        : translate('popup_capture_first_body'),
      showShortenRetry: false
    }
  }

  if (library !== 'empty') {
    return null
  }

  return {
    title: translate('popup_empty_no_memory_title'),
    body: importing
      ? translate('popup_empty_no_memory_body_importing')
      : translate('popup_empty_no_memory_body'),
    showShortenRetry: false
  }
}

/** no_match 区文案。 */
export function getPopupNoMatchCopy(
  input: {
    library: PopupLibraryState
    clue: string
    canShorten: boolean
  },
  translate: TranslateFn
): PopupEmptyCopy {
  const clueLabel = input.clue.trim()

  if (input.library === 'empty') {
    return {
      title: translate('popup_empty_library_empty_title'),
      body: translate('popup_empty_library_empty_body'),
      showShortenRetry: false
    }
  }

  const truncated = clueLabel.length > 16 ? `${clueLabel.slice(0, 16)}…` : clueLabel

  return {
    title: clueLabel
      ? translate('popup_no_match_title_with_clue', truncated)
      : translate('popup_no_match_title'),
    body: translate('popup_no_match_body'),
    showShortenRetry: input.canShorten
  }
}
