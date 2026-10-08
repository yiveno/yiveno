/**
 * Chrome API 测试 mock 辅助：避开 @types/chrome 回调式 overload 把 Promise mock 收成 void。
 */

import { vi } from 'vitest'

/** 带 mockResolvedValue 的 Promise 风格 tabs.get */
export type MockTabsGet = ReturnType<typeof vi.fn<(tabId: number) => Promise<chrome.tabs.Tab>>>

/** 带 mockResolvedValue 的 Promise 风格 tabs.query */
export type MockTabsQuery = ReturnType<
  typeof vi.fn<(queryInfo?: chrome.tabs.QueryInfo) => Promise<chrome.tabs.Tab[]>>
>

/** 带 mockResolvedValue 的 Promise 风格 tabs.create */
export type MockTabsCreate = ReturnType<
  typeof vi.fn<(createProperties: chrome.tabs.CreateProperties) => Promise<chrome.tabs.Tab>>
>

export function createMockTabsGet(): MockTabsGet {
  return vi.fn<(tabId: number) => Promise<chrome.tabs.Tab>>()
}

export function createMockTabsQuery(): MockTabsQuery {
  return vi.fn<(queryInfo?: chrome.tabs.QueryInfo) => Promise<chrome.tabs.Tab[]>>()
}

export function createMockTabsCreate(): MockTabsCreate {
  return vi.fn<(createProperties: chrome.tabs.CreateProperties) => Promise<chrome.tabs.Tab>>()
}

/** Omnibox onInputEntered 的 disposition（枚举的模板字面量形式） */
export type OmniboxDisposition = `${chrome.omnibox.OnInputEnteredDisposition}`
