<script setup lang="ts">
import { onMounted, provide, shallowRef } from 'vue'

import type { BookmarkLibraryTreeNode } from '@/core/memory/bookmark-library-tree'
import { bookmarkLibraryTreeContextKey } from '@/pages/library/bookmark-library-tree-context'
import {
  collectDefaultExpandedFolderIds,
  readBookmarkLibraryTreeExpandedSession,
  schedulePersistBookmarkLibraryTreeExpanded
} from '@/pages/library/bookmark-library-tree-expanded'
import BookmarkLibraryTreeNodeView from '@/pages/library/BookmarkLibraryTreeNodeView.vue'

defineOptions({ name: 'BookmarkLibraryTree' })

const props = defineProps<{
  roots: BookmarkLibraryTreeNode[]
  /** 全量导入完成后才展示「未同步」 */
  showUnsyncedFlags?: boolean
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
}>()

/**
 * null = 尚未从 session 恢复，沿用 depth<1 默认展开；
 * Set = 用户/session 明确记录的展开文件夹集合。
 */
const expandedFolderIds = shallowRef<Set<string> | null>(null)

onMounted(async () => {
  expandedFolderIds.value = await readBookmarkLibraryTreeExpandedSession()
})

function isFolderExpanded(chromeId: string, depth: number): boolean {
  const expanded = expandedFolderIds.value
  if (expanded === null) {
    return depth < 1
  }
  return expanded.has(chromeId)
}

function toggleFolder(chromeId: string, depth: number): void {
  let next = expandedFolderIds.value
  if (next === null) {
    next = collectDefaultExpandedFolderIds(props.roots)
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

provide(bookmarkLibraryTreeContextKey, {
  expandedFolderIds,
  toggleFolder
})
</script>

<template>
  <ul v-if="roots.length > 0" class="bookmark-tree" role="tree">
    <BookmarkLibraryTreeNodeView
      v-for="node in roots"
      :key="`${node.kind}-${node.chromeId}`"
      :node="node"
      :depth="0"
      :show-unsynced-flags="showUnsyncedFlags"
      @edit-note="$emit('editNote', $event)"
      @open-bookmark="$emit('openBookmark', $event)"
    />
  </ul>
</template>

<style scoped>
.bookmark-tree {
  display: grid;
  gap: var(--space-xs);
  margin: 0;
  padding: 0;
  list-style: none;
}
</style>
