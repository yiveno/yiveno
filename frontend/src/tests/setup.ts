/**
 * Vitest 全局设置
 *
 * 用途：
 * 1. Mock Chrome API
 * 2. Mock IndexedDB
 * 3. 全局测试工具
 *
 * 基于 Chrome Extensions 官方测试最佳实践:
 * https://developer.chrome.com/docs/extensions/how-to/test/unit-testing
 */

import { vi, afterEach } from 'vitest'

// ============================================
// 1. Mock Chrome API（增强版 - 模拟真实异步行为）
// ============================================

// 创建 Chrome API Mock
const createChromeMock = () => ({
  runtime: {
    id: 'test-extension-id',
    // 模拟真实的异步消息传递
    sendMessage: vi.fn((_message, callback?) => {
      const response = { success: true, data: _message }
      // 模拟异步行为
      if (callback) {
        setTimeout(() => callback(response), 0)
      }
      return Promise.resolve(response)
    }),
    // 用于模拟错误场景
    lastError: null as chrome.runtime.LastError | null,
    onMessage: {
      addListener: vi.fn(),
      removeListener: vi.fn()
    },
    getURL: vi.fn((path: string) => `chrome-extension://test-id/${path}`)
  },

  storage: {
    local: {
      // 模拟真实的异步存储
      get: vi.fn((_keys?, callback?) => {
        const result = {}
        if (callback) {
          setTimeout(() => callback(result), 0)
        }
        return Promise.resolve(result)
      }),
      set: vi.fn((_items, callback?) => {
        if (callback) {
          setTimeout(() => callback(), 0)
        }
        return Promise.resolve()
      }),
      remove: vi.fn((_keys, callback?) => {
        if (callback) {
          setTimeout(() => callback(), 0)
        }
        return Promise.resolve()
      }),
      clear: vi.fn((callback?) => {
        if (callback) {
          setTimeout(() => callback(), 0)
        }
        return Promise.resolve()
      })
    },
    session: {
      get: vi.fn((_keys?, callback?) => {
        const result = {}
        if (callback) {
          setTimeout(() => callback(result), 0)
        }
        return Promise.resolve(result)
      }),
      set: vi.fn((_items, callback?) => {
        if (callback) {
          setTimeout(() => callback(), 0)
        }
        return Promise.resolve()
      }),
      remove: vi.fn((_keys, callback?) => {
        if (callback) {
          setTimeout(() => callback(), 0)
        }
        return Promise.resolve()
      }),
      clear: vi.fn((callback?) => {
        if (callback) {
          setTimeout(() => callback(), 0)
        }
        return Promise.resolve()
      })
    },
    onChanged: {
      addListener: vi.fn(),
      removeListener: vi.fn()
    }
  },

  bookmarks: {
    getTree: vi.fn((callback?) => {
      const result: chrome.bookmarks.BookmarkTreeNode[] = []
      if (callback) {
        setTimeout(() => callback(result), 0)
      }
      return Promise.resolve(result)
    }),
    get: vi.fn((_id, callback?) => {
      const result: chrome.bookmarks.BookmarkTreeNode[] = []
      if (callback) {
        setTimeout(() => callback(result), 0)
      }
      return Promise.resolve(result)
    }),
    create: vi.fn((bookmark, callback?) => {
      const result = {
        id: 'new-id',
        ...bookmark
      } as chrome.bookmarks.BookmarkTreeNode
      if (callback) {
        setTimeout(() => callback(result), 0)
      }
      return Promise.resolve(result)
    }),
    update: vi.fn((_id, changes, callback?) => {
      const result = {
        id: _id,
        ...changes
      } as chrome.bookmarks.BookmarkTreeNode
      if (callback) {
        setTimeout(() => callback(result), 0)
      }
      return Promise.resolve(result)
    }),
    remove: vi.fn((_id, callback?) => {
      if (callback) {
        setTimeout(() => callback(), 0)
      }
      return Promise.resolve()
    }),
    move: vi.fn((_id, destination, callback?) => {
      const result = {
        id: _id,
        ...destination
      } as chrome.bookmarks.BookmarkTreeNode
      if (callback) {
        setTimeout(() => callback(result), 0)
      }
      return Promise.resolve(result)
    }),
    onCreated: {
      addListener: vi.fn(),
      removeListener: vi.fn()
    },
    onRemoved: {
      addListener: vi.fn(),
      removeListener: vi.fn()
    },
    onChanged: {
      addListener: vi.fn(),
      removeListener: vi.fn()
    },
    onMoved: {
      addListener: vi.fn(),
      removeListener: vi.fn()
    }
  },

  tabs: {
    query: vi.fn((_queryInfo, callback?) => {
      const result: chrome.tabs.Tab[] = []
      if (callback) {
        setTimeout(() => callback(result), 0)
      }
      return Promise.resolve(result)
    }),
    create: vi.fn((createProperties, callback?) => {
      const result = { id: 1, ...createProperties } as chrome.tabs.Tab
      if (callback) {
        setTimeout(() => callback(result), 0)
      }
      return Promise.resolve(result)
    }),
    update: vi.fn((_tabId, updateProperties, callback?) => {
      const result = { id: _tabId, ...updateProperties } as chrome.tabs.Tab
      if (callback) {
        setTimeout(() => callback(result), 0)
      }
      return Promise.resolve(result)
    }),
    remove: vi.fn((_tabIds, callback?) => {
      if (callback) {
        setTimeout(() => callback(), 0)
      }
      return Promise.resolve()
    })
  },

  // ✅ 新增：Alarms API Mock
  alarms: {
    create: vi.fn((_name?, _alarmInfo?) => {
      return Promise.resolve()
    }),
    get: vi.fn((_name?, callback?) => {
      const result = null
      if (callback) {
        setTimeout(() => callback(result), 0)
      }
      return Promise.resolve(result)
    }),
    getAll: vi.fn((callback?) => {
      const result: chrome.alarms.Alarm[] = []
      if (callback) {
        setTimeout(() => callback(result), 0)
      }
      return Promise.resolve(result)
    }),
    clear: vi.fn((_name?, callback?) => {
      const result = true
      if (callback) {
        setTimeout(() => callback(result), 0)
      }
      return Promise.resolve(result)
    }),
    clearAll: vi.fn((callback?) => {
      const result = true
      if (callback) {
        setTimeout(() => callback(result), 0)
      }
      return Promise.resolve(result)
    }),
    onAlarm: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
      // 自定义方法：用于测试中手动触发 alarm
      trigger: (alarm: chrome.alarms.Alarm) => {
        const listeners = vi.mocked(chrome.alarms.onAlarm.addListener).mock.calls
        listeners.forEach(([listener]) => listener(alarm))
      }
    }
  }
})

