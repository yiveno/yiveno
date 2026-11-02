/**
 * 异步给 URL 芯片补标题（本机库 / 打开中 tab）；失败静默保留缩短 host/path。
 */

import { resolveClueUrlChipLabel } from '@/core/recall/clue-url-display'
import { resolveClueUrlDisplay } from '@/infrastructure/messaging/background-client'
import { logger } from '@/infrastructure/logging/logger'
import { CLUE_URL_CHIP_ATTR } from '@/pages/sidepanel/composer/clue-editor-dom'

/** 会话级 URL → 标题缓存（避免同面板反复打 SW）。 */
const titleCache = new Map<string, string>()

/**
 * 解析一批 URL 的展示标题；命中写入会话缓存。
 * @returns href → title（仅有标题的条目）
 */
export async function fetchClueUrlDisplayTitles(
  hrefs: string[]
): Promise<ReadonlyMap<string, string>> {
  const unique = [...new Set(hrefs.map(h => h.trim()).filter(Boolean))]
  if (unique.length === 0) {
    return new Map()
  }

  const missing = unique.filter(href => !titleCache.has(href))
  if (missing.length > 0) {
    try {
      // 单次消息最多 8 条
      for (let i = 0; i < missing.length; i += 8) {
        const batch = missing.slice(i, i + 8)
        const response = await resolveClueUrlDisplay({ urls: batch })
        if (!response.ok) {
          logger.warn('Recall', 'URL 芯片标题解析失败', { errorCode: response.errorCode })
          continue
        }
        for (const entry of response.entries) {
          if (entry.title?.trim()) {
            titleCache.set(entry.url, entry.title.trim())
          }
        }
      }
    } catch (error) {
      logger.warn('Recall', 'URL 芯片标题解析异常', { error })
    }
  }

  const out = new Map<string, string>()
  for (const href of unique) {
    const title = titleCache.get(href)
    if (title) {
      out.set(href, title)
    }
  }
  return out
}

/**
 * 扫描 contenteditable 内芯片，异步把 label 换成库/tab 标题。
 */
export async function enrichClueUrlChipsInEditor(root: HTMLElement): Promise<void> {
  const chips = Array.from(root.querySelectorAll<HTMLElement>(`[${CLUE_URL_CHIP_ATTR}]`))
  if (chips.length === 0) {
    return
  }
  const hrefs = chips
    .map(chip => chip.getAttribute(CLUE_URL_CHIP_ATTR)?.trim() ?? '')
    .filter(Boolean)
  const titles = await fetchClueUrlDisplayTitles(hrefs)
  if (titles.size === 0) {
    return
  }
  for (const chip of chips) {
    const href = chip.getAttribute(CLUE_URL_CHIP_ATTR)?.trim()
    if (!href) {
      continue
    }
    const title = titles.get(href)
    if (!title) {
      continue
    }
    const label = chip.querySelector(`.clue-url-chip__label`)
    if (label) {
      label.textContent = resolveClueUrlChipLabel(href, title)
    }
    // 悬停 / aria 始终完整 URL（文案才用库内/tab 标题）
    chip.title = href
    chip.setAttribute('aria-label', href)
  }
}
