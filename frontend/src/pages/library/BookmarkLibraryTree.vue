<script setup lang="ts">
import { computed, markRaw, onMounted, onUnmounted, shallowRef, watch } from 'vue'

import type { BookmarkLibraryIndex } from '@/core/memory/bookmark-library-index'
import {
  buildBookmarkLibraryNodeMap,
  collectDefaultExpandedFolderIdsFromIndex,
  flattenBookmarkLibraryVisibleRows
} from '@/core/memory/bookmark-library-index'
import {
  buildBookmarkLibraryRowMetrics,
  resolveBookmarkLibraryVisibleSlice
} from '@/core/memory/bookmark-library-virtual-list'
import {
  readBookmarkLibraryTreeExpandedSession,
  schedulePersistBookmarkLibraryTreeExpanded
} from '@/pages/library/bookmark-library-tree-expanded'
import BookmarkLibraryTreeRow from '@/pages/library/BookmarkLibraryTreeRow.vue'
import { createLibraryVirtualScrollHandler } from '@/pages/library/use-library-virtual-scroll'

defineOptions({ name: 'BookmarkLibraryTree' })

const props = defineProps<{
  index: BookmarkLibraryIndex
  /** 全量导入完成后才展示「未同步」 */
  showUnsyncedFlags?: boolean
  /** detail export 多选 id 集合 */
  selectedDetailExportIds?: Set<string>
  /** 为 true 时书签行进入 detail export 多选（点行切换） */
  showDetailExportSelection?: boolean
  /** 多选 revision，配合 v-memo 减少无关行重绘。 */
  detailExportSelectionRevision?: number
}>()

defineEmits<{
  editNote: [
    payload: {
      memoryItemId: string
      title: string
      note: string
    }
  ]
  openBookmark: [
    payload: {
      url: string
      navigate: boolean
      memoryItemId?: string
    }
  ]
  toggleDetailExportSelection: [memoryItemId: string]
}>()

const VIRTUAL_OVERSCAN = 8

const expandedFolderIds = shallowRef<Set<string> | null>(null)
const scrollContainerRef = shallowRef<HTMLElement | null>(null)
const scrollTop = shallowRef(0)
const viewportHeight = shallowRef(480)

const nodeById = computed(() => buildBookmarkLibraryNodeMap(props.index))

const visibleRows = computed(() =>
  flattenBookmarkLibraryVisibleRows(props.index, nodeById.value, expandedFolderIds.value)
)

const rowMetrics = computed(() => buildBookmarkLibraryRowMetrics(visibleRows.value))

const visibleSlice = computed(() =>
  resolveBookmarkLibraryVisibleSlice(
    rowMetrics.value,
    visibleRows.value.length,
    scrollTop.value,
    viewportHeight.value,
    VIRTUAL_OVERSCAN
  )
)

const renderedRows = computed(() =>
  visibleRows.value.slice(visibleSlice.value.start, visibleSlice.value.end)
)

let resizeObserver: ResizeObserver | null = null

onMounted(async () => {
  expandedFolderIds.value = await readBookmarkLibraryTreeExpandedSession()

  const container = scrollContainerRef.value
  if (!container) {
    return
  }

  viewportHeight.value = container.clientHeight
  resizeObserver = new ResizeObserver(entries => {
    const entry = entries[0]
    if (entry) {
      viewportHeight.value = entry.contentRect.height
    }
  })
  resizeObserver.observe(container)
})

onUnmounted(() => {
  resizeObserver?.disconnect()
  resizeObserver = null
})

watch(
  () => props.index,
  rawIndex => {
    markRaw(rawIndex)
  },
  { immediate: true }
)

function isFolderExpanded(chromeId: string, depth: number): boolean {
  const expanded = expandedFolderIds.value
  if (expanded === null) {
    return depth < 1
  }
  return expanded.has(chromeId)
}

function toggleFolder(chromeId: string, depth: number): void {
  const node = nodeById.value.get(chromeId)
  if (!node || node.kind !== 'folder') {
    return
  }

  let next = expandedFolderIds.value
  if (next === null) {
    next = collectDefaultExpandedFolderIdsFromIndex(props.index, nodeById.value)
  }

  const currentlyExpanded = isFolderExpanded(chromeId, depth)
  if (currentlyExpanded) {
    next.delete(chromeId)
  } else {
    next.add(chromeId)
  }

  expandedFolderIds.value = new Set(next)
  schedulePersistBookmarkLibraryTreeExpanded(expandedFolderIds.value)
}

const handleScroll = createLibraryVirtualScrollHandler(scrollTop)

function bookmarkRowMemoDeps(row: (typeof renderedRows.value)[number]): unknown[] {
  const exportSelected =
    row.kind === 'bookmark' && row.memoryItemId
      ? props.selectedDetailExportIds?.has(row.memoryItemId) === true
      : false
  return [
    row.kind,
    row.chromeId,
    row.depth,
    props.showDetailExportSelection === true,
    props.detailExportSelectionRevision ?? 0,
    exportSelected,
    row.kind === 'bookmark' && !row.memoryItemId
  ]
}
</script>

<template>
  <div ref="scrollContainerRef" class="bookmark-tree-scroll" role="tree" @scroll="handleScroll">
    <div class="bookmark-tree-spacer" :style="{ height: `${rowMetrics.totalHeight}px` }">
      <div
        class="bookmark-tree-window"
        :style="{ transform: `translateY(${visibleSlice.paddingTop}px)` }"
      >
        <BookmarkLibraryTreeRow
          v-for="row in renderedRows"
          :key="`${row.kind}-${row.chromeId}`"
          v-memo="bookmarkRowMemoDeps(row)"
          :row="row"
          :show-unsynced-flags="showUnsyncedFlags"
          :show-detail-export-selection="showDetailExportSelection === true"
          :detail-export-selected="
            row.kind === 'bookmark' && row.memoryItemId
              ? selectedDetailExportIds?.has(row.memoryItemId) === true
              : false
          "
          :detail-export-selection-disabled="row.kind === 'bookmark' && !row.memoryItemId"
          @toggle-folder="toggleFolder"
          @edit-note="$emit('editNote', $event)"
          @open-bookmark="$emit('openBookmark', $event)"
          @toggle-detail-export-selection="$emit('toggleDetailExportSelection', $event)"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.bookmark-tree-scroll {
  --library-list-row-gap: var(--space-xs);
  flex: 1;
  min-height: 0;
  overflow: auto;
  overscroll-behavior: contain;
}

.bookmark-tree-spacer {
  position: relative;
  width: 100%;
}

.bookmark-tree-window {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
}
</style>
