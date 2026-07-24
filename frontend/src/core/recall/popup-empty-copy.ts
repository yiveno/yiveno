/**
 * Popup 空状态 / 恢复文案选择（纯函数）。
 */

export type PopupLibraryState = 'unknown' | 'empty' | 'ready'

export interface PopupEmptyCopy {
  title: string
  body: string
  showShortenRetry: boolean
}

/** idle 区引导（有库时不展示额外空态块）。 */
export function getPopupIdleEmptyCopy(
  library: PopupLibraryState,
  importing: boolean
): PopupEmptyCopy | null {
  if (library !== 'empty') {
    return null
  }

  return {
    title: '还没有可找回的记忆',
    body: importing
      ? '正在导入书签，完成后即可用标题或域名片段找回。也可先划词保存一段文字。'
      : '用 Chrome 加书签并等待同步，或在网页划词后点「保存到 Yiveno」。',
    showShortenRetry: false
  }
}

/** no_match 区文案。 */
export function getPopupNoMatchCopy(input: {
  library: PopupLibraryState
  clue: string
  canShorten: boolean
}): PopupEmptyCopy {
  const clueLabel = input.clue.trim()

  if (input.library === 'empty') {
    return {
      title: '记忆库还是空的',
      body: '先存一点再找回：Chrome 加书签等待同步，或划词保存选区。换词暂时帮不上忙。',
      showShortenRetry: false
    }
  }

  return {
    title: clueLabel
      ? `没找到和「${clueLabel.slice(0, 16)}${clueLabel.length > 16 ? '…' : ''}」相关的`
      : '还没找到匹配的',
    body: '试试更短的词，或用域名、标题里还记得的片段。也可划词保存后再找回。',
    showShortenRetry: input.canShorten
  }
}
