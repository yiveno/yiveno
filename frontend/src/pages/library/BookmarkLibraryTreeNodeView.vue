<script setup lang="ts">
import { ref, watch } from 'vue'

import type { BookmarkLibraryTreeNode } from '@/core/memory/bookmark-library-tree'
import { t } from '@/infrastructure/i18n/t'
import MaterialSymbolIcon from '@/infrastructure/ui/icons/MaterialSymbolIcon.vue'

defineOptions({ name: 'BookmarkLibraryTreeNodeView' })

const props = withDefaults(
  defineProps<{
    node: BookmarkLibraryTreeNode
    depth?: number
  }>(),
  {
    depth: 0
  }
)

/** 顶层文件夹默认展开。 */
const expanded = ref(props.node.kind === 'folder' && props.depth < 1)

watch(
  () => props.node,
  () => {
    if (props.node.kind === 'folder') {
      expanded.value = props.depth < 1
    }
  }
)

function toggleFolder() {
  if (props.node.kind !== 'folder') {
    return
  }
  expanded.value = !expanded.value
}

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname
  } catch {
    return ''
  }
}
</script>

<template>
  <li class="tree-item">
    <template v-if="node.kind === 'folder'">
      <button type="button" class="tree-folder" :aria-expanded="expanded" @click="toggleFolder">
        <span class="tree-chevron" aria-hidden="true">
          <MaterialSymbolIcon :name="expanded ? 'expand_more' : 'chevron_right'" size="18px" />
        </span>
        <span class="tree-icon tree-icon--folder" aria-hidden="true">
          <MaterialSymbolIcon :name="expanded ? 'folder_open' : 'folder'" size="20px" />
        </span>
        <span class="tree-folder-title">{{ node.title }}</span>
      </button>
      <ul v-if="expanded" class="tree-children" role="group">
        <BookmarkLibraryTreeNodeView
          v-for="child in node.children"
          :key="`${child.kind}-${child.chromeId}`"
          :node="child"
          :depth="depth + 1"
        />
      </ul>
    </template>

    <a v-else class="tree-bookmark" :href="node.url" target="_blank" rel="noopener noreferrer">
      <span class="tree-bookmark-leading">
        <span class="tree-chevron tree-chevron--spacer" aria-hidden="true"></span>
        <span class="tree-icon tree-icon--bookmark" aria-hidden="true">
          <MaterialSymbolIcon name="bookmark" size="20px" />
        </span>
        <span class="tree-bookmark-title">{{ node.title }}</span>
      </span>
      <span class="tree-bookmark-meta">
        <span v-if="!node.memoryItemId" class="tree-bookmark-flag">{{
          t('library_bookmark_unsynced')
        }}</span>
        <span class="tree-bookmark-host" :title="node.url">{{ hostnameOf(node.url) }}</span>
      </span>
    </a>
  </li>
</template>

<style scoped>
.tree-item {
  list-style: none;
  margin: 0;
}

.tree-folder,
.tree-bookmark {
  display: flex;
  gap: 6px;
  align-items: center;
  width: 100%;
  margin: 0;
  padding: 7px 10px;
  border: none;
  border-radius: var(--md-sys-shape-corner-small, 8px);
  font: inherit;
  text-align: left;
  color: var(--md-sys-color-on-surface);
  background: transparent;
  cursor: pointer;
}

.tree-bookmark {
  justify-content: space-between;
  text-decoration: none;
  color: inherit;
  cursor: pointer;
}

.tree-folder:hover,
.tree-bookmark:hover {
  background: color-mix(in srgb, var(--md-sys-color-on-surface) 6%, transparent);
}

.tree-chevron {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  color: var(--md-sys-color-on-surface-variant);
}

.tree-chevron--spacer {
  visibility: hidden;
}

.tree-icon {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
}

.tree-icon--folder {
  color: var(--md-sys-color-primary);
}

.tree-icon--bookmark {
  color: var(--md-sys-color-on-surface-variant);
}

.tree-folder-title {
  flex: 1;
  min-width: 0;
  font-size: 14px;
  font-weight: 600;
  line-height: 1.35;
}

.tree-children {
  margin: 0 0 0 12px;
  padding: 2px 0 2px 10px;
  list-style: none;
}

.tree-bookmark-leading {
  display: flex;
  gap: 6px;
  align-items: center;
  min-width: 0;
}

.tree-bookmark-title {
  min-width: 0;
  font-size: 14px;
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tree-bookmark-meta {
  display: flex;
  flex-shrink: 0;
  gap: 8px;
  align-items: center;
  margin-left: 8px;
  font-size: 12px;
  color: var(--md-sys-color-on-surface-variant);
}

.tree-bookmark-flag {
  color: var(--md-sys-color-tertiary);
}

.tree-bookmark-host {
  max-width: 160px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  opacity: 0;
  transition: opacity 120ms cubic-bezier(0.2, 0, 0, 1);
}

.tree-bookmark:hover .tree-bookmark-host,
.tree-bookmark:focus-visible .tree-bookmark-host {
  opacity: 1;
}

@media (hover: none) {
  .tree-bookmark-host {
    opacity: 1;
  }
}

@media (prefers-reduced-motion: reduce) {
  .tree-bookmark-host {
    transition: none;
  }
}
</style>
