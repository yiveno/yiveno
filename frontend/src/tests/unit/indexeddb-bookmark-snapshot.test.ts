import { beforeEach, describe, expect, it } from 'vitest'
import {
  DB_CONFIG,
  indexedDBManager,
  type BookmarkRecord
} from '@/infrastructure/indexeddb/manager'

async function deleteTestDatabase(): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_CONFIG.NAME)

    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error ?? new Error('删除测试 IndexedDB 失败'))
    request.onblocked = () => reject(new Error('删除测试 IndexedDB 被阻塞'))
  })
}

function createBookmarkRecord(overrides: Partial<BookmarkRecord>): BookmarkRecord {
  const id = overrides.id ?? 'bookmark-id'
  const title = overrides.title ?? id
  const isFolder = overrides.isFolder ?? false
  const url = overrides.url ?? (isFolder ? undefined : `https://${id}.example.com`)

  return {
    id,
    title,
    index: overrides.index ?? 0,
    parentId: overrides.parentId ?? '1',
    path: overrides.path ?? ['书签栏', title],
    pathString: overrides.pathString ?? `书签栏 / ${title}`,
    pathIds: overrides.pathIds ?? ['0', '1', id],
    ancestorIds: overrides.ancestorIds ?? ['0', '1'],
    depth: overrides.depth ?? 2,
    titleLower: overrides.titleLower ?? title.toLowerCase(),
    keywords: overrides.keywords ?? [title.toLowerCase()],
    isFolder,
    childrenCount: overrides.childrenCount ?? 0,
    tags: overrides.tags ?? [],
    traitTags: overrides.traitTags ?? [],
    ...(url
      ? {
          url,
          urlLower: url.toLowerCase(),
          domain: new URL(url).hostname
        }
      : {}),
    ...overrides
  }
}

describe('IndexedDBManager.replaceBookmarkSnapshot', () => {
  beforeEach(async () => {
    indexedDBManager.close()
    await deleteTestDatabase()
    await indexedDBManager.initialize()
  })

  it('应删除 Chrome 快照外的旧书签记录并保留本地扩展字段', async () => {
    await indexedDBManager.insertBookmarks([
      createBookmarkRecord({
        id: 'keep',
        title: '旧标题',
        isFavorite: true,
        favoriteOrder: 7,
        favoritedAt: 1_700_000_000_000,
        notes: '本地备注'
      }),
      createBookmarkRecord({
        id: 'stale-folder',
        title: '已被 Chrome 删除的目录',
        isFolder: true
      })
    ])

    const result = await indexedDBManager.replaceBookmarkSnapshot([
      createBookmarkRecord({
        id: 'keep',
        title: 'Chrome 标题',
        isFavorite: false
      })
    ])

    const records = await indexedDBManager.getAllBookmarks()
    const keep = records.find(record => record.id === 'keep')

    expect(result).toEqual({ upserted: 1, deleted: 1 })
    expect(records.map(record => record.id)).toEqual(['keep'])
    expect(keep?.title).toBe('Chrome 标题')
    expect(keep?.isFavorite).toBe(true)
    expect(keep?.favoriteOrder).toBe(7)
    expect(keep?.notes).toBe('本地备注')
  })
})
