/**
 * DEV：探针噪声 / 多样性层指纹分类（保留精选语料 + 真实 Capture）。
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
