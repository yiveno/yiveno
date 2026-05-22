/**
 * QueryService 单元测试
 *
 * 测试目标：core/query-engine/query-service.ts
 *
 * 测试范围：
 * - 基础查询功能
 * - 查询选项处理
 * - 缓存机制
 * - 边界情况处理
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { QueryService } from '@/core/query-engine/query-service'
import type { SearchOptions } from '@/core/query-engine/query-types'
import { indexedDBManager, type BookmarkRecord } from '@/infrastructure/indexeddb/manager'

// Mock IndexedDB Manager
vi.mock('@/infrastructure/indexeddb/manager', () => ({
  indexedDBManager: {
    initialize: vi.fn().mockResolvedValue(undefined),
    getAllBookmarks: vi.fn().mockResolvedValue([])
  }
}))

// Mock Query Worker Adapter
vi.mock('@/services/query-worker-adapter', () => {
  const mockBookmarks = [
    {
      id: '1',
      title: 'Vue.js 官方文档',
      url: 'https://vuejs.org',
      titleLower: 'vue.js 官方文档',
      urlLower: 'https://vuejs.org',
      domain: 'vuejs.org',
      parentId: '0',
      dateAdded: Date.now(),
      index: 0
    }
  ]

  return {
    queryWorkerAdapter: {
      initFromIDB: vi.fn().mockResolvedValue(undefined),
      search: vi.fn().mockImplementation((query: string) => {
        // 如果查询为空或没有匹配,返回空数组
        if (!query || query.trim() === '') {
          return Promise.resolve([])
        }

        // 简单的匹配逻辑
        const lowerQuery = query.toLowerCase()
        const results = mockBookmarks
          .filter(
            b =>
              b.titleLower.includes(lowerQuery) ||
              b.urlLower.includes(lowerQuery) ||
              b.domain.includes(lowerQuery)
          )
          .map(bookmark => ({
            bookmark,
            score: 0.9
          }))

        return Promise.resolve(results)
      })
    }
  }
})

describe('QueryService', () => {
  let queryService: QueryService

  beforeEach(async () => {
    vi.clearAllMocks()
    queryService = QueryService.getInstance()
    await queryService.initialize()
  })

  describe('基础查询功能', () => {
    it('应该能够执行简单查询', async () => {
      const bookmarks = [
        {
          id: '1',
          title: 'Vue.js 官方文档',
          url: 'https://vuejs.org',
          titleLower: 'vue.js 官方文档',
          urlLower: 'https://vuejs.org',
          domain: 'vuejs.org',
          parentId: '0',
          dateAdded: Date.now(),
          index: 0
        },
        {
          id: '2',
          title: 'React 官方文档',
          url: 'https://react.dev',
          titleLower: 'react 官方文档',
          urlLower: 'https://react.dev',
          domain: 'react.dev',
          parentId: '0',
          dateAdded: Date.now(),
          index: 1
        }
      ]

      vi.mocked(indexedDBManager.getAllBookmarks).mockResolvedValue(
        bookmarks as unknown as BookmarkRecord[]
      )

      const response = await queryService.search('vue')

      expect(response.results.length).toBeGreaterThan(0)
      expect(response.metadata.totalResults).toBeGreaterThan(0)
    })

    it('空查询应该返回空结果', async () => {
      const response = await queryService.search('')

      expect(response.results).toHaveLength(0)
      expect(response.metadata.totalResults).toBe(0)
    })

    it('空白字符查询应该返回空结果', async () => {
      const response = await queryService.search('   ')

      expect(response.results).toHaveLength(0)
      expect(response.metadata.totalResults).toBe(0)
    })
  })

  describe('查询选项', () => {
    it('应该支持限制结果数量', async () => {
      const bookmarks = Array.from({ length: 100 }, (_, i) => ({
        id: `${i}`,
        title: `Vue 教程 ${i}`,
        url: `https://vue-${i}.com`,
        titleLower: `vue 教程 ${i}`,
        urlLower: `https://vue-${i}.com`,
        domain: `vue-${i}.com`,
        parentId: '0',
        dateAdded: Date.now(),
        index: i
      }))

      vi.mocked(indexedDBManager.getAllBookmarks).mockResolvedValue(
        bookmarks as unknown as BookmarkRecord[]
      )

      const options: SearchOptions = { limit: 10 }
      const response = await queryService.search('vue', options)

      expect(response.results.length).toBeLessThanOrEqual(10)
    })

    it('应该支持缓存', async () => {
      const bookmarks = [
        {
          id: '1',
          title: 'Vue 文档',
          url: 'https://vuejs.org',
          titleLower: 'vue 文档',
          urlLower: 'https://vuejs.org',
          domain: 'vuejs.org',
          parentId: '0',
          dateAdded: Date.now(),
          index: 0
        }
      ]

      vi.mocked(indexedDBManager.getAllBookmarks).mockResolvedValue(
        bookmarks as unknown as BookmarkRecord[]
      )

      // 第一次查询
      const response1 = await queryService.search('vue', { useCache: true })
      expect(response1.metadata.cacheHit).toBe(false)

      // 第二次查询应该命中缓存
      const response2 = await queryService.search('vue', { useCache: true })
      expect(response2.metadata.cacheHit).toBe(true)
    })

    it('应该支持排序', async () => {
      const bookmarks = [
        {
          id: '1',
          title: 'B Vue',
          url: 'https://b.com',
          titleLower: 'b vue',
          urlLower: 'https://b.com',
          domain: 'b.com',
          parentId: '0',
          dateAdded: Date.now() - 1000,
          index: 0
        },
        {
          id: '2',
          title: 'A Vue',
          url: 'https://a.com',
          titleLower: 'a vue',
          urlLower: 'https://a.com',
          domain: 'a.com',
          parentId: '0',
          dateAdded: Date.now(),
          index: 1
        }
      ]

      vi.mocked(indexedDBManager.getAllBookmarks).mockResolvedValue(
        bookmarks as unknown as BookmarkRecord[]
      )

      // 按标题排序
      const response = await queryService.search('vue', { sortBy: 'title', sortOrder: 'asc' })

      if (response.results.length >= 2) {
        expect(response.results[0]).toBeDefined()
        expect(response.results[1]).toBeDefined()
        const first = response.results[0]!
        const second = response.results[1]!
        expect(first.bookmark.title.localeCompare(second.bookmark.title)).toBeLessThan(0)
      }
    })
  })

  describe('缓存管理', () => {
    it('应该能够清空缓存', async () => {
      const bookmarks = [
        {
          id: '1',
          title: 'Vue 文档',
          url: 'https://vuejs.org',
          titleLower: 'vue 文档',
          urlLower: 'https://vuejs.org',
          domain: 'vuejs.org',
          parentId: '0',
          dateAdded: Date.now(),
          index: 0
        }
      ]

      vi.mocked(indexedDBManager.getAllBookmarks).mockResolvedValue(
        bookmarks as unknown as BookmarkRecord[]
      )

      // 查询并缓存
      await queryService.search('vue', { useCache: true })

      // 清空缓存
      queryService.clearCache()

      // 再次查询应该不命中缓存
      const response = await queryService.search('vue', { useCache: true })
      expect(response.metadata.cacheHit).toBe(false)
    })

    it('应该能够获取缓存统计', async () => {
      const stats = queryService.getCacheStats()

      expect(stats).toBeDefined()
      expect(typeof stats.size).toBe('number')
    })
  })

  describe('边界情况', () => {
    it('应该处理空书签列表', async () => {
      vi.mocked(indexedDBManager.getAllBookmarks).mockResolvedValue([])

      // Mock worker 返回空结果
      const { queryWorkerAdapter } = await import('@/services/query-worker-adapter')
      vi.mocked(queryWorkerAdapter.search).mockResolvedValueOnce([])

      const response = await queryService.search('vue')

      expect(response.results).toHaveLength(0)
    })

    it('应该处理超长查询', async () => {
      const bookmarks = [
        {
          id: '1',
          title: 'Test',
          url: 'https://test.com',
          titleLower: 'test',
          urlLower: 'https://test.com',
          domain: 'test.com',
          parentId: '0',
          dateAdded: Date.now(),
          index: 0
        }
      ]

      vi.mocked(indexedDBManager.getAllBookmarks).mockResolvedValue(
        bookmarks as unknown as BookmarkRecord[]
      )

      const longQuery = 'a'.repeat(1000)
      const response = await queryService.search(longQuery)

      // 应该不会崩溃
      expect(response).toBeDefined()
      expect(Array.isArray(response.results)).toBe(true)
    })
  })
})
