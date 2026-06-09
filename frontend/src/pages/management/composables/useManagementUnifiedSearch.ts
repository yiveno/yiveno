import { computed, ref, type Ref } from 'vue'
import type { BookmarkNode } from '@/types'
import { searchManagementTrees } from '@/application/bookmark/management-tree-search'
import { logger } from '@/infrastructure/logging/logger'
import {
  applyTreeExpandState,
  collapseManagementTrees,
  type ManagementBookmarkTreeInstance
} from '../utils/management-tree-expand'

export interface ManagementFilterRequestPayload {
  query: string
  activeFilterIds: string[]
}

interface UseManagementUnifiedSearchOptions {
  originalTree: Ref<BookmarkNode[]>
  proposalTreeChildren: Ref<BookmarkNode[]>
  leftTreeRef: Ref<ManagementBookmarkTreeInstance | null>
  rightTreeRef: Ref<ManagementBookmarkTreeInstance | null>
  leftExpandAll: Ref<boolean>
  rightExpandAll: Ref<boolean>
}

/**
 * 整理页顶部共用检索：同步裁剪左右书签树
 */
export function useManagementUnifiedSearch(options: UseManagementUnifiedSearchOptions) {
  const leftSearchResults = ref<BookmarkNode[]>([])
  const rightSearchResults = ref<BookmarkNode[]>([])
  const isLeftSearchActive = ref(false)
  const isRightSearchActive = ref(false)
  const leftMatchCount = ref(0)
  const rightMatchCount = ref(0)
  const isUnifiedSearchFiltering = ref(false)

  const isLeftFiltered = computed(() => isLeftSearchActive.value)
  const isRightFiltered = computed(() => isRightSearchActive.value)

  const isUnifiedSearchActive = computed(() => isLeftFiltered.value || isRightFiltered.value)

  const leftTreeData = computed(() =>
    isLeftSearchActive.value ? leftSearchResults.value : options.originalTree.value
  )

  const rightTreeData = computed(() =>
    isRightSearchActive.value ? rightSearchResults.value : options.proposalTreeChildren.value
  )

  async function applyTreesAfterSearch(
    leftTree: BookmarkNode[],
    rightTree: BookmarkNode[],
    leftFiltered: boolean,
    rightFiltered: boolean,
    leftCount: number,
    rightCount: number
  ): Promise<void> {
    leftSearchResults.value = leftTree
    rightSearchResults.value = rightTree
    isLeftSearchActive.value = leftFiltered
    isRightSearchActive.value = rightFiltered
    leftMatchCount.value = leftCount
    rightMatchCount.value = rightCount

    await Promise.all([
      applyTreeExpandState(options.leftTreeRef, options.leftExpandAll, {
        isFiltered: leftFiltered,
        hasMatches: leftCount > 0
      }),
      applyTreeExpandState(options.rightTreeRef, options.rightExpandAll, {
        isFiltered: rightFiltered,
        hasMatches: rightCount > 0
      })
    ])
  }

  async function handleFilterRequest(payload: ManagementFilterRequestPayload): Promise<void> {
    const trimmedQuery = payload.query.trim()
    const hasTraitFilters = payload.activeFilterIds.length > 0

    if (!trimmedQuery && !hasTraitFilters) {
      await clearUnifiedSearch()
      return
    }

    isUnifiedSearchFiltering.value = true

    try {
      const result = await searchManagementTrees({
        query: trimmedQuery,
        traitFilterIds: payload.activeFilterIds,
        originalTree: options.originalTree.value,
        proposalTree: options.proposalTreeChildren.value
      })

      await applyTreesAfterSearch(
        result.leftTree,
        result.rightTree,
        result.isLeftFiltered,
        result.isRightFiltered,
        result.leftMatchCount,
        result.rightMatchCount
      )

      logger.info('ManagementUnifiedSearch', '双树检索完成', {
        query: trimmedQuery,
        traitFilters: payload.activeFilterIds,
        left: result.leftMatchCount,
        right: result.rightMatchCount
      })
    } catch (error) {
      logger.error('ManagementUnifiedSearch', '双树检索失败', error)
      await clearUnifiedSearch()
    } finally {
      isUnifiedSearchFiltering.value = false
    }
  }

  async function clearUnifiedSearch(): Promise<void> {
    leftSearchResults.value = []
    rightSearchResults.value = []
    isLeftSearchActive.value = false
    isRightSearchActive.value = false
    leftMatchCount.value = 0
    rightMatchCount.value = 0

    await collapseManagementTrees(
      options.leftTreeRef,
      options.rightTreeRef,
      options.leftExpandAll,
      options.rightExpandAll
    )
  }

  return {
    leftTreeData,
    rightTreeData,
    leftMatchCount,
    rightMatchCount,
    isLeftFiltered,
    isRightFiltered,
    isUnifiedSearchActive,
    isUnifiedSearchFiltering,
    handleFilterRequest,
    clearUnifiedSearch
  }
}