// 挂载到全局
global.chrome = createChromeMock() as unknown as typeof chrome

// ============================================
// 2. Mock IndexedDB（使用 fake-indexeddb）
// ============================================

// 注意：需要安装 fake-indexeddb
// bun add -d fake-indexeddb

import 'fake-indexeddb/auto'

// ============================================
// 3. 全局测试工具
// ============================================

// 重置所有 Mock
export function resetAllMocks() {
  vi.clearAllMocks()

  // 重新创建 Chrome Mock
  global.chrome = createChromeMock() as unknown as typeof chrome
}

// 每个测试后自动重置
afterEach(() => {
  resetAllMocks()
})

// ============================================
// 4. 测试数据工厂
// ============================================

export const createMockBookmark = (
  overrides: Partial<chrome.bookmarks.BookmarkTreeNode> = {}
): chrome.bookmarks.BookmarkTreeNode => ({
  id: 'test-id-' + Math.random(),
  title: 'Test Bookmark',
  url: 'https://example.com',
  dateAdded: Date.now(),
  index: 0,
  parentId: '0',
  syncing: false,
  ...overrides
})

export const createMockFolder = (
  overrides: Partial<chrome.bookmarks.BookmarkTreeNode> = {}
): chrome.bookmarks.BookmarkTreeNode => ({
  id: 'folder-id-' + Math.random(),
  title: 'Test Folder',
  dateAdded: Date.now(),
  index: 0,
  parentId: '0',
  syncing: false,
  children: [],
  ...overrides
})
