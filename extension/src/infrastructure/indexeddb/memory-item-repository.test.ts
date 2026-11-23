import 'fake-indexeddb/auto'

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { LOCAL_PROFILE_STORAGE_KEY, type LocalProfile } from '@/core/identity/local-profile'
import { resetMemoryDatabaseInitializationForTests } from '@/infrastructure/indexeddb/memory-db'
import { memoryItemRepository } from '@/infrastructure/indexeddb/memory-item-repository'

type StorageMap = Record<string, unknown>

function createChromeStorageMock(initial: StorageMap = {}) {
  const store: StorageMap = { ...initial }

  const local = {
    get: vi.fn(async (keys: string | string[] | Record<string, unknown>) => {
      if (typeof keys === 'string') {
        return { [keys]: store[keys] }
      }
      if (Array.isArray(keys)) {
        return Object.fromEntries(keys.map(key => [key, store[key]]))
      }
      return { ...store, ...keys }
    }),
    set: vi.fn(async (items: StorageMap) => {
      Object.assign(store, items)
    }),
    remove: vi.fn(async (keys: string | string[]) => {
      const keyList = Array.isArray(keys) ? keys : [keys]
      for (const key of keyList) {
        delete store[key]
      }
    })
  }

  return { storage: { local }, store }
}

const localProfile: LocalProfile = {
  localProfileId: '11111111-1111-4111-8111-111111111111',
  createdAt: '2026-07-22T05:00:00.000Z',
  schemaVersion: 1
}

