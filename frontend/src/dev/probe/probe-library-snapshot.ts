/**
 * DEV：当前库快照（探针噪声分类 + 类型计数）。
 * 仅 import.meta.env.DEV；供 Probe Console 盘点。
 */

import type { MemoryItem } from '@/core/memory/memory-item'
import { resolveMemoryItemSavedAtIso } from '@/core/memory/memory-item-saved-at'
import { isProbeNoiseOrDiversityItem } from '@/dev/probe/recall-probe-purge-classify'
import { getCurrentOwnerId } from '@/infrastructure/identity/local-profile-service'
import { memoryItemRepository } from '@/infrastructure/indexeddb/memory-item-repository'
import { flowFail, flowOk, flowStart } from '@/infrastructure/logging/flow-log'

const SNAPSHOT_SCAN_LIMIT = 20000

export type ProbeLibraryLayer = 'probe_noise_or_diversity' | 'other'

export type ProbeLibrarySnapshotItem = {
  id: string
  type: MemoryItem['type']
  title: string
  url: string
  notePreview: string | null
  savedAtIso: string
  layer: ProbeLibraryLayer
}

export type ProbeLibrarySnapshot = {
  scannedCount: number
  truncated: boolean
  byType: { bookmark: number; text_excerpt: number; other: number }
  byLayer: { probe_noise_or_diversity: number; other: number }
  /** 最近更新的 non-noise 样本（便于对拍填 id） */
  recentOther: ProbeLibrarySnapshotItem[]
}

function titleOf(item: MemoryItem): string {
  if (item.type === 'bookmark') {
    return item.payload.title
  }
  return item.payload.pageTitle || item.payload.selectedText.slice(0, 80)
}

function urlOf(item: MemoryItem): string {
  if (item.type === 'bookmark') {
    return item.payload.url
  }
  return item.payload.sourceUrl
}

function toSnapshotItem(item: MemoryItem, layer: ProbeLibraryLayer): ProbeLibrarySnapshotItem {
  const note = item.clues.note?.trim()
  return {
    id: item.id,
    type: item.type,
    title: titleOf(item),
    url: urlOf(item),
    notePreview: note ? note.slice(0, 120) : null,
    savedAtIso: resolveMemoryItemSavedAtIso(item),
    layer
  }
}

/** 扫描当前 owner 库，分类噪声层与其余（含真实 Capture + 精选探针）。 */
export async function buildProbeLibrarySnapshot(): Promise<ProbeLibrarySnapshot> {
  if (!import.meta.env.DEV) {
    throw new Error('buildProbeLibrarySnapshot 仅允许 DEV 构建')
  }

  const startedAt = flowStart('DevProbe', '库盘点快照')
  try {
    await getCurrentOwnerId()
    const items = await memoryItemRepository.listByOwner({ limit: SNAPSHOT_SCAN_LIMIT })
    const truncated = items.length >= SNAPSHOT_SCAN_LIMIT

    const byType = { bookmark: 0, text_excerpt: 0, other: 0 }
    const byLayer = { probe_noise_or_diversity: 0, other: 0 }
    const recentOther: ProbeLibrarySnapshotItem[] = []

    for (const item of items) {
      if (item.type === 'bookmark') {
        byType.bookmark += 1
      } else {
        byType.text_excerpt += 1
      }

      const isNoise = isProbeNoiseOrDiversityItem(item)
      if (isNoise) {
        byLayer.probe_noise_or_diversity += 1
      } else {
        byLayer.other += 1
        if (recentOther.length < 40) {
          recentOther.push(toSnapshotItem(item, 'other'))
        }
      }
    }

    const snapshot: ProbeLibrarySnapshot = {
      scannedCount: items.length,
      truncated,
      byType,
      byLayer,
      recentOther
    }
    flowOk('DevProbe', '库盘点快照', startedAt, {
      scanned: snapshot.scannedCount,
      noise: byLayer.probe_noise_or_diversity,
      other: byLayer.other
    })
    return snapshot
  } catch (error) {
    flowFail('DevProbe', '库盘点快照', startedAt, error)
    throw error
  }
}
