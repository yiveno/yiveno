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

/** 顶层文件夹默认展开（勿在 setup 根读取 props 字段进 ref 初值，以免失去响应性）。 */
const expanded = ref(false)

watch(
  () => ({ kind: props.node.kind, depth: props.depth }),
  ({ kind, depth }) => {
    if (kind === 'folder') {
      expanded.value = depth < 1
    }
  },
  { immediate: true }
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
  margin: 0;
  list-style: none;
}

.tree-folder,
.tree-bookmark {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  margin: 0;
  padding: 7px 10px;
  border: none;
  border-radius: var(--radius-sm);
  text-align: left;
  color: var(--on-surface);
  background: transparent;
  cursor: pointer;
  font: inherit;
}

.tree-bookmark-row {
  display: flex;
  align-items: flex-start;
  gap: 2px;
}

.tree-bookmark {
  flex: 1;
  justify-content: space-between;
  min-width: 0;
  text-decoration: none;
  color: inherit;
  cursor: pointer;
}

.tree-bookmark:hover,
.tree-folder:hover {
  background: var(--surface-chrome);
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
  justify-content: center;
  align-items: center;
  width: 18px;
  height: 18px;
  color: var(--on-surface-muted);
}

.tree-chevron--spacer {
  visibility: hidden;
}

.tree-icon {
  display: inline-flex;
  flex-shrink: 0;
  color: var(--accent);
}

.tree-icon--folder {
  color: var(--sage-dark);
}

.tree-folder-title,
.tree-bookmark-title {
  min-width: 0;
  font-size: 14px;
  line-height: 1.35;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tree-bookmark-leading {
  display: flex;
  flex: 1;
  align-items: flex-start;
  gap: 6px;
  min-width: 0;
}

.tree-bookmark-copy {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.tree-bookmark-note {
  display: -webkit-box;
  font-size: 12px;
  line-height: 1.35;
  color: var(--on-surface);
  overflow: hidden;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.tree-bookmark-note-label {
  margin-right: 4px;
  font-weight: 600;
  color: var(--accent);
}

.tree-bookmark-meta {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 8px;
  margin-left: 8px;
}

.tree-bookmark-host {
  max-width: 140px;
  font-size: 12px;
  white-space: nowrap;
  color: var(--on-surface-muted);
  overflow: hidden;
  text-overflow: ellipsis;
}

.tree-bookmark-flag {
  font-size: 11px;
  font-weight: 600;
  color: var(--sage-dark);
}

.tree-children {
  margin: 0;
  padding: 0 0 0 12px;
  list-style: none;
}
</style>
