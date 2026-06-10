import { computed, ref, type Ref } from 'vue'
import type { BookmarkNode } from '@/types'
import {
  buildFilteredManagementLeftTree,
  buildFilteredManagementRightTree,
  EMPTY_MANAGEMENT_SEARCH_MATCH,
  resolveManagementSearchMatchIds,
  type ManagementSearchMatchState
} from '@/application/bookmark/management-tree-search'
import { countBookmarkLeaves } from '@/core/filter/tree-prune'
import { logger } from '@/infrastructure/logging/logger'
import { applyTreeExpandState, collapseManagementTrees } from '../utils/management-tree-expand'

export interface ManagementFilterRequestPayload {
  query: string
  activeFilterIds: string[]
}

interface UseManagementUnifiedSearchOptions {
  originalTree: Ref<BookmarkNode[]>
  proposalTreeChildren: Ref<BookmarkNode[]>
  leftExpandAll: Ref<boolean>
  rightExpandAll: Ref<boolean>
  setLeftTreeExpanded: (expanded: boolean) => void
  setRightTreeExpanded: (expanded: boolean) => void
}

/**
 * 整理页顶部共用检索：异步解析命中 ID，展示树由 live 数据派生（避免快照过期）
 */
export function useManagementUnifiedSearch(options: UseManagementUnifiedSearchOptions) {
  const searchMatch = ref<ManagementSearchMatchState>({ ...EMPTY_MANAGEMENT_SEARCH_MATCH })
  const isUnifiedSearchFiltering = ref(false)

  const isLeftFiltered = computed(() => searchMatch.value.isTextFilterActive)
  const isRightFiltered = computed(
    () => searchMatch.value.isTextFilterActive || searchMatch.value.hasTraitFilterActive
  )

  const leftTreeData = computed(() =>
    buildFilteredManagementLeftTree(options.originalTree.value, searchMatch.value)
  )

  const rightTreeData = computed(() =>
    buildFilteredManagementRightTree(options.proposalTreeChildren.value, searchMatch.value)
  )

  const leftMatchCount = computed(() =>
    isLeftFiltered.value ? countBookmarkLeaves(leftTreeData.value) : 0
  )

  const rightMatchCount = computed(() =>
    isRightFiltered.value ? countBookmarkLeaves(rightTreeData.value) : 0
  )

  async function applySearchMatchState(match: ManagementSearchMatchState): Promise<void> {
    searchMatch.value = match

    const leftFiltered = match.isTextFilterActive
    const rightFiltered = match.isTextFilterActive || match.hasTraitFilterActive
    const leftCount = leftFiltered
      ? countBookmarkLeaves(buildFilteredManagementLeftTree(options.originalTree.value, match))
      : 0
    const rightCount = rightFiltered
      ? countBookmarkLeaves(
          buildFilteredManagementRightTree(options.proposalTreeChildren.value, match)
        )
      : 0

    await Promise.all([
      applyTreeExpandState(options.leftExpandAll, options.setLeftTreeExpanded, {
        isFiltered: leftFiltered,
        hasMatches: leftCount > 0
      }),
      applyTreeExpandState(options.rightExpandAll, options.setRightTreeExpanded, {
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
      const match = await resolveManagementSearchMatchIds({
        query: trimmedQuery,
        traitFilterIds: payload.activeFilterIds,
        originalTree: options.originalTree.value,
        proposalTree: options.proposalTreeChildren.value
      })

      await applySearchMatchState(match)

      logger.info('ManagementUnifiedSearch', '双树检索完成', {
        query: trimmedQuery,
        traitFilters: payload.activeFilterIds,
        left: leftMatchCount.value,
        right: rightMatchCount.value
      })
    } catch (error) {
      logger.error('ManagementUnifiedSearch', '双树检索失败', error)
      await clearUnifiedSearch()
    } finally {
      isUnifiedSearchFiltering.value = false
    }
  }

  async function clearUnifiedSearch(): Promise<void> {
    searchMatch.value = { ...EMPTY_MANAGEMENT_SEARCH_MATCH }

    await collapseManagementTrees(
      options.setLeftTreeExpanded,
      options.setRightTreeExpanded,
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
    isUnifiedSearchFiltering,
    handleFilterRequest,
    clearUnifiedSearch
  }
}
