import { beforeEach, describe, expect, it, vi } from 'vitest'

const ensureBackgroundBootstrappedMock = vi.hoisted(() => vi.fn(async () => undefined))

vi.mock('@/background/bootstrap-ready', () => ({
  ensureBackgroundBootstrapped: ensureBackgroundBootstrappedMock
}))

import 'fake-indexeddb/auto'

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
  let onClickedHandler: ((info: unknown, tab?: unknown) => void) | null = null

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
      },
      // 语言偏好变更会刷新菜单标题；单测只需可挂监听
      onChanged: {
        addListener: vi.fn()
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
      onClicked: {
        addListener: vi.fn((handler: (info: unknown, tab?: unknown) => void) => {
          onClickedHandler = handler
        })
      }
    },
    i18n: {
      getMessage: vi.fn(() => 'Save to Yiveno')
    },
    action: {
      setBadgeBackgroundColor: vi.fn(async () => undefined),
      setBadgeText: vi.fn(async () => undefined)
    },
    scripting: {
      executeScript: vi.fn(async () => [
        {
          result: {
            selectedText: 'retention analysis',
            contextBefore: 'about',
            contextAfter: 'methods'
          }
        }
      ])
    },
    __setMenuExists(value: boolean) {
      menuExists = value
    },
    __getOnClickedHandler() {
      return onClickedHandler
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
    ensureBackgroundBootstrappedMock.mockResolvedValue(undefined)
    vi.clearAllMocks()
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
        title: 'Save to Yiveno',
        contexts: ['selection']
      },
      expect.any(Function)
    )
  })

  it('registerContextMenuItems 已存在时 update 而不 create', async () => {
    const chromeMock = chrome as unknown as ReturnType<typeof createChromeMock>
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
        selectionText: 'retention analysis',
        pageUrl: 'https://example.com/post'
      } as chrome.contextMenus.OnClickData,
      { id: 1, title: 'Growth notes', url: 'https://example.com/post' } as chrome.tabs.Tab
    )

    const items = await memoryItemRepository.listByOwner({ type: 'text_excerpt' })
    expect(items).toHaveLength(1)
    if (items[0]?.type === 'text_excerpt') {
      expect(items[0].payload.selectedText).toBe('retention analysis')
      expect(items[0].payload.pageTitle).toBe('Growth notes')
    }
  })

  it('registerContextMenuListeners 只注册一次 onClicked', () => {
    registerContextMenuListeners()
    registerContextMenuListeners()
    expect(chrome.contextMenus.onClicked.addListener).toHaveBeenCalledTimes(1)
  })

  it('onClicked 回调先 await bootstrap', async () => {
    registerContextMenuListeners()
    const handler = (
      chrome as unknown as ReturnType<typeof createChromeMock>
    ).__getOnClickedHandler()
    expect(handler).not.toBeNull()

    handler?.(
      {
        menuItemId: CONTEXT_MENU_SAVE_SELECTION_ID,
        selectionText: 'retention analysis',
        pageUrl: 'https://example.com/post'
      } as chrome.contextMenus.OnClickData,
      { id: 1, title: 'Growth notes', url: 'https://example.com/post' } as chrome.tabs.Tab
    )

    await vi.waitFor(() => {
      expect(ensureBackgroundBootstrappedMock).toHaveBeenCalledTimes(1)
    })
  })

  it('不可保存页抛出 CAPTURE_UNSAVABLE_PAGE', async () => {
    await expect(
      handleContextMenuClick({
        menuItemId: CONTEXT_MENU_SAVE_SELECTION_ID,
        selectionText: 'secret',
        pageUrl: 'chrome://extensions'
      } as chrome.contextMenus.OnClickData)
    ).rejects.toMatchObject({ errorCode: 'CAPTURE_UNSAVABLE_PAGE' })
  })
})
