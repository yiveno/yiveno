/**
 * §7.1 环境弱芯片（闭集模板）：仅在有真实环境信号时给出。
 * 与 LLM 芯片同屏时由上层隐藏本列表（不抢主）。
 * 禁止 site/quote/note/type 固定银行。
 */

/** 环境芯片规格（label 由 UI/application 经 t(labelKey) 解析）。 */
export type EnvironmentRecallSuggestionSpec = {
  id: string
  /** i18n message key */
  labelKey:
    'popup_env_chip_current_site' | 'popup_env_chip_just_saved' | 'popup_env_chip_just_opened'
  /** 点击填入 composer 的稳定英文 value */
  value: string
}

export type BuildEnvironmentRecallSuggestionsInput = {
  /** 当前浏览页域名（已规范化）；缺省则不挂「当前站」芯片 */
  currentTabDomain?: string
  /** 本轮线索（避免重复举已说的 host） */
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

function clueMentions(haystack: string | undefined, needle: string): boolean {
  if (!haystack?.trim()) {
    return false
  }
  return haystack.toLowerCase().includes(needle.toLowerCase())
}

/**
 * 按可用环境信号生成 0～N 个弱芯片规格。
 * 调用方：仅 `need_a_clue` 且无 LLM 芯片时挂载。
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

  const domain = input.currentTabDomain
    ?.trim()
    .toLowerCase()
    .replace(/^www\./, '')
  if (domain && !clueMentions(input.clueText, domain)) {
    out.push({
      id: 'env-current-site',
      labelKey: 'popup_env_chip_current_site',
      // value 用真实 host，便于下一轮关键词收窄（闭集环境信号的 grounded 形态）
      value: domain
    })
  }

  return out
}
