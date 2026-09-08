/**
 * DEV：按选项批量清理探针 / Memory（写入测试数据的对偶）。
 * 仅 import.meta.env.DEV。
 */

import { RECALL_PROBE_PERSONA_ORDER, resolveProbeCorpora } from '@yiveno/probe'
import type { ProbeCleanupPayload } from '@/core/messaging/debug-messages'
import {
  isCuratedProbeItem,
  isProbeNoiseOrDiversityItem
} from '@/dev/probe/recall-probe-purge-classify'
import {
  listProbeSeedChromeFolderTitles,
  wipeAllChromeBookmarkChildren
} from '@/dev/probe/recall-probe-seed-service'
import type { MemoryItem } from '@/core/memory/memory-item'
import { getCurrentOwnerId } from '@/infrastructure/identity/local-profile-service'
import { keywordIndexRepository } from '@/infrastructure/indexeddb/keyword-index-repository'
import { memoryItemRepository } from '@/infrastructure/indexeddb/memory-item-repository'
import { flowFail, flowOk, flowStart } from '@/infrastructure/logging/flow-log'
import { logger } from '@/infrastructure/logging/logger'

/** 收集书签树下全部节点 id（含文件夹）。 */
async function collectBookmarkSubtreeIds(rootId: string): Promise<Set<string>> {
  const subtree = await chrome.bookmarks.getSubTree(rootId)
  const ids = new Set<string>()
  const walk = (nodes: chrome.bookmarks.BookmarkTreeNode[]): void => {
    for (const node of nodes) {
      ids.add(node.id)
      if (node.children?.length) {
        walk(node.children)
      }
    }
  }
  walk(subtree)
  return ids
}

/**
 * 查找书签栏下种库相关文件夹（真实主题夹 + 历史「Yiveno Probe」沙盒夹）。
 */
async function findProbeSeedFolderIds(): Promise<string[]> {
  const tree = await chrome.bookmarks.getTree()
  const bar = tree[0]?.children?.[0]
  if (!bar) {
    return []
  }
  const titles = new Set(listProbeSeedChromeFolderTitles())
  return (bar.children ?? [])
    .filter(node => !node.url && titles.has(node.title))
    .map(node => node.id)
}

/** 全部画像精选书签/摘录 URL（清理精选层用）。 */
export function buildCuratedProbeUrlSet(): Set<string> {
  const urls = new Set<string>()
  for (const corpus of resolveProbeCorpora([...RECALL_PROBE_PERSONA_ORDER])) {
    for (const bookmark of corpus.bookmarks) {
      urls.add(bookmark.url)
    }
    for (const excerpt of corpus.excerpts) {
      urls.add(excerpt.sourceUrl)
    }
  }
  return urls
}

function matchesTypeFilter(item: MemoryItem, types: ProbeCleanupPayload['types']): boolean {
  if (types === 'all') {
    return true
  }
  if (types === 'bookmark') {
    return item.type === 'bookmark'
  }
  return item.type === 'text_excerpt'
}

export type ProbeCleanupResult = {
  scannedCount: number
  purgedExcerptCount: number
  purgedBookmarkCount: number
  keptCount: number
  removedChromeProbeFolder: boolean
  removedChromeBookmarkNodes: number
  wipedChromeFolders: number
  clearedAllMemory: boolean
  indexRebuilt: boolean
}

/**
 * 按 payload 批量 soft-delete；可选移除种库主题文件夹或清空书签栏子树。
 */
