<script setup lang="ts">
import { computed, inject, ref, watch } from 'vue'
import AppIconButton from '@/infrastructure/ui/AppIconButton.vue'

import type { BookmarkLibraryTreeNode } from '@/core/memory/bookmark-library-tree'
import { getChromeFaviconUrl } from '@/infrastructure/browser/chrome-favicon'
import { t } from '@/infrastructure/i18n/t'
import AppIcon from '@/infrastructure/ui/icons/AppIcon.vue'
import {
  bookmarkLibraryTreeContextKey,
  resolveBookmarkFolderExpanded
} from '@/pages/library/bookmark-library-tree-context'

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

const treeContext = inject(bookmarkLibraryTreeContextKey)
if (!treeContext) {
  throw new Error('BookmarkLibraryTreeNodeView 必须在 BookmarkLibraryTree 内使用')
}

/** favicon 加载失败时回退通用书签图标。 */
const faviconBroken = ref(false)

watch(
  () => (props.node.kind === 'bookmark' ? props.node.url : ''),
  () => {
    faviconBroken.value = false
  }
)

const folderExpanded = computed(() => {
  if (props.node.kind !== 'folder') {
    return false
  }
  return resolveBookmarkFolderExpanded(
    treeContext.expandedFolderIds.value,
    props.node.chromeId,
    props.depth
  )
})

const bookmarkFaviconUrl = computed(() => {
  if (props.node.kind !== 'bookmark') {
    return ''
  }
  return getChromeFaviconUrl(props.node.url, 32)
})

/** 悬停显示完整标题（链接 URL 由浏览器原生 tooltip 展示）。 */
const bookmarkTooltip = computed(() => {
  if (props.node.kind !== 'bookmark') {
    return ''
  }
  return props.node.title.trim()
})

const bookmarkMemoKey = computed(() => {
  if (props.node.kind !== 'bookmark') {
    return null
  }
  return [
    props.node.chromeId,
    props.node.title,
    props.node.url,
    props.node.note ?? '',
    props.node.memoryItemId ?? '',
    props.showUnsyncedFlags,
    faviconBroken.value
  ] as const
})

function toggleFolder() {
  if (props.node.kind !== 'folder' || !treeContext) {
    return
  }
  treeContext.toggleFolder(props.node.chromeId, props.depth)
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
  <li class="tree-item" :class="{ 'tree-item--bookmark': node.kind === 'bookmark' }">
    <template v-if="node.kind === 'folder'">
      <button
        type="button"
        class="tree-folder"
        :aria-expanded="folderExpanded"
        @click="toggleFolder"
      >
        <span class="tree-chevron" aria-hidden="true">
          <AppIcon :name="folderExpanded ? 'expand_more' : 'chevron_right'" size="18px" />
        </span>
        <span class="tree-icon tree-icon--folder" aria-hidden="true">
          <AppIcon :name="folderExpanded ? 'folder_open' : 'folder'" size="20px" />
        </span>
        <span class="tree-folder-title">{{ node.title }}</span>
      </button>
      <ul v-if="folderExpanded" class="tree-children" role="group">
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

    <div v-else v-memo="bookmarkMemoKey" class="tree-bookmark-row">
      <a
        class="tree-bookmark"
        :href="node.url"
        target="_blank"
        rel="noopener noreferrer"
        :title="bookmarkTooltip"
        @click="handleOpenBookmark"
      >
        <span class="tree-icon tree-icon--bookmark" aria-hidden="true">
          <img
            v-if="!faviconBroken"
            class="tree-favicon"
            :src="bookmarkFaviconUrl"
            alt=""
            width="16"
            height="16"
            loading="lazy"
            decoding="async"
            @error="faviconBroken = true"
          />
          <AppIcon v-else name="bookmark" size="20px" />
        </span>
        <span class="tree-bookmark-copy">
          <span class="tree-bookmark-title-row">
            <span class="tree-bookmark-title">{{ node.title }}</span>
            <span v-if="showUnsyncedFlags && !node.memoryItemId" class="tree-bookmark-flag">{{
              t('library_bookmark_unsynced')
            }}</span>
          </span>
          <span v-if="node.note" class="tree-bookmark-note">
            <span class="tree-bookmark-note-label">{{ t('detail_note_label') }}</span>
            {{ node.note }}
          </span>
        </span>
      </a>
      <AppIconButton
        v-if="node.memoryItemId"
        type="button"
        class="tree-bookmark-note-btn"
        :title="node.note ? t('library_edit_note_aria') : t('library_add_note_aria')"
        :aria-label="node.note ? t('library_edit_note_aria') : t('library_add_note_aria')"
        @click="handleEditNote"
      >
        <AppIcon name="edit_note" size="20px" />
      </AppIconButton>
    </div>
  </li>
</template>

<style scoped>
.tree-item {
  margin: 0;
  list-style: none;
}

.tree-item--bookmark {
  content-visibility: auto;
  contain-intrinsic-size: auto 52px;
}

.tree-folder {
  display: flex;
  align-items: center;
  gap: var(--space-2xs);
  width: 100%;
  margin: 0;
  padding: var(--space-2xs) var(--space-xs);
  border: none;
  border-radius: var(--radius-sm);
  text-align: left;
  color: var(--on-surface);
  background: transparent;
  cursor: pointer;
  font: inherit;
}

.tree-folder:hover {
  background: var(--surface-chrome);
}

.tree-folder:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 2px;
}

