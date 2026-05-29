/**
 * 书签数据查询 Composables（基于 TanStack Query）
 *
 * 职责：
 * - 封装书签数据的查询逻辑
 * - 自动管理 loading/error/data 状态
 * - 提供缓存和自动刷新
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/vue-query'
import type { MaybeRef } from 'vue'
import { queryKeys } from '@/infrastructure/query/query-client'
import { bookmarkAppService } from '@/application/bookmark/bookmark-app-service'
import type { BookmarkRecord } from '@/infrastructure/indexeddb/types'
import { logger } from '@/infrastructure/logging/logger'

/**
 * 获取所有书签数据
 *
 * @returns Query 对象，包含 data, isLoading, error 等
 *
 * @example
 * ```vue
 * <script setup>
 * const { data: bookmarks, isLoading, error } = useAllBookmarks()
 * </script>
 * ```
 */
export function useAllBookmarks() {
  return useQuery({
    queryKey: queryKeys.bookmarks.lists(),
    queryFn: async () => {
      logger.info('useBookmarkQueries', '查询所有书签')
      const result = await bookmarkAppService.getAllBookmarks()

      if (!result.ok) {
        throw result.error ?? new Error('获取书签失败')
      }

      return result.value
    },
    staleTime: 5 * 60 * 1000 // 5分钟内认为数据新鲜
  })
}

/**
 * 获取单个书签详情
 *
 * @param id - 书签 ID（支持 Ref）
 * @returns Query 对象
 *
 * @example
 * ```vue
 * <script setup>
 * const bookmarkId = ref('123')
 * const { data: bookmark, isLoading } = useBookmarkDetail(bookmarkId)
 * </script>
 * ```
 *
 * TODO: 等待 bookmarkAppService.getBookmarkById 实现后启用
 */
export function useBookmarkDetail(_id: MaybeRef<string>) {
  return useQuery({
    queryKey: ['bookmarks', 'detail', 'placeholder'],
    queryFn: async () => {
      throw new Error('getBookmarkById 未实现')
    },
    enabled: false
  })
}

/**
 * 创建书签的 Mutation
 *
 * @returns Mutation 对象
 *
 * @example
 * ```vue
 * <script setup>
 * const { mutate: createBookmark, isPending } = useCreateBookmark()
 *
 * const handleCreate = () => {
 *   createBookmark({
 *     title: '新书签',
 *     url: 'https://example.com'
 *   })
 * }
 * </script>
 * ```
 */
export function useCreateBookmark() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: { title: string; url?: string; parentId?: string }) => {
      logger.info('useBookmarkQueries', '创建书签', data)
      const result = await bookmarkAppService.createBookmark(data)

      if (!result.ok) {
        throw result.error ?? new Error('创建书签失败')
      }

      return result.value
    },

    onSuccess: newBookmark => {
      logger.info('useBookmarkQueries', '书签创建成功', newBookmark)

      // 使书签列表缓存失效，触发重新获取
      queryClient.invalidateQueries({
        queryKey: queryKeys.bookmarks.lists()
      })
    },

    onError: error => {
      logger.error('useBookmarkQueries', '创建书签失败', error)
    }
  })
}

/**
 * 更新书签的 Mutation
 *
 * @returns Mutation 对象
 *
 * @example
 * ```vue
 * <script setup>
 * const { mutate: updateBookmark, isPending } = useUpdateBookmark()
 *
 * const handleUpdate = (id: string) => {
 *   updateBookmark({
 *     id,
 *     title: '新标题'
 *   })
 * }
 * </script>
 * ```
 */
export function useUpdateBookmark() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: { id: string; title?: string; url?: string }) => {
      logger.info('useBookmarkQueries', '更新书签', data)
      const { id, ...changes } = data
      const result = await bookmarkAppService.updateBookmark(id, changes)

      if (!result.ok) {
        throw result.error ?? new Error('更新书签失败')
      }

      return result.value
    },

    // 乐观更新：在请求发送前立即更新 UI
    onMutate: async variables => {
      const { id } = variables

      // 取消正在进行的查询，避免冲突
      await queryClient.cancelQueries({
        queryKey: queryKeys.bookmarks.detail(id)
      })

      // 保存当前数据的快照（用于回滚）
      const previousBookmark = queryClient.getQueryData<BookmarkRecord>(
        queryKeys.bookmarks.detail(id)
      )

      // 乐观更新：立即更新缓存
      queryClient.setQueryData<BookmarkRecord>(queryKeys.bookmarks.detail(id), old => {
        if (!old) return old
        return { ...old, ...variables }
      })

      return { previousBookmark }
    },

    onSuccess: updatedBookmark => {
      logger.info('useBookmarkQueries', '书签更新成功', updatedBookmark)

      // 使相关缓存失效
      queryClient.invalidateQueries({
        queryKey: queryKeys.bookmarks.lists()
      })
    },

    onError: (error, variables, context) => {
      logger.error('useBookmarkQueries', '更新书签失败', error)

      // 回滚：恢复之前的数据
      if (context?.previousBookmark) {
        queryClient.setQueryData(queryKeys.bookmarks.detail(variables.id), context.previousBookmark)
      }
    }
  })
}

/**
 * 删除书签的 Mutation
 *
 * @returns Mutation 对象
 *
 * @example
 * ```vue
 * <script setup>
 * const { mutate: deleteBookmark, isPending } = useDeleteBookmark()
 *
 * const handleDelete = (id: string) => {
 *   deleteBookmark(id)
 * }
 * </script>
 * ```
 */
export function useDeleteBookmark() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      logger.info('useBookmarkQueries', `删除书签: ${id}`)
      const result = await bookmarkAppService.deleteBookmark(id)

      if (!result.ok) {
        throw result.error ?? new Error('删除书签失败')
      }

      return id
    },

    onSuccess: deletedId => {
      logger.info('useBookmarkQueries', `书签删除成功: ${deletedId}`)

      // 使相关缓存失效
      queryClient.invalidateQueries({
        queryKey: queryKeys.bookmarks.lists()
      })

      // 移除单个书签的缓存
      queryClient.removeQueries({
        queryKey: queryKeys.bookmarks.detail(deletedId)
      })
    },

    onError: error => {
      logger.error('useBookmarkQueries', '删除书签失败', error)
    }
  })
}
