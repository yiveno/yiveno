/**
 * Composer placeholder 双通道状态机（§7.0 · P0a 骨架）。
 * Narrow 带 grounded 举例在 P0b；本文件先定模式与让位规则。
 */

/** Placeholder 模式：空闲 / 收窄邀请 / 中性让位。 */
export type ComposerPlaceholderMode =
  | 'idle' // 空闲或新会话
  | 'narrow' // 宽邻域软收窄（P0a 尚无举例词）
  | 'neutral' // 有芯片让位、miss、dismiss、抽不出举例

/** 宽邻域收窄型 placeholder 的互异组数下限（与方案稿一致，可调）。 */
export const COMPOSER_PLACEHOLDER_NARROW_MIN_RANKED = 6

export type ComputeComposerPlaceholderInput = {
  /** 是否仍无助手结果轮（或已 New find） */
  isIdle: boolean
  /** 最新助手轮 outcome 语气 */
  assistantTone?: 'confident' | 'uncertain' | 'miss' | 'error'
  /** 相关互异组总数；未知则 0 */
  rankedTotalCount: number
  /** 当前 turn 是否展示白名单追问芯片 */
  chipsPresent: boolean
  /**
   * P0b：grounded 举例词（已校验出现在候选中）。
   * P0a 传空 → narrow 用无举例模板。
   */
  narrowExamples?: string[]
}

export type ComputeComposerPlaceholderResult = {
  mode: ComposerPlaceholderMode
  /** i18n message key（不含举例插值时由 UI 直接 t(key)） */
  messageKey: string
  /** 传给 t() 的占位参数（P0b 举例） */
  messageArgs: string[]
}

/**
 * 按双通道优先级选择 placeholder 模式与文案 key。
 * 有芯片 → 强制 neutral；miss → neutral；宽邻域且无芯片 → narrow。
 */
export function computeComposerPlaceholder(
  input: ComputeComposerPlaceholderInput
): ComputeComposerPlaceholderResult {
  if (input.isIdle) {
    return { mode: 'idle', messageKey: 'popup_clue_placeholder', messageArgs: [] }
  }

  if (input.chipsPresent) {
    return {
      mode: 'neutral',
      messageKey: 'popup_clue_placeholder_neutral',
      messageArgs: []
    }
  }

  if (input.assistantTone === 'miss' || input.assistantTone === 'error') {
    return {
      mode: 'neutral',
      messageKey: 'popup_clue_placeholder_neutral',
      messageArgs: []
    }
  }

  const canNarrow =
    (input.assistantTone === 'confident' || input.assistantTone === 'uncertain') &&
    input.rankedTotalCount >= COMPOSER_PLACEHOLDER_NARROW_MIN_RANKED

  if (canNarrow) {
    const examples = (input.narrowExamples ?? []).map(s => s.trim()).filter(Boolean)
    if (examples.length >= 2) {
      return {
        mode: 'narrow',
        messageKey: 'popup_clue_placeholder_narrow',
        messageArgs: [examples[0]!, examples[1]!]
      }
    }
    if (examples.length === 1) {
      return {
        mode: 'narrow',
        messageKey: 'popup_clue_placeholder_narrow_one',
        messageArgs: [examples[0]!]
      }
    }
    // P0a：尚无抽取器 → 无举例收窄邀请；P0b 有举例走插值 key
    return {
      mode: 'narrow',
      messageKey: 'popup_clue_placeholder_narrow_generic',
      messageArgs: []
    }
  }

  return {
    mode: 'neutral',
    messageKey: 'popup_clue_placeholder_neutral',
    messageArgs: []
  }
}
