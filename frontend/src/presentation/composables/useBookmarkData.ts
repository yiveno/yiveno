/**
 * 使用书签数据的组合式函数
 *
 * 提供响应式的书签数据管理，包括加载状态、错误处理等
 */

import { ref, computed, type Ref } from 'vue'
import { bookmarkPresentationAdapter } from '@/presentation/adapters/bookmark-adapter'
import type { BookmarkRecord } from '@/infrastructure/indexeddb/types'

/**
 * 书签数据状态
 */
export interface BookmarkDataState {
  /** 书签列表 */
  bookmarks: Ref<BookmarkRecord[]>
  /** 加载状态 */
  loading: Ref<boolean>
  /** 错误信息 */
  error: Ref<Error | null>
  /** 是否有书签 */
  hasBookmarks: Ref<boolean>
  /** 书签数量 */
  count: Ref<number>
  /** 加载书签 */
  loadBookmarks: () => Promise<void>
  /** 刷新书签 */
  refresh: () => Promise<void>
}

/**
 * 使用书签数据的组合式函数
 *
 * @example
 * ```typescript
 * const { bookmarks, loading, error, loadBookmarks } = useBookmarkData()
 *
 * // 加载书签
 * await loadBookmarks()
 *
 * // 在模板中使用
 * <div v-if="loading">加载中...</div>
 * <div v-else-if="error">错误: {{ error.message }}</div>
 * <div v-else>
 *   {{ bookmarks.length }} 个书签
 * </div>
 * ```
 */
export function useBookmarkData(): BookmarkDataState {
  const bookmarks = ref<BookmarkRecord[]>([])
  const loading = ref(false)
  const error = ref<Error | null>(null)

  const hasBookmarks = computed(() => bookmarks.value.length > 0)
  const count = computed(() => bookmarks.value.length)

  /**
   * 加载书签
   */
  const loadBookmarks = async (): Promise<void> => {
    loading.value = true
    error.value = null

    const result = await bookmarkPresentationAdapter.getBookmarks()
    bookmarks.value = result.data || []
    error.value = result.error
    loading.value = false
  }

  /**
   * 刷新书签（重新加载）
   */
  const refresh = async (): Promise<void> => {
    await loadBookmarks()
  }

  return {
    bookmarks,
    loading,
    error,
    hasBookmarks,
    count,
    loadBookmarks,
    refresh
  }
}

/**
 * 使用单个书签的组合式函数
 *
 * @param id - 书签 ID
 * @example
 * ```typescript
 * const { bookmark, loading, error, loadBookmark } = useBookmark('123')
 * await loadBookmark()
 * ```
 */
export function useBookmark(id: Ref<string> | string) {
  const bookmark = ref<BookmarkRecord | null>(null)
  const loading = ref(false)
  const error = ref<Error | null>(null)

  const loadBookmark = async (): Promise<void> => {
    const bookmarkId = typeof id === 'string' ? id : id.value
    if (!bookmarkId) {
      error.value = new Error('Bookmark ID is required')
      return
    }

    loading.value = true
    error.value = null

    const result = await bookmarkPresentationAdapter.getBookmarkById(bookmarkId)
    bookmark.value = result.data || null
    error.value = result.error
    loading.value = false
  }

  return {
    bookmark,
    loading,
    error,
    loadBookmark
  }
}
