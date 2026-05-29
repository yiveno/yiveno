/**
 * TanStack Query 配置
 *
 * 职责：
 * - 配置全局 Query Client
 * - 定义默认查询选项
 * - 提供错误处理和重试策略
 */

import { QueryClient } from '@tanstack/vue-query'
import { logger } from '@/infrastructure/logging/logger'

/**
 * 创建 Query Client 实例
 *
 * 配置说明：
 * - staleTime: 数据保持新鲜的时间（5分钟）
 * - gcTime: 未使用数据的缓存保留时间（10分钟）
 * - retry: 失败重试次数
 * - refetchOnWindowFocus: 窗口聚焦时重新获取（离线场景关闭）
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // 数据新鲜度：5分钟内不重新请求
      staleTime: 5 * 60 * 1000,

      // 垃圾回收：10分钟后清除未使用的缓存
      gcTime: 10 * 60 * 1000,

      // 失败重试：2次
      retry: 2,

      // 重试延迟：指数退避
      retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000),

      // 窗口聚焦时不自动重新获取（Chrome 扩展特性）
      refetchOnWindowFocus: false,

      // 错误处理
      throwOnError: false
    },
    mutations: {
      // 失败重试：1次
      retry: 1,

      // 错误处理
      onError: error => {
        logger.error('QueryClient', 'Mutation 失败', error)
      }
    }
  }
})

/**
 * Query Keys 工厂函数
 *
 * 统一管理所有 Query Keys，确保类型安全和一致性
 */
export const queryKeys = {
  /**
   * 书签相关的 Query Keys
   */
  bookmarks: {
    /** 所有书签 */
    all: ['bookmarks'] as const,

    /** 书签列表（可带过滤条件） */
    lists: () => [...queryKeys.bookmarks.all, 'list'] as const,

    /** 单个书签详情 */
    detail: (id: string) => [...queryKeys.bookmarks.all, 'detail', id] as const,

    /** 子书签 */
    children: (parentId: string, offset: number, limit: number) =>
      [...queryKeys.bookmarks.all, 'children', parentId, offset, limit] as const
  },

  /**
   * 筛选相关的 Query Keys
   */
  search: {
    /** 筛选结果 */
    results: (query: string, options?: Record<string, unknown>) =>
      ['search', query, options] as const
  },

  /**
   * 特征检测相关的 Query Keys
   */
  trait: {
    /** 特征检测状态 */
    status: ['trait', 'status'] as const
  }
} as const
