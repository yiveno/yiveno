/**
 * DEV：探针半仿真 / 无关干扰 / 手写精选层指纹分类（按 URL/正文形态分层，供清理用）。
 * 仅 seeder 形态；禁止进召回 runtime。
 */

import type { MemoryItem } from '@/core/memory/memory-item'

/** 噪声 / 多样性 URL 指纹（精选语料 `yiveno-probe-*` 路径段除外）。 */
export function isProbeNoiseOrDiversityUrl(url: string): boolean {
  if (/yiveno-div|yivenoDiv/i.test(url)) {
    return true
  }
  if (/yiveno-probe/i.test(url)) {
    return false
  }
  if (/\/probe(?:\/|$)/i.test(url)) {
    return true
  }
  // 混淆组成员 URL：…/cluster/clu-bm-… 或 …/cluster-excerpt/…
  if (/\/cluster(?:-excerpt)?\//i.test(url)) {
    return true
  }
  return false
}

/** 是否应清除（噪声层 + 多样性层）；精选探针与真实 Capture 返回 false。 */
export function isProbeNoiseOrDiversityItem(item: MemoryItem): boolean {
  if (item.type === 'text_excerpt') {
    const { sourceUrl, selectedText } = item.payload
    const note = item.clues.note ?? ''

    if (isProbeNoiseOrDiversityUrl(sourceUrl)) {
      return true
    }
    if (/filler excerpt/i.test(selectedText)) {
      return true
    }
    if (/\s\(div \d+\)\.?$/.test(selectedText)) {
      return true
    }
    if (/filler annotation/i.test(note)) {
      return true
    }
    if (/ excerpt \d+$/i.test(note)) {
      return true
    }
    return false
  }

  if (item.type === 'bookmark') {
    const { url, title } = item.payload
    const note = item.clues.note ?? ''

    if (isProbeNoiseOrDiversityUrl(url)) {
      return true
    }
    if (/^noise note \d+$/i.test(note)) {
      return true
    }
    if (/cut CI minutes with this \(#\d+\)/.test(note)) {
      return true
    }
    if (/filler annotation/i.test(note)) {
      return true
    }
    if (/ \(#\d+\)$/.test(note)) {
      return true
    }
    if (/ \(#\d+\)$/.test(title) && /\/probe(?:\/|$)/i.test(url)) {
      return true
    }
    if (/ topic \d+$/i.test(title) && /yiveno-div|yivenoDiv/i.test(url)) {
      return true
    }
    return false
  }

  return false
}

function itemPrimaryUrl(item: MemoryItem): string {
  return item.type === 'bookmark' ? item.payload.url : item.payload.sourceUrl
}

/**
 * 精选探针（非噪声层）：语料 URL 表 / yiveno-probe 指纹 /
 * 或仍挂在种库主题文件夹 / 历史「Yiveno Probe」夹内的 Chrome 节点。
 * 不含半仿真/无关干扰（那些走 isProbeNoiseOrDiversityItem）。
 */
export function isCuratedProbeItem(
  item: MemoryItem,
  options: {
    curatedUrls: ReadonlySet<string>
    probeChromeIds: ReadonlySet<string>
  }
): boolean {
  if (isProbeNoiseOrDiversityItem(item)) {
    return false
  }
  const url = itemPrimaryUrl(item)
  if (/yiveno-probe/i.test(url)) {
    return true
  }
  if (options.curatedUrls.has(url)) {
    return true
  }
  if (item.type === 'bookmark') {
    const chromeId = item.payload.chromeBookmarkId?.trim()
    if (chromeId && options.probeChromeIds.has(chromeId)) {
      return true
    }
  }
  return false
}
