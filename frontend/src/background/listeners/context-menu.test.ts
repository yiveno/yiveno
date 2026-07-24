import 'fake-indexeddb/auto'

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { LOCAL_PROFILE_STORAGE_KEY, type LocalProfile } from '@/core/identity/local-profile'
import {
  CONTEXT_MENU_SAVE_SELECTION_ID,
  handleContextMenuClick,
  registerContextMenuItems,
  registerContextMenuListeners,
  resetContextMenuListenersForTests
} from '@/background/listeners/context-menu'
import { resetMemoryDatabaseInitializationForTests } from '@/infrastructure/indexeddb/memory-db'
import { memoryItemRepository } from '@/infrastructure/indexeddb/memory-item-repository'

type StorageMap = Record<string, unknown>

function createChromeMock(initial: StorageMap = {}) {
  const store: StorageMap = { ...initial }
  let menuExists = false
  let lastError: { message: string } | undefined

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
    runtime: {
      get lastError() {
        return lastError
      }
    },
    contextMenus: {
      update: vi.fn((_id: string, _props: unknown, done?: () => void) => {
        if (!menuExists) {
          lastError = { message: 'No matching item' }
        } else {
          lastError = undefined
        }
        done?.()
      }),
      create: vi.fn((_props: unknown, done?: () => void) => {
        menuExists = true
        lastError = undefined
        done?.()
      }),
      onClicked: { addListener: vi.fn() }
    },
    i18n: {
      getMessage: vi.fn(() => '保存到 Yiveno')
    },
    action: {
      setBadgeBackgroundColor: vi.fn(async () => undefined),
      setBadgeText: vi.fn(async () => undefined)
    },
    scripting: {
      executeScript: vi.fn(async () => [
        {
          result: {
            selectedText: '留存分析',
            contextBefore: '关于',
            contextAfter: '的方法'
          }
        }
      ])
    },
    __setMenuExists(value: boolean) {
      menuExists = value
    }
  }
}

const localProfile: LocalProfile = {
  localProfileId: '11111111-1111-4111-8111-111111111111',
  createdAt: '2026-07-22T05:00:00.000Z',
  schemaVersion: 1
}

describe('context-menu listener', () => {
  beforeEach(async () => {
    resetContextMenuListenersForTests()
    resetMemoryDatabaseInitializationForTests()
    vi.stubGlobal(
      'chrome',
      createChromeMock({
        [LOCAL_PROFILE_STORAGE_KEY]: localProfile
      })
    )

    for (const database of await indexedDB.databases()) {
      if (database.name) {
        indexedDB.deleteDatabase(database.name)
      }
    }
  })

  it('registerContextMenuItems 首次 create 选区菜单', async () => {
    await registerContextMenuItems()

    expect(chrome.contextMenus.update).toHaveBeenCalled()
    expect(chrome.contextMenus.create).toHaveBeenCalledWith(
      {
        id: CONTEXT_MENU_SAVE_SELECTION_ID,
        title: '保存到 Yiveno',
        contexts: ['selection']
      },
      expect.any(Function)
    )
  })

  it('registerContextMenuItems 已存在时 update 而不 create', async () => {
    const chromeMock = chrome as ReturnType<typeof createChromeMock>
    chromeMock.__setMenuExists(true)

    await registerContextMenuItems()

    expect(chrome.contextMenus.update).toHaveBeenCalled()
    expect(chrome.contextMenus.create).not.toHaveBeenCalled()
  })

  it('registerContextMenuItems 并发调用只执行一次', async () => {
    await Promise.all([registerContextMenuItems(), registerContextMenuItems()])

    expect(chrome.contextMenus.create).toHaveBeenCalledTimes(1)
  })

  it('handleContextMenuClick 保存选区为 Text Excerpt', async () => {
    await handleContextMenuClick(
      {
        menuItemId: CONTEXT_MENU_SAVE_SELECTION_ID,
        selectionText: '留存分析',
        pageUrl: 'https://example.com/post'
      },
      { id: 1, title: '增长笔记', url: 'https://example.com/post' }
    )

    const items = await memoryItemRepository.listByOwner({ type: 'text_excerpt' })
    expect(items).toHaveLength(1)
    if (items[0]?.type === 'text_excerpt') {
      expect(items[0].payload.selectedText).toBe('留存分析')
      expect(items[0].payload.pageTitle).toBe('增长笔记')
    }
  })

  it('registerContextMenuListeners 只注册一次 onClicked', () => {
    registerContextMenuListeners()
    registerContextMenuListeners()
    expect(chrome.contextMenus.onClicked.addListener).toHaveBeenCalledTimes(1)
  })
})