export async function cleanupProbeLibrary(
  payload: ProbeCleanupPayload
): Promise<ProbeCleanupResult> {
  if (!import.meta.env.DEV) {
    throw new Error('cleanupProbeLibrary 仅允许 DEV 构建')
  }

  const startedAt = flowStart('DevProbe', '批量清理', {
    allMemory: payload.allMemory,
    noiseOrDiversity: payload.noiseOrDiversity,
    curatedProbe: payload.curatedProbe,
    types: payload.types
  })

  try {
    if (!payload.allMemory && !payload.noiseOrDiversity && !payload.curatedProbe) {
      throw new Error('须至少选择一类：半仿真与干扰、手写精选测试条目或整库')
    }

    const ownerId = await getCurrentOwnerId()
    const allItems = await memoryItemRepository.listAllByOwnerId(ownerId)
    const activeItems = allItems.filter(item => item.deletedAt == null)

    const seedFolderIds = await findProbeSeedFolderIds()
    const seedSubtreeIds = new Set<string>()
    for (const folderId of seedFolderIds) {
      const ids = await collectBookmarkSubtreeIds(folderId)
      for (const id of ids) {
        seedSubtreeIds.add(id)
      }
    }
    const curatedUrls = buildCuratedProbeUrlSet()

    const toPurge = activeItems.filter(item => {
      if (!matchesTypeFilter(item, payload.types)) {
        return false
      }
      if (payload.allMemory) {
        return true
      }
      if (payload.noiseOrDiversity && isProbeNoiseOrDiversityItem(item)) {
        return true
      }
      if (
        payload.curatedProbe &&
        isCuratedProbeItem(item, {
          curatedUrls,
          probeChromeIds: seedSubtreeIds
        })
      ) {
        return true
      }
      return false
    })

    const purgeIds = new Set(toPurge.map(item => item.id))
    const toKeep = activeItems.filter(item => !purgeIds.has(item.id))

    // 删文件夹前：保留的书签若仍挂在种库主题夹内，先断链，避免 sync 软删
    let detached = 0
    if (
      seedFolderIds.length > 0 &&
      (payload.removeProbeFolder || payload.wipeChromeBookmarkChildren)
    ) {
      for (const item of toKeep) {
        if (item.type !== 'bookmark') {
          continue
        }
        const chromeBookmarkId = item.payload.chromeBookmarkId?.trim()
        if (!chromeBookmarkId || !seedSubtreeIds.has(chromeBookmarkId)) {
          continue
        }
        const updated = await memoryItemRepository.detachChromeBookmarkLink(item.id)
        if (updated) {
          detached += 1
        }
      }
    }

    let purgedExcerptCount = 0
    let purgedBookmarkCount = 0
    for (const item of toPurge) {
      const deleted = await memoryItemRepository.softDelete(item.id)
      if (!deleted) {
        continue
      }
      if (deleted.type === 'text_excerpt') {
        purgedExcerptCount += 1
      } else {
        purgedBookmarkCount += 1
      }
    }

    let removedChromeProbeFolder = false
    let removedChromeBookmarkNodes = 0
    let wipedChromeFolders = 0

    if (payload.wipeChromeBookmarkChildren) {
      wipedChromeFolders = await wipeAllChromeBookmarkChildren()
      logger.info('DevProbe', '已清空 Chrome 书签栏子树', { wipedChromeFolders })
    } else if (payload.removeProbeFolder && seedFolderIds.length > 0) {
      removedChromeBookmarkNodes = seedSubtreeIds.size
      for (const folderId of seedFolderIds) {
        await chrome.bookmarks.removeTree(folderId)
      }
      removedChromeProbeFolder = true
      logger.info('DevProbe', '已移除种库主题文件夹（含历史 Yiveno Probe）', {
        folderCount: seedFolderIds.length,
        removedChromeBookmarkNodes,
        detached
      })
    }

    const indexReady = await keywordIndexRepository.ensureReadyForOwner(ownerId)

    const result: ProbeCleanupResult = {
      scannedCount: activeItems.length,
      purgedExcerptCount,
      purgedBookmarkCount,
      keptCount: toKeep.length,
      removedChromeProbeFolder,
      removedChromeBookmarkNodes,
      wipedChromeFolders,
      clearedAllMemory: payload.allMemory,
      indexRebuilt: indexReady.rebuilt
    }

    flowOk('DevProbe', '批量清理', startedAt, result)
    return result
  } catch (error) {
    flowFail('DevProbe', '批量清理', startedAt, error)
    throw error
  }
}
