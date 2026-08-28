/**
 * Recall 壳空状态 / 恢复文案选择（纯函数；文案经注入的 translate）。
 * i18n key 仍用 `popup_*` 前缀（遗留）；现行消费方为 Side Panel。
 */
import type { TranslateFn } from '@/core/i18n/translate'

/** Recall 壳侧记忆库是否已有可检内容。 */
export type RecallShellLibraryState =
  | 'unknown' // 尚未判定
  | 'empty' // 空库
  | 'ready' // 有条目可找回

export interface RecallShellEmptyCopy {
  title: string
  body: string
}

/** idle 区引导（有库时不展示额外空态块，除非仍在安装引导 Capture-first 阶段）。 */
export function getRecallShellIdleEmptyCopy(
  library: RecallShellLibraryState,
  importing: boolean,
  translate: TranslateFn,
  options: { captureFirst?: boolean } = {}
): RecallShellEmptyCopy | null {
  if (options.captureFirst) {
    return {
      title: translate('popup_capture_first_title'),
      body: importing
        ? translate('popup_capture_first_body_importing')
        : translate('popup_capture_first_body')
    }
  }

  if (library !== 'empty') {
    return null
  }

  return {
    title: translate('popup_empty_no_memory_title'),
    body: importing
      ? translate('popup_empty_no_memory_body_importing')
      : translate('popup_empty_no_memory_body')
  }
}

/**
 * no_match 区文案。
 * 诚实终局：不附带「缩短再试」等暗示「换查询或许还有」的补救 CTA。
 */
export function getRecallShellNoMatchCopy(
  input: {
    library: RecallShellLibraryState
    clue: string
  },
  translate: TranslateFn
): RecallShellEmptyCopy {
  const clueLabel = input.clue.trim()

  if (input.library === 'empty') {
    return {
      title: translate('popup_empty_library_empty_title'),
      body: translate('popup_empty_library_empty_body')
    }
  }

  const truncated = clueLabel.length > 16 ? `${clueLabel.slice(0, 16)}…` : clueLabel

  return {
    title: clueLabel
      ? translate('popup_no_match_title_with_clue', truncated)
      : translate('popup_no_match_title'),
    body: translate('popup_no_match_body')
  }
}
