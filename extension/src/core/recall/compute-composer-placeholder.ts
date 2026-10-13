/**
 * Composer placeholder 双通道状态机（§7.0）。
 * 有线程锚点时 Narrow/Neutral 点名锚点，避免听起来像开一场全新 Recall（新 clue 框）。
 */

/** Placeholder 模式：空闲 / 收窄邀请 / 中性让位。 */
export type ComposerPlaceholderMode =
  | 'idle' // 空闲或新会话
  | 'narrow' // 宽邻域软收窄
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
   * grounded 举例词（已校验出现在候选中）。
   * 空 → narrow 用无举例模板。
   */
  narrowExamples?: string[]
  /** 活动线程锚点标签；有则 Narrow/Neutral 走点名文案 */
  threadLabel?: string | null
}

export type ComputeComposerPlaceholderResult = {
  mode: ComposerPlaceholderMode
  /** i18n message key（不含举例插值时由 UI 直接 t(key)） */
  messageKey: string
  /** 传给 t() 的占位参数 */
  messageArgs: string[]
}

function withThreadLabel(
  mode: ComposerPlaceholderMode,
  threadLabel: string | null | undefined,
  baseKey: string,
  threadedKey: string,
  restArgs: string[]
): ComputeComposerPlaceholderResult {
  const label = threadLabel?.trim()
  if (label) {
    return {
      mode,
      messageKey: threadedKey,
      messageArgs: [label, ...restArgs]
    }
  }
  return {
    mode,
    messageKey: baseKey,
    messageArgs: restArgs
  }
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

  const threadLabel = input.threadLabel?.trim() || null

  if (input.chipsPresent) {
    return withThreadLabel(
      'neutral',
      threadLabel,
      'popup_clue_placeholder_neutral',
      'popup_clue_placeholder_neutral_threaded',
      []
    )
  }

  if (input.assistantTone === 'miss' || input.assistantTone === 'error') {
    return withThreadLabel(
      'neutral',
      threadLabel,
      'popup_clue_placeholder_neutral',
      'popup_clue_placeholder_neutral_threaded',
      []
    )
  }

  const canNarrow =
    (input.assistantTone === 'confident' || input.assistantTone === 'uncertain') &&
    input.rankedTotalCount >= COMPOSER_PLACEHOLDER_NARROW_MIN_RANKED

  if (canNarrow) {
    const examples = (input.narrowExamples ?? []).map(s => s.trim()).filter(Boolean)
    if (examples.length >= 2) {
      return withThreadLabel(
        'narrow',
        threadLabel,
        'popup_clue_placeholder_narrow',
        'popup_clue_placeholder_narrow_threaded',
        [examples[0]!, examples[1]!]
      )
    }
    if (examples.length === 1) {
      return withThreadLabel(
        'narrow',
        threadLabel,
        'popup_clue_placeholder_narrow_one',
        'popup_clue_placeholder_narrow_one_threaded',
        [examples[0]!]
      )
    }
    return withThreadLabel(
      'narrow',
      threadLabel,
      'popup_clue_placeholder_narrow_generic',
      'popup_clue_placeholder_narrow_generic_threaded',
      []
    )
  }

  return withThreadLabel(
    'neutral',
    threadLabel,
    'popup_clue_placeholder_neutral',
    'popup_clue_placeholder_neutral_threaded',
    []
  )
}