.tree-bookmark-row {
  position: relative;
}

.tree-bookmark {
  display: flex;
  align-items: flex-start;
  gap: var(--space-xs);
  width: 100%;
  min-width: 0;
  margin: 0;
  padding: var(--space-sm) 52px var(--space-sm) var(--space-sm);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  text-align: left;
  text-decoration: none;
  color: inherit;
  background: var(--surface);
  cursor: pointer;
  font: inherit;
  transition: background var(--motion-duration-short) var(--motion-easing-standard);
}

.tree-bookmark:hover {
  background: var(--surface-chrome);
}

.tree-bookmark:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 2px;
}

.tree-bookmark-note-btn {
  position: absolute;
  top: var(--space-2xs);
  right: var(--space-2xs);
  z-index: 1;
  color: var(--on-surface-muted);
  opacity: 0;
  pointer-events: none;
  transition: opacity var(--motion-duration-short) var(--motion-easing-standard);
}

.tree-bookmark-row:hover .tree-bookmark-note-btn,
.tree-bookmark-row:focus-within .tree-bookmark-note-btn {
  opacity: 1;
  pointer-events: auto;
}

@media (hover: none) {
  .tree-bookmark-note-btn {
    opacity: 1;
    pointer-events: auto;
  }
}

@media (prefers-reduced-motion: reduce) {
  .tree-bookmark,
  .tree-bookmark-note-btn {
    transition: none;
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

.tree-icon {
  display: inline-flex;
  flex-shrink: 0;
  justify-content: center;
  align-items: center;
  width: 20px;
  height: 20px;
  margin-top: 1px;
  color: var(--accent);
}

.tree-icon--folder {
  color: var(--sage-dark);
}

.tree-favicon {
  display: block;
  width: 16px;
  height: 16px;
  border-radius: var(--radius-xs);
  object-fit: contain;
}

.tree-folder-title {
  min-width: 0;
  font-size: 14px;
  font-weight: 600;
  line-height: 1.35;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tree-bookmark-title {
  min-width: 0;
  font-size: 15px;
  font-weight: 600;
  line-height: 1.35;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tree-bookmark-copy {
  display: grid;
  flex: 1;
  gap: var(--space-2xs);
  min-width: 0;
}

.tree-bookmark-title-row {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  min-width: 0;
}

.tree-bookmark-note {
  display: -webkit-box;
  font-size: 13px;
  line-height: 1.45;
  color: var(--on-surface);
  overflow: hidden;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.tree-bookmark-note-label {
  margin-right: 6px;
  font-weight: 600;
  color: var(--accent);
}

.tree-bookmark-flag {
  flex-shrink: 0;
  font-size: 12px;
  font-weight: 600;
  color: var(--sage-dark);
}

.tree-children {
  display: grid;
  gap: var(--space-xs);
  margin: var(--space-2xs) 0 0;
  padding: 0 0 0 var(--space-sm);
  border-left: 1px solid color-mix(in srgb, var(--border) 70%, transparent);
  list-style: none;
}
</style>
