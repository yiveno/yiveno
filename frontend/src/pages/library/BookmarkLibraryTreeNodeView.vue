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
    /** 全量导入完成后才展示「未同步」 */
    showUnsyncedFlags?: boolean
  }>(),
  {
    depth: 0,
    showUnsyncedFlags: false
  }
)

const emit = defineEmits<{
  editNote: [
    payload: {
      memoryItemId: string
      title: string
      note: string
    }
  ]
  /** 打开书签：navigate=true 时由父级 window.open；否则仅写回。 */
  openBookmark: [
    payload: {
      url: string
      navigate: boolean
      memoryItemId?: string
    }
  ]
}>()

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

function handleEditNote(event: Event) {
  event.preventDefault()
  event.stopPropagation()
  if (props.node.kind !== 'bookmark' || !props.node.memoryItemId) {
    return
  }
  emit('editNote', {
    memoryItemId: props.node.memoryItemId,
    title: props.node.title,
    note: props.node.note ?? ''
  })
}

function handleOpenBookmark(event: MouseEvent) {
  if (props.node.kind !== 'bookmark') {
    return
  }
  const memoryItemId = props.node.memoryItemId
  // 中键 / 修饰键：浏览器自己开链；仍通知父级写回（若有 id）
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
    if (memoryItemId) {
      emit('openBookmark', { url: props.node.url, memoryItemId, navigate: false })
    }
    return
  }
  event.preventDefault()
  emit('openBookmark', {
    url: props.node.url,
    navigate: true,
    ...(memoryItemId ? { memoryItemId } : {})
  })
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
          :show-unsynced-flags="showUnsyncedFlags"
          @edit-note="emit('editNote', $event)"
          @open-bookmark="emit('openBookmark', $event)"
        />
      </ul>
    </template>

    <div v-else class="tree-bookmark-row">
      <a
        class="tree-bookmark"
        :href="node.url"
        target="_blank"
        rel="noopener noreferrer"
        @click="handleOpenBookmark"
      >
        <span class="tree-bookmark-leading">
          <span class="tree-chevron tree-chevron--spacer" aria-hidden="true"></span>
          <span class="tree-icon tree-icon--bookmark" aria-hidden="true">
            <MaterialSymbolIcon name="bookmark" size="20px" />
          </span>
          <span class="tree-bookmark-copy">
            <span class="tree-bookmark-title">{{ node.title }}</span>
            <span v-if="node.note" class="tree-bookmark-note">
              <span class="tree-bookmark-note-label">{{ t('detail_note_label') }}</span>
              {{ node.note }}
            </span>
          </span>
        </span>
        <span class="tree-bookmark-meta">
          <span v-if="showUnsyncedFlags && !node.memoryItemId" class="tree-bookmark-flag">{{
            t('library_bookmark_unsynced')
          }}</span>
          <span class="tree-bookmark-host" :title="node.url">{{ hostnameOf(node.url) }}</span>
        </span>
      </a>
      <md-icon-button
        v-if="node.memoryItemId"
        type="button"
        class="tree-bookmark-note-btn"
        :title="node.note ? t('library_edit_note_aria') : t('library_add_note_aria')"
        :aria-label="node.note ? t('library_edit_note_aria') : t('library_add_note_aria')"
        @click="handleEditNote"
      >
        <MaterialSymbolIcon name="edit_note" size="20px" />
      </md-icon-button>
    </div>
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

.tree-bookmark-row {
  display: flex;
  gap: 2px;
  align-items: flex-start;
}

.tree-bookmark {
  flex: 1;
  min-width: 0;
  justify-content: space-between;
  text-decoration: none;
  color: inherit;
  cursor: pointer;
}

.tree-bookmark:hover,
.tree-folder:hover {
  background: var(--md-sys-color-surface-container-high);
}

.tree-bookmark-note-btn {
  flex-shrink: 0;
  margin-top: 2px;
  opacity: 0;
}

.tree-bookmark-row:hover .tree-bookmark-note-btn,
.tree-bookmark-row:focus-within .tree-bookmark-note-btn {
  opacity: 1;
}

@media (hover: none) {
  .tree-bookmark-note-btn {
    opacity: 1;
  }
}

.tree-chevron {
  display: inline-flex;
  flex-shrink: 0;
  width: 18px;
  height: 18px;
  align-items: center;
  justify-content: center;
  color: var(--md-sys-color-on-surface-variant);
}

.tree-chevron--spacer {
  visibility: hidden;
}

.tree-icon {
  display: inline-flex;
  flex-shrink: 0;
  color: var(--md-sys-color-primary);
}

.tree-icon--folder {
  color: var(--md-sys-color-tertiary);
}

.tree-folder-title,
.tree-bookmark-title {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 14px;
  line-height: 1.35;
}

.tree-bookmark-leading {
  display: flex;
  gap: 6px;
  align-items: flex-start;
  min-width: 0;
  flex: 1;
}

.tree-bookmark-copy {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.tree-bookmark-note {
  font-size: 12px;
  line-height: 1.35;
  color: var(--md-sys-color-on-surface);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.tree-bookmark-note-label {
  margin-right: 4px;
  font-weight: 600;
  color: var(--md-sys-color-primary);
}

.tree-bookmark-meta {
  display: flex;
  flex-shrink: 0;
  gap: 8px;
  align-items: center;
  margin-left: 8px;
}

.tree-bookmark-host {
  max-width: 140px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  color: var(--md-sys-color-on-surface-variant);
}

.tree-bookmark-flag {
  font-size: 11px;
  font-weight: 600;
  color: var(--md-sys-color-tertiary);
}

.tree-children {
  margin: 0;
  padding: 0 0 0 12px;
  list-style: none;
}
</style>
