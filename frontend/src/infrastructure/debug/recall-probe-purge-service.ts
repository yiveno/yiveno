/**
 * DEV：清除探针噪声 / 多样性层；保留精选语料；移除 Chrome「Yiveno Probe」文件夹。
 * 仅 import.meta.env.DEV。
 */

import { isProbeNoiseOrDiversityItem } from '@/infrastructure/debug/recall-probe-purge-classify'
import { RECALL_PROBE_BOOKMARK_FOLDER_TITLE } from '@/infrastructure/debug/recall-probe-seed-service'
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

/** 查找书签栏下「Yiveno Probe」文件夹 id。 */
async function findProbeFolderId(): Promise<string | null> {
  const tree = await chrome.bookmarks.getTree()
  const bar = tree[0]?.children?.[0]
  if (!bar) {
    return null
  }
  const folder = (bar.children ?? []).find(
    node => node.title === RECALL_PROBE_BOOKMARK_FOLDER_TITLE && !node.url
  )
  return folder?.id ?? null
}

/** 断开精选书签与 Chrome 的链接，避免删文件夹时 sync 软删 Memory。 */
async function detachCuratedBookmarksInProbeFolder(
  items: MemoryItem[],
  probeSubtreeIds: Set<string>
): Promise<number> {
  let detached = 0
  for (const item of items) {
    if (item.type !== 'bookmark' || isProbeNoiseOrDiversityItem(item)) {
      continue
    }
    const chromeBookmarkId = item.payload.chromeBookmarkId?.trim()
    if (!chromeBookmarkId || !probeSubtreeIds.has(chromeBookmarkId)) {
      continue
    }
    const updated = await memoryItemRepository.detachChromeBookmarkLink(item.id)
    if (updated) {
      detached += 1
    }
  }
  return detached
}

export type PurgeProbeNoiseResult = {
  scannedCount: number
  purgedExcerptCount: number
  purgedBookmarkCount: number
  detachedCuratedBookmarkCount: number
  removedChromeProbeFolder: boolean
  removedChromeBookmarkNodes: number
  keptCount: number
  indexRebuilt: boolean
}

/**
 * 清除噪声 / 多样性 Memory；保留精选探针；移除 Chrome「Yiveno Probe」文件夹。
 */
export async function purgeProbeNoiseFromLibrary(): Promise<PurgeProbeNoiseResult> {
  if (!import.meta.env.DEV) {
    throw new Error('purgeProbeNoiseFromLibrary 仅允许 DEV 构建')
  }

  const startedAt = flowStart('DevProbe', '清除探针噪声层', {})

  try {
    const ownerId = await getCurrentOwnerId()
    const allItems = await memoryItemRepository.listAllByOwnerId(ownerId)
    const activeItems = allItems.filter(item => item.deletedAt == null)
    const toPurge = activeItems.filter(isProbeNoiseOrDiversityItem)
    const toKeep = activeItems.filter(item => !isProbeNoiseOrDiversityItem(item))

    const probeFolderId = await findProbeFolderId()
    const probeSubtreeIds = probeFolderId
      ? await collectBookmarkSubtreeIds(probeFolderId)
      : new Set<string>()

    const detachedCuratedBookmarkCount = probeFolderId
      ? await detachCuratedBookmarksInProbeFolder(toKeep, probeSubtreeIds)
      : 0

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
    if (probeFolderId) {
      removedChromeBookmarkNodes = probeSubtreeIds.size
      await chrome.bookmarks.removeTree(probeFolderId)
      removedChromeProbeFolder = true
      logger.info('DevProbe', '已移除 Chrome Yiveno Probe 文件夹', {
        removedChromeBookmarkNodes
      })
    }

    const indexReady = await keywordIndexRepository.ensureReadyForOwner(ownerId)

    const result: PurgeProbeNoiseResult = {
      scannedCount: activeItems.length,
      purgedExcerptCount,
      purgedBookmarkCount,
      detachedCuratedBookmarkCount,
      removedChromeProbeFolder,
      removedChromeBookmarkNodes,
      keptCount: toKeep.length,
      indexRebuilt: indexReady.rebuilt
    }

    flowOk('DevProbe', '清除探针噪声层', startedAt, result)
    return result
  } catch (error) {
    flowFail('DevProbe', '清除探针噪声层', startedAt, error)
    throw error
  }
}
