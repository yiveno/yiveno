/**
 * Recall 壳空状态 / 恢复文案选择（纯函数；文案经注入的 translate）。
 * i18n key 仍用 `popup_*` 前缀（遗留）；现行消费方为 Side Panel。
 *
 * 可见截断（宽度 / 省略号）交给 UI CSS；此处只归一空白与病态安全上限。
 */
import type { TranslateFn } from '@/core/i18n/translate'

/** 空态标题插值病态安全上限（非布局宽度）。 */
const NO_MATCH_CLUE_SAFETY_MAX = 200

/** Recall 壳侧记忆库是否已有可检内容。 */
export type RecallShellLibraryState =
  | 'unknown' // 尚未判定
  | 'empty' // 空库
  | 'ready' // 有条目可找回

export interface RecallShellEmptyCopy {
  title: string
  body: string
}

/** 归一空白；超安全上限才尾省略。 */
function normalizeClueForCopy(clue: string): string {
  const trimmed = clue.trim().replace(/\s+/g, ' ')
  if (trimmed.length <= NO_MATCH_CLUE_SAFETY_MAX) {
    return trimmed
  }
  return `${trimmed.slice(0, NO_MATCH_CLUE_SAFETY_MAX - 1).trimEnd()}…`
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
  const clueLabel = normalizeClueForCopy(input.clue)

  if (input.library === 'empty') {
    return {
      title: translate('popup_empty_library_empty_title'),
      body: translate('popup_empty_library_empty_body')
    }
  }

  return {
    title: clueLabel
      ? translate('popup_no_match_title_with_clue', clueLabel)
      : translate('popup_no_match_title'),
    body: translate('popup_no_match_body')
  }
}