describe('memory-item-repository', () => {
  beforeEach(async () => {
    resetMemoryDatabaseInitializationForTests()
    vi.stubGlobal(
      'chrome',
      createChromeStorageMock({
        [LOCAL_PROFILE_STORAGE_KEY]: localProfile
      })
    )

    for (const database of await indexedDB.databases()) {
      if (database.name) {
        indexedDB.deleteDatabase(database.name)
      }
    }
  })

  it('createBookmark 写入并可按 owner 读取', async () => {
    const created = await memoryItemRepository.createBookmark({
      payload: {
        title: 'Yiveno Docs',
        url: 'https://yiveno.com/docs'
      },
      captureEntry: 'popup',
      now: () => '2026-07-22T06:00:00.000Z'
    })

    const fetched = await memoryItemRepository.getById(created.id)
    expect(fetched).toEqual(created)

    const list = await memoryItemRepository.listByOwner({ type: 'bookmark' })
    expect(list).toHaveLength(1)
    expect(list[0]?.id).toBe(created.id)
  })

  it('createTextExcerpt 与其他 owner 隔离', async () => {
    const { item } = await memoryItemRepository.createTextExcerpt({
      payload: {
        selectedText: '一段文字',
        sourceUrl: 'https://example.com/article',
        pageTitle: '文章'
      },
      now: () => '2026-07-22T06:00:00.000Z'
    })

    const otherOwner = await memoryItemRepository.getById(
      item.id,
      '99999999-9999-4999-8999-999999999999'
    )
    expect(otherOwner).toBeNull()

    await memoryItemRepository.softDelete(item.id)
    const active = await memoryItemRepository.listByOwner({ type: 'text_excerpt' })
    expect(active).toHaveLength(0)

    const includingDeleted = await memoryItemRepository.listByOwner({
      type: 'text_excerpt',
      includeDeleted: true
    })
    expect(includingDeleted).toHaveLength(1)
    expect(includingDeleted[0]?.deletedAt).toBeTruthy()
  })

  it('countActiveByOwner 只统计未删除项', async () => {
    const first = await memoryItemRepository.createBookmark({
      payload: { title: 'A', url: 'https://a.example.com' },
      now: () => '2026-07-22T06:00:00.000Z'
    })
    await memoryItemRepository.createBookmark({
      payload: { title: 'B', url: 'https://b.example.com' },
      now: () => '2026-07-22T06:01:00.000Z'
    })

    expect(await memoryItemRepository.countActiveByOwner('bookmark')).toBe(2)

    await memoryItemRepository.softDelete(first.id)
    expect(await memoryItemRepository.countActiveByOwner('bookmark')).toBe(1)
  })

  it('recordDismiss 递增 dismissCount 且不改 updatedAt', async () => {
    const created = await memoryItemRepository.createBookmark({
      payload: { title: '可否定项', url: 'https://dismiss.example.com/item' },
      now: () => '2026-07-22T06:00:00.000Z'
    })

    const dismissedAt = '2026-07-25T12:00:00.000Z'
    const updated = await memoryItemRepository.recordDismiss([created.id], dismissedAt)
    expect(updated).toBe(1)

    const fetched = await memoryItemRepository.getById(created.id)
    expect(fetched?.clues.dismissCount).toBe(1)
    expect(fetched?.clues.lastDismissedAt).toBe(dismissedAt)
    expect(fetched?.updatedAt).toBe(created.updatedAt)

    await memoryItemRepository.recordDismiss([created.id], '2026-07-26T12:00:00.000Z')
    const again = await memoryItemRepository.getById(created.id)
    expect(again?.clues.dismissCount).toBe(2)
    expect(again?.updatedAt).toBe(created.updatedAt)
  })

  it('recordDismiss 忽略不存在 id 并去重', async () => {
    const created = await memoryItemRepository.createBookmark({
      payload: { title: '唯一项', url: 'https://unique.example.com' },
      now: () => '2026-07-22T06:00:00.000Z'
    })

    const updated = await memoryItemRepository.recordDismiss([
      created.id,
      created.id,
      '00000000-0000-4000-8000-000000000099'
    ])
    expect(updated).toBe(1)
  })

  it('upsertBookmarkFromChrome 复活同 chromeBookmarkId 软删行且保留附注', async () => {
    const created = await memoryItemRepository.createBookmark({
      payload: {
        title: '旧标题',
        url: 'https://revive.example.com/old',
        chromeBookmarkId: 'chrome-revive-1'
      },
      captureEntry: 'sync',
      now: () => '2026-07-22T06:00:00.000Z'
    })
    await memoryItemRepository.updateNote(created.id, '私人附注')
    await memoryItemRepository.softDelete(created.id)

    expect(await memoryItemRepository.getByChromeBookmarkId('chrome-revive-1')).toBeNull()

    const revived = await memoryItemRepository.upsertBookmarkFromChrome({
      payload: {
        title: '新标题',
        url: 'https://revive.example.com/new',
        chromeBookmarkId: 'chrome-revive-1'
      },
      captureEntry: 'sync',
      now: () => '2026-07-22T07:00:00.000Z'
    })

    expect(revived.id).toBe(created.id)
    expect(revived.deletedAt).toBeNull()
    expect(revived.type).toBe('bookmark')
    if (revived.type !== 'bookmark') {
      throw new Error('expected bookmark')
    }
    expect(revived.payload.title).toBe('新标题')
    expect(revived.payload.url).toBe('https://revive.example.com/new')
    expect(revived.clues.note).toBe('私人附注')

    const listed = await memoryItemRepository.listByOwner({
      type: 'bookmark',
      includeDeleted: true
    })
    expect(
      listed.filter(
        item => item.type === 'bookmark' && item.payload.chromeBookmarkId === 'chrome-revive-1'
      )
    ).toHaveLength(1)
  })

  it('upsertBookmarkFromChrome 墓碑 id 跳过复活且不清 deletedAt', async () => {
    const { addChromeBookmarkDeleteTombstone } =
      await import('@/infrastructure/storage/chrome-bookmark-delete-tombstone-storage')
    const created = await memoryItemRepository.createBookmark({
      payload: {
        title: '墓碑书签',
        url: 'https://tomb.example.com/a',
        chromeBookmarkId: 'chrome-tomb-1'
      },
      captureEntry: 'sync',
      now: () => '2026-07-22T06:00:00.000Z'
    })
    await memoryItemRepository.softDelete(created.id)
    await addChromeBookmarkDeleteTombstone('chrome-tomb-1')

    const skipped = await memoryItemRepository.upsertBookmarkFromChrome({
      payload: {
        title: '应被挡',
        url: 'https://tomb.example.com/a',
        chromeBookmarkId: 'chrome-tomb-1'
      },
      captureEntry: 'sync',
      now: () => '2026-07-22T07:00:00.000Z'
    })

    expect(skipped.id).toBe(created.id)
    expect(skipped.deletedAt).toBeTruthy()
    expect(await memoryItemRepository.getByChromeBookmarkId('chrome-tomb-1')).toBeNull()
  })

  it('remapOwnerId 迁移归属并保留 sourceLocalProfileId', async () => {
    const created = await memoryItemRepository.createBookmark({
      payload: { title: 'Remap', url: 'https://remap.example.com' },
      now: () => '2026-08-03T06:00:00.000Z'
    })
    expect(created.ownerId).toBe(localProfile.localProfileId)

    const accountId = '22222222-2222-4222-8222-222222222222'
    const remapped = await memoryItemRepository.remapOwnerId(localProfile.localProfileId, accountId)
    expect(remapped).toBe(1)

    const underOld = await memoryItemRepository.listAllByOwnerId(localProfile.localProfileId)
    expect(underOld).toHaveLength(0)

    const underNew = await memoryItemRepository.listAllByOwnerId(accountId)
    expect(underNew).toHaveLength(1)
    expect(underNew[0]?.id).toBe(created.id)
    expect(underNew[0]?.sourceLocalProfileId).toBe(localProfile.localProfileId)
  })

  it('createTextExcerpt 同页同文重复返回已有条目且不新增行', async () => {
    const payload = {
      selectedText: '  same excerpt body for dedupe  ',
      sourceUrl: 'https://example.com/dedupe',
      pageTitle: 'Dedupe'
    }
    const first = await memoryItemRepository.createTextExcerpt({
      payload,
      captureEntry: 'selection_toolbar'
    })
    expect(first.duplicate).toBe(false)

    const second = await memoryItemRepository.createTextExcerpt({
      payload,
      captureEntry: 'selection_toolbar'
    })
    expect(second.duplicate).toBe(true)
    expect(second.item.id).toBe(first.item.id)

    const listed = await memoryItemRepository.listByOwner({ type: 'text_excerpt' })
    expect(listed).toHaveLength(1)
  })

  it('createTextExcerpt >10k 浮层全文与右键截断跨路径去重命中', async () => {
    const sourceUrl = 'https://example.com/over-10k-cross-path'
    const fullText = `${'A'.repeat(10_000)}X`
    expect(fullText.length).toBe(10_001)
    const truncated = fullText.trim().slice(0, 10_000)
    expect(truncated.length).toBe(10_000)

    // 浮层路径：不经 normalizeTextExcerptSelection，正文可超 10_000
    const first = await memoryItemRepository.createTextExcerpt({
      payload: {
        selectedText: fullText,
        sourceUrl,
        pageTitle: 'Over 10k'
      },
      captureEntry: 'selection_toolbar'
    })
    expect(first.duplicate).toBe(false)
    if (first.item.type === 'text_excerpt') {
      expect(first.item.payload.selectedText.length).toBe(10_001)
    }

    // 右键路径：上游已 trim + 10_000 截断
    const second = await memoryItemRepository.createTextExcerpt({
      payload: {
        selectedText: truncated,
        sourceUrl,
        pageTitle: 'Over 10k'
      },
      captureEntry: 'context_menu'
    })
    expect(second.duplicate).toBe(true)
    expect(second.item.id).toBe(first.item.id)
    expect(await memoryItemRepository.listByOwner({ type: 'text_excerpt' })).toHaveLength(1)
  })

  it('createTextExcerpt 不同 sourceUrl 建新条', async () => {
    const text = 'shared body across pages for save dedupe'
    const a = await memoryItemRepository.createTextExcerpt({
      payload: {
        selectedText: text,
        sourceUrl: 'https://example.com/a',
        pageTitle: 'A'
      },
      captureEntry: 'selection_toolbar'
    })
    const b = await memoryItemRepository.createTextExcerpt({
      payload: {
        selectedText: text,
        sourceUrl: 'https://example.com/b',
        pageTitle: 'B'
      },
      captureEntry: 'selection_toolbar'
    })
    expect(a.duplicate).toBe(false)
    expect(b.duplicate).toBe(false)
    expect(a.item.id).not.toBe(b.item.id)
    expect(await memoryItemRepository.listByOwner({ type: 'text_excerpt' })).toHaveLength(2)
  })

  it('createTextExcerpt 软删行不匹配，重存建新条', async () => {
    const payload = {
      selectedText: 'soft-deleted then re-saved excerpt',
      sourceUrl: 'https://example.com/soft',
      pageTitle: 'Soft'
    }
    const first = await memoryItemRepository.createTextExcerpt({
      payload,
      captureEntry: 'selection_toolbar'
    })
    await memoryItemRepository.softDelete(first.item.id)

    const again = await memoryItemRepository.createTextExcerpt({
      payload,
      captureEntry: 'selection_toolbar'
    })
    expect(again.duplicate).toBe(false)
    expect(again.item.id).not.toBe(first.item.id)
    expect(await memoryItemRepository.listByOwner({ type: 'text_excerpt' })).toHaveLength(1)
  })

  it('countActiveByCorpusSource：0 / 部分来源 / 硬删后归零', async () => {
    expect(await memoryItemRepository.countActiveByCorpusSource('raindrop')).toBe(0)

    await memoryItemRepository.upsertBookmarkFromThirdPartyCorpus({
      payload: {
        title: 'RD 1',
        url: 'https://raindrop.example/1',
        corpusSource: 'raindrop',
        remoteId: 'rd-1'
      },
      captureEntry: 'import'
    })
    await memoryItemRepository.upsertBookmarkFromThirdPartyCorpus({
      payload: {
        title: 'RD 2',
        url: 'https://raindrop.example/2',
        corpusSource: 'raindrop',
        remoteId: 'rd-2'
      },
      captureEntry: 'import'
    })
    await memoryItemRepository.upsertBookmarkFromThirdPartyCorpus({
      payload: {
        title: 'PK 1',
        url: 'https://pocket.example/1',
        corpusSource: 'pocket',
        remoteId: 'pk-1'
      },
      captureEntry: 'import'
    })
    await memoryItemRepository.createBookmark({
      payload: { title: 'Chrome-ish', url: 'https://chrome.example/b' },
      captureEntry: 'sync'
    })

    expect(await memoryItemRepository.countActiveByCorpusSource('raindrop')).toBe(2)
    expect(await memoryItemRepository.countActiveByCorpusSource('pocket')).toBe(1)

    const deleted = await memoryItemRepository.hardDeleteByCorpusSource('raindrop')
    expect(deleted).toBe(2)
    expect(await memoryItemRepository.countActiveByCorpusSource('raindrop')).toBe(0)
    expect(await memoryItemRepository.countActiveByCorpusSource('pocket')).toBe(1)
    expect(await memoryItemRepository.countActiveByOwner('bookmark')).toBe(2)
  })

  it('hardDeleteByCorpusSource 只删该来源，不动其他来源与无 corpusSource 书签', async () => {
    await memoryItemRepository.upsertBookmarkFromThirdPartyCorpus({
      payload: {
        title: 'PK keep',
        url: 'https://pocket.example/keep',
        corpusSource: 'pocket',
        remoteId: 'pk-keep'
      },
      captureEntry: 'import'
    })
    const chromeLike = await memoryItemRepository.createBookmark({
      payload: {
        title: 'Local bookmark',
        url: 'https://local.example/b',
        chromeBookmarkId: 'chrome-keep-1'
      },
      captureEntry: 'sync'
    })
    await memoryItemRepository.upsertBookmarkFromThirdPartyCorpus({
      payload: {
        title: 'RD drop',
        url: 'https://raindrop.example/drop',
        corpusSource: 'raindrop',
        remoteId: 'rd-drop'
      },
      captureEntry: 'import'
    })

    expect(await memoryItemRepository.hardDeleteByCorpusSource('raindrop')).toBe(1)
    expect(await memoryItemRepository.countActiveByCorpusSource('raindrop')).toBe(0)
    expect(await memoryItemRepository.countActiveByCorpusSource('pocket')).toBe(1)
    expect(await memoryItemRepository.getById(chromeLike.id)).not.toBeNull()
  })

  it('listByOwner offset 2 + limit 2 返回倒序第 3–4 条', async () => {
    const ids: string[] = []
    for (let index = 0; index < 5; index += 1) {
      const { item } = await memoryItemRepository.createTextExcerpt({
        payload: {
          selectedText: `offset page excerpt ${index}`,
          sourceUrl: `https://offset.example.com/${index}`,
          pageTitle: `O${index}`
        },
        now: () => `2026-07-22T0${index}:00:00.000Z`
      })
      ids.push(item.id)
    }

    const page = await memoryItemRepository.listByOwner({
      type: 'text_excerpt',
      limit: 2,
      offset: 2
    })
    expect(page).toHaveLength(2)
    // updatedAt 倒序：index 4,3,2,1,0 → offset 2 起为 index 2,1
    expect(page[0]?.id).toBe(ids[2])
    expect(page[1]?.id).toBe(ids[1])
  })

  it('listByOwner offset ≥ 总数返回空数组', async () => {
    await memoryItemRepository.createTextExcerpt({
      payload: {
        selectedText: 'only one',
        sourceUrl: 'https://offset-empty.example.com/1',
        pageTitle: 'One'
      }
    })
    const page = await memoryItemRepository.listByOwner({
      type: 'text_excerpt',
      limit: 10,
      offset: 5
    })
    expect(page).toEqual([])
  })

  it('listByOwner offset 0 等价于不传', async () => {
    for (let index = 0; index < 3; index += 1) {
      await memoryItemRepository.createTextExcerpt({
        payload: {
          selectedText: `offset zero ${index}`,
          sourceUrl: `https://offset-zero.example.com/${index}`,
          pageTitle: `Z${index}`
        },
        now: () => `2026-07-22T1${index}:00:00.000Z`
      })
    }
    const withZero = await memoryItemRepository.listByOwner({
      type: 'text_excerpt',
      limit: 2,
      offset: 0
    })
    const without = await memoryItemRepository.listByOwner({
      type: 'text_excerpt',
      limit: 2
    })
    expect(withZero.map(item => item.id)).toEqual(without.map(item => item.id))
  })

  it('listByOwner 软删行不占 offset 名额', async () => {
    const created: string[] = []
    for (let index = 0; index < 4; index += 1) {
      const { item } = await memoryItemRepository.createTextExcerpt({
        payload: {
          selectedText: `offset soft ${index}`,
          sourceUrl: `https://offset-soft.example.com/${index}`,
          pageTitle: `S${index}`
        },
        now: () => `2026-07-22T2${index}:00:00.000Z`
      })
      created.push(item.id)
    }
    // 倒序活条目：3,2,1,0；删掉窗口内第 2 条（index 2）后：3,1,0
    await memoryItemRepository.softDelete(created[2]!)
    const beforeDeleteWindow = await memoryItemRepository.listByOwner({
      type: 'text_excerpt',
      limit: 1,
      offset: 1
    })
    // 软删后 offset 1 仍应落在原「跳过最新 1 条后的下一条」口径：最新为 3，下一条为 1
    expect(beforeDeleteWindow).toHaveLength(1)
    expect(beforeDeleteWindow[0]?.id).toBe(created[1])
  })

  it('listByOwner query 命中标题', async () => {
    await memoryItemRepository.createTextExcerpt({
      payload: {
        selectedText: 'body alpha',
        sourceUrl: 'https://query-title.example.com/a',
        pageTitle: 'UniqueTitleNeedle'
      },
      now: () => '2026-07-22T06:00:00.000Z'
    })
    await memoryItemRepository.createTextExcerpt({
      payload: {
        selectedText: 'body beta',
        sourceUrl: 'https://query-title.example.com/b',
        pageTitle: 'Other'
      },
      now: () => '2026-07-22T06:01:00.000Z'
    })

    const listed = await memoryItemRepository.listByOwner({
      type: 'text_excerpt',
      query: 'uniquetitleneedle'
    })
    expect(listed).toHaveLength(1)
    expect(listed[0]?.type === 'text_excerpt' && listed[0].payload.pageTitle).toBe(
      'UniqueTitleNeedle'
    )
  })

  it('listByOwner query 命中正文 selectedText', async () => {
    await memoryItemRepository.createTextExcerpt({
      payload: {
        selectedText: 'the secret body phrase',
        sourceUrl: 'https://query-body.example.com/a',
        pageTitle: 'A'
      }
    })
    await memoryItemRepository.createTextExcerpt({
      payload: {
        selectedText: 'unrelated',
        sourceUrl: 'https://query-body.example.com/b',
        pageTitle: 'B'
      }
    })

    const listed = await memoryItemRepository.listByOwner({
      type: 'text_excerpt',
      query: 'secret body'
    })
    expect(listed).toHaveLength(1)
    expect(listed[0]?.type === 'text_excerpt' && listed[0].payload.selectedText).toBe(
      'the secret body phrase'
    )
  })

  it('listByOwner query 命中附注 clues.note', async () => {
    const { item } = await memoryItemRepository.createTextExcerpt({
      payload: {
        selectedText: 'plain body',
        sourceUrl: 'https://query-note.example.com/a',
        pageTitle: 'Note host'
      },
      clues: { note: 'shelf for quarterly review' }
    })
    await memoryItemRepository.createTextExcerpt({
      payload: {
        selectedText: 'other',
        sourceUrl: 'https://query-note.example.com/b',
        pageTitle: 'Other'
      }
    })

    const listed = await memoryItemRepository.listByOwner({
      type: 'text_excerpt',
      query: 'quarterly review'
    })
    expect(listed).toHaveLength(1)
    expect(listed[0]?.id).toBe(item.id)
  })

  it('listByOwner query 命中 URL 全文', async () => {
    await memoryItemRepository.createBookmark({
      payload: {
        title: 'Docs',
        url: 'https://docs.yiveno.example/path/retention'
      }
    })
    await memoryItemRepository.createBookmark({
      payload: {
        title: 'Other',
        url: 'https://other.example.com/'
      }
    })

    const listed = await memoryItemRepository.listByOwner({
      type: 'bookmark',
      query: 'yiveno.example/path'
    })
    expect(listed).toHaveLength(1)
    expect(listed[0]?.type === 'bookmark' && listed[0].payload.url).toContain('retention')
  })

  it('listByOwner 空 query 不过滤', async () => {
    await memoryItemRepository.createTextExcerpt({
      payload: {
        selectedText: 'one',
        sourceUrl: 'https://query-empty.example.com/1',
        pageTitle: 'One'
      }
    })
    await memoryItemRepository.createTextExcerpt({
      payload: {
        selectedText: 'two',
        sourceUrl: 'https://query-empty.example.com/2',
        pageTitle: 'Two'
      }
    })

    const blank = await memoryItemRepository.listByOwner({
      type: 'text_excerpt',
      query: '   '
    })
    const omitted = await memoryItemRepository.listByOwner({ type: 'text_excerpt' })
    expect(blank).toHaveLength(2)
    expect(blank.map(item => item.id).sort()).toEqual(omitted.map(item => item.id).sort())
  })

  it('listByOwner sort oldest 顺序与 newest 相反', async () => {
    const ids: string[] = []
    for (let index = 0; index < 3; index += 1) {
      const { item } = await memoryItemRepository.createTextExcerpt({
        payload: {
          selectedText: `sort order ${index}`,
          sourceUrl: `https://sort-order.example.com/${index}`,
          pageTitle: `S${index}`
        },
        now: () => `2026-07-22T1${index}:00:00.000Z`
      })
      ids.push(item.id)
    }

    const newest = await memoryItemRepository.listByOwner({
      type: 'text_excerpt',
      sort: 'newest'
    })
    const oldest = await memoryItemRepository.listByOwner({
      type: 'text_excerpt',
      sort: 'oldest'
    })
    expect(newest.map(item => item.id)).toEqual([ids[2], ids[1], ids[0]])
    expect(oldest.map(item => item.id)).toEqual([ids[0], ids[1], ids[2]])
  })

  it('listByOwner query + offset/limit 先过滤再分页', async () => {
    const matchingIds: string[] = []
    for (let index = 0; index < 4; index += 1) {
      const { item } = await memoryItemRepository.createTextExcerpt({
        payload: {
          selectedText: `filter page keep ${index}`,
          sourceUrl: `https://filter-page.example.com/keep/${index}`,
          pageTitle: `Keep${index}`
        },
        now: () => `2026-07-22T2${index}:00:00.000Z`
      })
      matchingIds.push(item.id)
    }
    await memoryItemRepository.createTextExcerpt({
      payload: {
        selectedText: 'noise',
        sourceUrl: 'https://filter-page.example.com/noise',
        pageTitle: 'Noise'
      },
      now: () => '2026-07-22T23:00:00.000Z'
    })

    const page = await memoryItemRepository.listByOwner({
      type: 'text_excerpt',
      query: 'filter page keep',
      limit: 2,
      offset: 1,
      sort: 'newest'
    })
    // 命中倒序 keep3,2,1,0 → offset 1 limit 2 → keep2, keep1
    expect(page.map(item => item.id)).toEqual([matchingIds[2], matchingIds[1]])
  })

  it('countActiveByOwner 带 query 返回过滤后总数', async () => {
    await memoryItemRepository.createTextExcerpt({
      payload: {
        selectedText: 'count match alpha',
        sourceUrl: 'https://count-query.example.com/a',
        pageTitle: 'A'
      }
    })
    await memoryItemRepository.createTextExcerpt({
      payload: {
        selectedText: 'count match beta',
        sourceUrl: 'https://count-query.example.com/b',
        pageTitle: 'B'
      }
    })
    await memoryItemRepository.createTextExcerpt({
      payload: {
        selectedText: 'other',
        sourceUrl: 'https://count-query.example.com/c',
        pageTitle: 'C'
      }
    })

    expect(await memoryItemRepository.countActiveByOwner('text_excerpt', 'count match')).toBe(2)
    expect(await memoryItemRepository.countActiveByOwner('text_excerpt')).toBe(3)
  })
})
