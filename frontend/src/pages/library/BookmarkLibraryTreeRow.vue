<script setup lang="ts">
import { computed, ref } from 'vue'
import AppIconButton from '@/infrastructure/ui/AppIconButton.vue'

import type { BookmarkLibraryVisibleRow } from '@/core/memory/bookmark-library-index'
import { getBookmarkLibraryRowHeight } from '@/core/memory/bookmark-library-index'
import { getChromeFaviconUrl } from '@/infrastructure/browser/chrome-favicon'
import { t } from '@/infrastructure/i18n/t'
import AppIcon from '@/infrastructure/ui/icons/AppIcon.vue'

defineOptions({ name: 'BookmarkLibraryTreeRow' })

const props = defineProps<{
  row: BookmarkLibraryVisibleRow
  showUnsyncedFlags?: boolean
}>()

const emit = defineEmits<{
  toggleFolder: [chromeId: string, depth: number]
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

const faviconBroken = ref(false)

const rowStyle = computed(() => ({
  height: `${getBookmarkLibraryRowHeight(props.row)}px`,
  paddingLeft: `${props.row.depth * 12}px`
}))

const bookmarkTooltip = computed(() => {
  if (props.row.kind !== 'bookmark') {
    return ''
  }
  return props.row.title.trim()
})

const bookmarkFaviconUrl = computed(() => {
  if (props.row.kind !== 'bookmark' || !props.row.url) {
    return ''
  }
  return getChromeFaviconUrl(props.row.url, 32)
})

function handleToggleFolder() {
  if (props.row.kind !== 'folder') {
    return
  }
  emit('toggleFolder', props.row.chromeId, props.row.depth)
}

function handleEditNote(event: Event) {
  event.preventDefault()
  event.stopPropagation()
  if (props.row.kind !== 'bookmark' || !props.row.memoryItemId) {
    return
  }
  emit('editNote', {
    memoryItemId: props.row.memoryItemId,
    title: props.row.title,
    note: props.row.note ?? ''
  })
}

function handleOpenBookmark(event: MouseEvent) {
  if (props.row.kind !== 'bookmark' || !props.row.url) {
    return
  }
  const memoryItemId = props.row.memoryItemId
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
    if (memoryItemId) {
      emit('openBookmark', { url: props.row.url, memoryItemId, navigate: false })
    }
    return
  }
  event.preventDefault()
  emit('openBookmark', {
    url: props.row.url,
    navigate: true,
    ...(memoryItemId ? { memoryItemId } : {})
  })
}
</script>

<template>
  <div class="tree-row" :style="rowStyle">
    <template v-if="row.kind === 'folder'">
      <button
        type="button"
        class="tree-folder"
        :aria-expanded="row.expanded === true"
        @click="handleToggleFolder"
      >
        <span class="tree-chevron" aria-hidden="true">
          <AppIcon :name="row.expanded ? 'expand_more' : 'chevron_right'" size="18px" />
        </span>
        <span class="tree-icon tree-icon--folder" aria-hidden="true">
          <AppIcon :name="row.expanded ? 'folder_open' : 'folder'" size="20px" />
        </span>
        <span class="tree-folder-title">{{ row.title }}</span>
      </button>
    </template>

    <div v-else class="tree-bookmark-row">
      <a
        class="tree-bookmark"
        :href="row.url"
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
            <span class="tree-bookmark-title">{{ row.title }}</span>
            <span v-if="showUnsyncedFlags && !row.memoryItemId" class="tree-bookmark-flag">{{
              t('library_bookmark_unsynced')
            }}</span>
          </span>
          <span v-if="row.note" class="tree-bookmark-note">
            <span class="tree-bookmark-note-label">{{ t('detail_note_label') }}</span>
            {{ row.note }}
          </span>
        </span>
      </a>
      <AppIconButton
        v-if="row.memoryItemId"
        type="button"
        class="tree-bookmark-note-btn"
        :title="row.note ? t('library_edit_note_aria') : t('library_add_note_aria')"
        :aria-label="row.note ? t('library_edit_note_aria') : t('library_add_note_aria')"
        @click="handleEditNote"
      >
        <AppIcon name="edit_note" size="20px" />
      </AppIconButton>
    </div>
  </div>
</template>

<style scoped>
.tree-row {
  box-sizing: border-box;
  overflow: hidden;
}

.tree-folder {
  display: flex;
  align-items: center;
  gap: var(--space-2xs);
  width: 100%;
  height: 100%;
  margin: 0;
  padding: 0 var(--space-xs) 0 0;
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
  display: flex;
  align-items: center;
  gap: 2px;
  width: 100%;
  height: 100%;
}

.tree-bookmark {
  display: flex;
  align-items: center;
  gap: var(--space-2xs);
  flex: 1;
  min-width: 0;
  height: 100%;
  margin: 0;
  padding: 0 var(--space-xs) 0 0;
  border: none;
  border-radius: var(--radius-sm);
  text-align: left;
  text-decoration: none;
  color: inherit;
  background: transparent;
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
  flex-shrink: 0;
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
  font-size: 14px;
  font-weight: 500;
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
  font-size: 12px;
  line-height: 1.35;
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
</style>
