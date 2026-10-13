/**
 * DEV：真机 Recall 探针（2026-10-07）。
 *
 * 仅 import.meta.env.DEV；不打包进生产构建。
 * 用于排查「为什么某条书签没召回」「输入 X 召回到了什么」类问题。
 *
 * 用法（SW 控制台）：
 *   await yiveno.recallProbe({ clue: 'unit', entry: 'omnibox' })
 *   await yiveno.inspectMemory({ needle: 'yivenoProbe' })
 *   await yiveno.listMemoryIndexStatus()
 */

import { memoryItemService } from '@/application/memory/memory-item-service'
import { recallService } from '@/application/recall/recall-service'
import type { MemoryItem } from '@/core/memory/memory-item'

/** 从条目取出可展示的 title / url（书签 vs 摘录 payload 字段不同）。 */
function displayFields(item: MemoryItem): { title: string | null; url: string | null } {
  if (item.type === 'bookmark') {
    return {
      title: item.clues.title ?? item.payload.title,
      url: item.payload.url
    }
  }
  return {
    title: item.clues.title ?? item.payload.pageTitle,
    url: item.payload.sourceUrl
  }
}

/** 真机 Recall 探针：直接调 recallService，返回精简 RecallResult。 */
export async function recallProbe(input: {
  clue: string
  entry?: 'omnibox' | 'sidepanel'
}): Promise<unknown> {
  const { clue, entry = 'omnibox' } = input
  const result = await recallService.recallWithClue(clue, { entry })
  return {
    outcome: result.outcome,
    clue: result.clue,
    effectiveClue: result.effectiveClue,
    emptyKind: result.emptyKind ?? null,
    topPick: result.topPick
      ? {
          ...displayFields(result.topPick.item),
          score: result.topPick.score,
          matchedFields: result.topPick.matchedFields
        }
      : null,
    alsoPossible: result.alsoPossible.slice(0, 10).map(m => ({
      ...displayFields(m.item),
      score: m.score,
      matchedFields: m.matchedFields
    })),
    totalRankedCount: result.totalRankedCount
  }
}

/** 真机 Memory 探针：按 url 片段 / title 片段查可搜索字段全量。 */
export async function inspectMemoryByUrlOrTitle(input: { needle: string }): Promise<unknown> {
  const { needle } = input
  const needleLower = needle.toLowerCase()
  const all = await memoryItemService.list({ limit: 5000 })
  const matches = all.filter((m: MemoryItem) => {
    const { title, url } = displayFields(m)
    return (
      (url?.toLowerCase().includes(needleLower) ?? false) ||
      (title?.toLowerCase().includes(needleLower) ?? false) ||
      (m.clues?.title?.toLowerCase().includes(needleLower) ?? false)
    )
  })
  return {
    totalLibrary: all.length,
    needle,
    matched: matches.map((m: MemoryItem) => {
      const { title, url } = displayFields(m)
      return {
        id: m.id,
        type: m.type,
        cluesTitle: m.clues?.title ?? null,
        payloadTitle: title,
        url,
        domain: m.payload.domain ?? null,
        note: m.clues?.note ?? null,
        summary: m.clues?.summary ?? null,
        textExcerpt: m.clues?.textExcerpt
          ? m.clues.textExcerpt.slice(0, 80) + (m.clues.textExcerpt.length > 80 ? '…' : '')
          : null,
        keywords: m.clues?.keywords ?? [],
        tags: m.clues?.tags ?? [],
        updatedAt: m.updatedAt
      }
    })
  }
}

/** 倒排索引状态（owner × posting 数量）：验证是否同步。 */
export async function listMemoryIndexStatus(): Promise<unknown> {
  const all = await memoryItemService.list({ limit: 5000 })
  const byType: Record<string, number> = {}
  const byOwner: Record<string, number> = {}
  for (const m of all) {
    byType[m.type] = (byType[m.type] ?? 0) + 1
    const ownerId = m.ownerId
    byOwner[ownerId] = (byOwner[ownerId] ?? 0) + 1
  }
  return {
    totalItems: all.length,
    byType,
    byOwner: Object.fromEntries(Object.entries(byOwner).map(([k, v]) => [k.slice(0, 8) + '…', v]))
  }
}
