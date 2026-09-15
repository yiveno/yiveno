/**
 * Idle 口语范式样句（§7.0）：推荐句式捷径，不强制、不替代任意口语路径。
 * 纯函数：返回 i18n message key；文案经 UI `t()` 注入。
 */

/** Idle 范式样句稳定 id（闭集 · 产品句式槽，非内容灰名单）。 */
export type IdleClueParadigmId =
  | 'content_and_time' // 内容印象 + 相对时间
  | 'note_anchor' // 附注印象
  | 'saved_when' // 刚存 / 日历时间 + 弱内容

/** 单条范式：展示与填入共用同一 en 文案 key（完整口语句）。 */
export interface IdleClueParadigmSpec {
  id: IdleClueParadigmId
  /** `_locales/en` message key → 填入 composer 的完整 clue */
  clueMessageKey: string
}

/**
 * Idle 展示条件（与 Side Panel 对齐，便于单测）。
 * Capture-first / 空库 / 未知库态不展示找东西样句。
 */
export function shouldShowIdleClueParadigms(input: {
  hasConversationTurns: boolean
  captureFirst: boolean
  library: 'unknown' | 'empty' | 'ready'
}): boolean {
  if (input.hasConversationTurns) {
    return false
  }
  if (input.captureFirst) {
    return false
  }
  return input.library === 'ready'
}

/** 固定 3 条句式样板（顺序即展示序）。 */
export function listIdleClueParadigmSpecs(): readonly IdleClueParadigmSpec[] {
  return [
    {
      id: 'content_and_time',
      clueMessageKey: 'popup_idle_paradigm_content_time'
    },
    {
      id: 'note_anchor',
      clueMessageKey: 'popup_idle_paradigm_note'
    },
    {
      id: 'saved_when',
      clueMessageKey: 'popup_idle_paradigm_saved_when'
    }
  ] as const
}
