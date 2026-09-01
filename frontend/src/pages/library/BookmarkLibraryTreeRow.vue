<script setup lang="ts">
import { computed } from 'vue'
import AppIconButton from '@/infrastructure/ui/AppIconButton.vue'

import type { BookmarkLibraryVisibleRow } from '@/core/memory/bookmark-library-index'
import { getBookmarkLibraryRowStride } from '@/core/memory/bookmark-library-index'
import { extractDomainFromUrl } from '@/core/memory/payload'
import { formatLibrarySavedAt } from '@/infrastructure/i18n/format-library-saved-at'
import { t } from '@/infrastructure/i18n/t'
import AppLibraryItemCard from '@/infrastructure/ui/AppLibraryItemCard.vue'
import AppLibraryItemFavicon from '@/infrastructure/ui/AppLibraryItemFavicon.vue'
import AppIcon from '@/infrastructure/ui/icons/AppIcon.vue'

defineOptions({ name: 'BookmarkLibraryTreeRow' })

const props = defineProps<{
  row: BookmarkLibraryVisibleRow
  showUnsyncedFlags?: boolean
  detailExportSelected?: boolean
  detailExportSelectionDisabled?: boolean
  /** 为 true 时点书签行切换 detail export 选中 */
  showDetailExportSelection?: boolean
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
  toggleDetailExportSelection: [memoryItemId: string]
}>()

const rowStyle = computed(() => ({
  height: `${getBookmarkLibraryRowStride(props.row)}px`,
  paddingLeft: `${props.row.depth * 12}px`
}))

const bookmarkTooltip = computed(() => {
  if (props.row.kind !== 'bookmark') {
    return ''
  }
  return props.row.title.trim()
})

const bookmarkDomain = computed(() => {
  if (props.row.kind !== 'bookmark' || !props.row.url) {
    return ''
  }
  try {
    return extractDomainFromUrl(props.row.url)
  } catch {
    return props.row.url
  }
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

function handleBookmarkActivate(event: MouseEvent | KeyboardEvent) {
  if (props.row.kind !== 'bookmark' || !props.row.url) {
    return
  }

  const memoryItemId = props.row.memoryItemId
  if (props.showDetailExportSelection && memoryItemId) {
    event.preventDefault()
    if (props.detailExportSelectionDisabled === true) {
      return
    }
    emit('toggleDetailExportSelection', memoryItemId)
    return
  }

  if (event instanceof KeyboardEvent) {
    event.preventDefault()
    emit('openBookmark', {
      url: props.row.url,
      navigate: true,
      ...(memoryItemId ? { memoryItemId } : {})
    })
    return
  }

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
  <div
    class="tree-row"
    :class="row.kind === 'bookmark' ? 'tree-row--bookmark' : 'tree-row--folder'"
    :style="rowStyle"
  >
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

    <AppLibraryItemCard
      v-else
      fill-height
      :href="row.url"
      :link-title="bookmarkTooltip"
      :detail-export-active="showDetailExportSelection === true"
      :detail-export-selected="detailExportSelected === true"
      @activate="handleBookmarkActivate"
    >
      <template v-if="row.url" #leading>
        <AppLibraryItemFavicon :page-url="row.url" fallback-icon="bookmark" />
      </template>
      <template #title>
        <span class="lib-item-title-with-flag">
          <span class="lib-item-title lib-item-title--single-line">{{ row.title }}</span>
          <span v-if="showUnsyncedFlags && !row.memoryItemId" class="lib-item-flag">{{
            t('library_bookmark_unsynced')
          }}</span>
        </span>
      </template>
      <template v-if="row.note" #note>
        <p class="lib-item-note">
          <span class="lib-item-note-label">{{ t('detail_note_label') }}</span>
          {{ row.note }}
        </p>
      </template>
      <template v-if="bookmarkDomain" #footer>
        <p class="lib-item-subtitle">{{ bookmarkDomain }}</p>
      </template>
      <template v-if="row.savedAt" #time>
        <p class="lib-item-time">{{ formatLibrarySavedAt(row.savedAt) }}</p>
      </template>
      <template v-if="row.memoryItemId" #actions>
        <AppIconButton
          type="button"
          :title="row.note ? t('library_edit_note_aria') : t('library_add_note_aria')"
          :aria-label="row.note ? t('library_edit_note_aria') : t('library_add_note_aria')"
          @click="handleEditNote"
        >
          <AppIcon name="edit_note" size="20px" />
        </AppIconButton>
      </template>
    </AppLibraryItemCard>
  </div>
</template>

<style scoped>
.tree-row {
  box-sizing: border-box;
  padding-bottom: var(--library-list-row-gap, var(--space-xs));
  overflow: visible;
  content-visibility: auto;
  contain-intrinsic-size: auto 80px;
}

.tree-row--folder {
  display: flex;
  align-items: flex-start;
}

.tree-row--bookmark {
  display: block;
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

.tree-folder-title {
  min-width: 0;
  font-size: 14px;
  font-weight: 600;
  line-height: 1.35;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
