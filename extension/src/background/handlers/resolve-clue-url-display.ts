/**
 * RESOLVE_CLUE_URL_DISPLAY：为 composer URL 芯片解析展示标题。
 * 优先级：本机 Memory 标题 → 已打开 tab 标题 → none（UI 回退缩短 host/path）。
 * 不联网抓页；库标题 Map 按 owner 缓存在 SW 生命周期内。
 */

import { getCurrentOwnerId } from '@/infrastructure/identity/local-profile-service'
import { memoryItemRepository } from '@/infrastructure/indexeddb/memory-item-repository'
import { flowOk, flowStart } from '@/infrastructure/logging/flow-log'
import { logger } from '@/infrastructure/logging/logger'
import { clueUrlLookupKey } from '@/core/recall/clue-url-display'
import type { MemoryItem } from '@/core/memory/memory-item'
import {
  parseResolveClueUrlDisplayPayload,
  type ClueUrlDisplaySource,
  type ResolveClueUrlDisplayEntry,
  type ResolveClueUrlDisplayResponse
} from '@/core/messaging/recall-messages'

/** ownerId → URL lookupKey → title */
let libraryTitleCache: Map<string, string> | null = null
let libraryTitleCacheOwnerId: string | null = null

/** 测试用：清空 SW 级库标题缓存。 */
export function clearClueUrlDisplayLibraryCacheForTests(): void {
  libraryTitleCache = null
  libraryTitleCacheOwnerId = null
}

function titleFromMemoryItem(item: MemoryItem): string | null {
  if (item.type === 'bookmark') {
    const title = item.payload.title?.trim()
    return title || null
  }
  if (item.type === 'text_excerpt') {
    const pageTitle = item.payload.pageTitle?.trim()
    if (pageTitle) {
      return pageTitle
    }
    const excerpt = item.payload.selectedText?.trim()
    if (!excerpt) {
      return null
    }
    const firstLine = excerpt.split(/\n/)[0]?.trim() ?? ''
    return firstLine || null
  }
  return null
}

function urlFromMemoryItem(item: MemoryItem): string | null {
  if (item.type === 'bookmark') {
    return item.payload.url?.trim() || null
  }
  if (item.type === 'text_excerpt') {
    return item.payload.sourceUrl?.trim() || null
  }
  return null
}

async function ensureLibraryTitleCache(): Promise<Map<string, string>> {
  const ownerId = await getCurrentOwnerId()
  if (libraryTitleCache && libraryTitleCacheOwnerId === ownerId) {
    return libraryTitleCache
  }

  const items = await memoryItemRepository.listAllByOwnerId(ownerId, { includeDeleted: false })
  const map = new Map<string, string>()
  for (const item of items) {
    const url = urlFromMemoryItem(item)
    const title = titleFromMemoryItem(item)
    if (!url || !title) {
      continue
    }
    const key = clueUrlLookupKey(url)
    // 先写入的保留（list 无强序保证；同 key 多条时用已有即可）
    if (!map.has(key)) {
      map.set(key, title)
    }
  }
  libraryTitleCache = map
  libraryTitleCacheOwnerId = ownerId
  logger.info('Recall', 'URL 芯片库标题缓存已建', { ownerId, size: map.size })
  return map
}

async function titleFromOpenTabs(lookupKey: string): Promise<string | null> {
  try {
    const tabs = await chrome.tabs.query({})
    for (const tab of tabs) {
      const tabUrl = tab.url?.trim()
      const tabTitle = tab.title?.trim()
      if (!tabUrl || !tabTitle) {
        continue
      }
      if (!/^https?:\/\//i.test(tabUrl)) {
        continue
      }
      if (clueUrlLookupKey(tabUrl) === lookupKey) {
        return tabTitle
      }
    }
  } catch (error) {
    logger.warn('Recall', 'URL 芯片读 tabs 失败', { error })
  }
  return null
}

/**
 * 解析一批 URL 的展示标题（库优先，其次 tab）。
 */
export async function handleResolveClueUrlDisplay(
  payload: unknown
): Promise<ResolveClueUrlDisplayResponse> {
  const startedAt = flowStart('Recall', '解析 URL 芯片标题')
  try {
    const input = parseResolveClueUrlDisplayPayload(payload)
    const libraryMap = await ensureLibraryTitleCache()
    const entries: ResolveClueUrlDisplayEntry[] = []

    for (const url of input.urls) {
      const key = clueUrlLookupKey(url)
      const libraryTitle = libraryMap.get(key)?.trim() || null
      if (libraryTitle) {
        entries.push({ url, title: libraryTitle, source: 'library' satisfies ClueUrlDisplaySource })
        continue
      }
      const tabTitle = await titleFromOpenTabs(key)
      if (tabTitle) {
        entries.push({ url, title: tabTitle, source: 'tab' })
        continue
      }
      entries.push({ url, title: null, source: 'none' })
    }

    flowOk('Recall', '解析 URL 芯片标题', startedAt, {
      count: entries.length,
      libraryHits: entries.filter(e => e.source === 'library').length,
      tabHits: entries.filter(e => e.source === 'tab').length
    })
    return { ok: true, entries }
  } catch (error) {
    logger.error('Recall', 'RESOLVE_CLUE_URL_DISPLAY 失败', { error })
    return {
      ok: false,
      errorCode: 'RECALL_FAILED',
      ...(error instanceof Error ? { error: error.message } : {})
    }
  }
}
