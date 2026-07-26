<script setup lang="ts">
import type { BookmarkLibraryTreeNode } from '@/core/memory/bookmark-library-tree'
import BookmarkLibraryTreeNodeView from '@/pages/library/BookmarkLibraryTreeNodeView.vue'

defineOptions({ name: 'BookmarkLibraryTree' })

defineProps<{
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
}>()
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
    />
  </ul>
</template>

<style scoped>
.bookmark-tree {
  display: grid;
  gap: 2px;
  margin: 0;
  padding: 0;
  list-style: none;
}
</style>
