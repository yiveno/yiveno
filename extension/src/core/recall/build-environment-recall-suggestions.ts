/**
 * §7.1 环境弱芯片（闭集模板）：仅在有真实环境信号时给出。
 * 与 LLM 芯片同屏时由上层隐藏本列表（不抢主）。
 * 禁止 site/quote/note/type 固定银行。
 * 「当前站」已迁 composer 页上下文开关（boost/restrict）；不再以追问芯片把 host 塞进 clue。
 */

/** 环境芯片规格（label 由 UI/application 经 t(labelKey) 解析）。 */
export type EnvironmentRecallSuggestionSpec = {
  id: string
  /** i18n message key */
  labelKey: 'popup_env_chip_just_saved' | 'popup_env_chip_just_opened'
  /** 点击填入 composer 的稳定英文 value */
  value: string
}

export type BuildEnvironmentRecallSuggestionsInput = {
  /** 本轮线索（预留；刚存/刚打开芯片暂不读） */
  clueText?: string
  /**
   * 是否有「刚存」弱信号（近因 Capture / 近因书签）。
   * 无信号不得挂 just saved 芯片。
   */
  hasRecentlySavedSignal?: boolean
  /**
   * 是否有「刚打开」弱信号。
   * 无信号不得挂 opened recently 芯片。
   */
  hasRecentlyOpenedSignal?: boolean
}

/**
 * 按可用环境信号生成 0～N 个弱芯片规格。
 * 调用方：仅 `need_a_clue` / 窄 top_pick 且无 LLM 芯片时挂载。
 */
export function buildEnvironmentRecallSuggestions(
  input: BuildEnvironmentRecallSuggestionsInput
): EnvironmentRecallSuggestionSpec[] {
  const out: EnvironmentRecallSuggestionSpec[] = []

  if (input.hasRecentlySavedSignal) {
    out.push({
      id: 'env-just-saved',
      labelKey: 'popup_env_chip_just_saved',
      value: 'just saved'
    })
  }

  if (input.hasRecentlyOpenedSignal) {
    out.push({
      id: 'env-just-opened',
      labelKey: 'popup_env_chip_just_opened',
      value: 'opened recently'
    })
  }

  return out
}
