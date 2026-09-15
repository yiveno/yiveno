import 'fake-indexeddb/auto'

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { LOCAL_PROFILE_STORAGE_KEY, type LocalProfile } from '@/core/identity/local-profile'
import { DEFAULT_USER_SETTINGS, USER_SETTINGS_STORAGE_KEY } from '@/core/settings/user-settings'
import {
  handleCaptureBookmark,
  handleCaptureTextExcerpt,
  handleDeleteMemoryItem,
  handleGetMemoryItem,
  handleListMemoryItems,
  handleRecordRecallDismiss,
  handleUpdateMemoryNote
} from '@/background/handlers/memory-handler'
import { resetMemoryDatabaseInitializationForTests } from '@/infrastructure/indexeddb/memory-db'

type StorageMap = Record<string, unknown>

function createChromeStorageMock(initial: StorageMap = {}) {
  const store: StorageMap = { ...initial }

  return {
    storage: {
      local: {
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
        remove: vi.fn(async () => undefined)
      }
    },
    tabs: {
      query: vi.fn(async () => [
        {
          title: 'Example Page',
          url: 'https://example.com/article',
          favIconUrl: 'https://example.com/favicon.ico'
        }
      ])
    },
    action: {
      setBadgeText: vi.fn(async () => undefined),
      setBadgeBackgroundColor: vi.fn(async () => undefined)
    }
  }
}

const localProfile: LocalProfile = {
  localProfileId: '11111111-1111-4111-8111-111111111111',
  createdAt: '2026-07-22T05:00:00.000Z',
  schemaVersion: 1
}

describe('memory-handler', () => {
  beforeEach(async () => {
    resetMemoryDatabaseInitializationForTests()
    vi.stubGlobal(
      'chrome',
      createChromeStorageMock({
        [LOCAL_PROFILE_STORAGE_KEY]: localProfile,
        [USER_SETTINGS_STORAGE_KEY]: {
          ...DEFAULT_USER_SETTINGS,
          chromeBookmarkIngestEnabled: true
        }
      })
    )

    for (const database of await indexedDB.databases()) {
      if (database.name) {
        indexedDB.deleteDatabase(database.name)
      }
    }
  })

  it('handleCaptureBookmark 写入并返回 MemoryItem', async () => {
    const response = await handleCaptureBookmark({
      title: 'Yiveno',
      url: 'https://yiveno.com'
    })

    expect(response.ok).toBe(true)
    if (!response.ok) {
      return
    }

    expect(response.item.type).toBe('bookmark')
    expect(response.item.payload.title).toBe('Yiveno')
  })

  it('handleListMemoryItems 返回当前用户条目', async () => {
    await handleCaptureBookmark({
      title: 'First',
      url: 'https://first.example.com'
    })

    const response = await handleListMemoryItems({ limit: 10 })
    expect(response.ok).toBe(true)
    if (!response.ok) {
      return
    }

    expect(response.total).toBe(1)
    expect(response.items[0]?.payload).toMatchObject({ title: 'First' })
  })

  it('handleCaptureBookmark 拒绝非法 payload', async () => {
    const response = await handleCaptureBookmark({ title: '', url: 'not-a-url' })
    expect(response.ok).toBe(false)
  })

  it('handleCaptureTextExcerpt 可写入 clues.note', async () => {
    const response = await handleCaptureTextExcerpt({
      selectedText: 'Clouds stack over distant mountains',
      sourceUrl: 'https://www.gushiwen.cn/shiwenv_demo.aspx',
      pageTitle: 'A quiet line',
      note: 'want to revisit this'
    })
    expect(response.ok).toBe(true)
    if (!response.ok || !('item' in response)) {
      return
    }
    expect(response.item.type).toBe('text_excerpt')
    expect(response.item.clues.note).toBe('want to revisit this')
  })

  it('handleUpdateMemoryNote 可为书签事后补注', async () => {
    const captured = await handleCaptureBookmark({
      title: 'Retention analysis',
      url: 'https://example.com/retention'
    })
    expect(captured.ok).toBe(true)
    if (!captured.ok || !('item' in captured)) {
      return
    }

    const updated = await handleUpdateMemoryNote({
      id: captured.item.id,
      note: 'plan for the leadership review'
    })
    expect(updated.ok).toBe(true)
    if (!updated.ok || !('item' in updated)) {
      return
    }
    expect(updated.item.clues.note).toBe('plan for the leadership review')

    const cleared = await handleUpdateMemoryNote({
      id: captured.item.id,
      note: ''
    })
    expect(cleared.ok).toBe(true)
    if (!cleared.ok || !('item' in cleared)) {
      return
    }
    expect(cleared.item.clues.note).toBeUndefined()
  })

  it('handleDeleteMemoryItem 可软删摘录', async () => {
    const captured = await handleCaptureTextExcerpt({
      selectedText: 'deletable excerpt',
      sourceUrl: 'https://example.com/note',
      pageTitle: 'Note'
    })
    expect(captured.ok).toBe(true)
    if (!captured.ok || !('item' in captured)) {
      return
    }

    const deleted = await handleDeleteMemoryItem({ id: captured.item.id })
    expect(deleted.ok).toBe(true)
    if (!deleted.ok || !('item' in deleted)) {
      return
    }
    expect(deleted.item.deletedAt).toBeTruthy()

    const listed = await handleListMemoryItems({ type: 'text_excerpt', limit: 10 })
    expect(listed.ok).toBe(true)
    if (!listed.ok || !('items' in listed)) {
      return
    }
    expect(listed.items).toHaveLength(0)

    const fetched = await handleGetMemoryItem({ id: captured.item.id })
    expect(fetched.ok).toBe(false)
  })

  it('handleDeleteMemoryItem 拒绝删除书签', async () => {
    const captured = await handleCaptureBookmark({
      title: 'Keep in Chrome',
      url: 'https://bookmark.example.com'
    })
    expect(captured.ok).toBe(true)
    if (!captured.ok || !('item' in captured)) {
      return
    }

    const deleted = await handleDeleteMemoryItem({ id: captured.item.id })
    expect(deleted.ok).toBe(false)
    if (deleted.ok) {
      return
    }
    expect(deleted.errorCode).toBe('MEMORY_DELETE_BOOKMARK_FORBIDDEN')
  })

  it('handleRecordRecallDismiss 写回 dismissCount', async () => {
    const captured = await handleCaptureBookmark({
      title: 'dismissible bookmark',
      url: 'https://dismiss-handler.example.com'
    })
    expect(captured.ok).toBe(true)
    if (!captured.ok || !('item' in captured)) {
      return
    }

    const response = await handleRecordRecallDismiss({ ids: [captured.item.id] })
    expect(response.ok).toBe(true)
    if (!response.ok || !('updated' in response)) {
      return
    }
    expect(response.updated).toBe(1)

    const fetched = await handleGetMemoryItem({ id: captured.item.id })
    expect(fetched.ok).toBe(true)
    if (!fetched.ok || !('item' in fetched)) {
      return
    }
    expect(fetched.item.clues.dismissCount).toBe(1)
    expect(fetched.item.clues.lastDismissedAt).toBeTruthy()
  })
})
