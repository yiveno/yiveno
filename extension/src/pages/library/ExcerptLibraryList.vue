<script setup lang="ts">
import { computed, onMounted, onUnmounted, shallowRef } from 'vue'

import {
  buildExcerptLibraryRowMetrics,
  getExcerptLibraryRowStride
} from '@/core/memory/library-excerpt-virtual-list'
import { resolveBookmarkLibraryVisibleSlice } from '@/core/memory/bookmark-library-virtual-list'
import { t } from '@/infrastructure/i18n/t'
import AppIconButton from '@/infrastructure/ui/AppIconButton.vue'
import AppLibraryItemCard from '@/infrastructure/ui/AppLibraryItemCard.vue'
import AppLibraryItemFavicon from '@/infrastructure/ui/AppLibraryItemFavicon.vue'
import AppIcon from '@/infrastructure/ui/icons/AppIcon.vue'
import type { ExcerptLibraryListRow } from '@/pages/library/library-excerpt-list-rows'
import { createLibraryVirtualScrollHandler } from '@/pages/library/use-library-virtual-scroll'

defineOptions({ name: 'ExcerptLibraryList' })

const props = defineProps<{
  rows: readonly ExcerptLibraryListRow[]
  detailExportMode: boolean
  selectedDetailExportIds: Set<string>
  /** 多选变更时递增，配合 v-memo 避免无关行重绘。 */
  detailExportSelectionRevision: number
  deletingId: string | null
}>()

const emit = defineEmits<{
  activate: [event: MouseEvent | KeyboardEvent, row: ExcerptLibraryListRow]
  editNote: [
    payload: {
      memoryItemId: string
      title: string
      note: string
    }
  ]
  deleteExcerpt: [memoryItemId: string]
}>()

const VIRTUAL_OVERSCAN = 8

const scrollContainerRef = shallowRef<HTMLElement | null>(null)
const scrollTop = shallowRef(0)
const viewportHeight = shallowRef(480)

const hasNoteFlags = computed(() => props.rows.map(row => Boolean(row.note)))

const rowMetrics = computed(() => buildExcerptLibraryRowMetrics(hasNoteFlags.value))

const visibleSlice = computed(() =>
  resolveBookmarkLibraryVisibleSlice(
    rowMetrics.value,
    props.rows.length,
    scrollTop.value,
    viewportHeight.value,
    VIRTUAL_OVERSCAN
  )
)

const renderedRows = computed(() =>
  props.rows.slice(visibleSlice.value.start, visibleSlice.value.end)
)

const handleScroll = createLibraryVirtualScrollHandler(scrollTop)

let resizeObserver: ResizeObserver | null = null

onMounted(() => {
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

function excerptRowStyle(row: ExcerptLibraryListRow): { height: string } {
  return { height: `${getExcerptLibraryRowStride(Boolean(row.note))}px` }
}

function isDetailExportSelected(id: string): boolean {
  return props.selectedDetailExportIds.has(id)
}

function excerptRowMemoDeps(row: ExcerptLibraryListRow): unknown[] {
  return [
    row.id,
    row.savedAtLabel,
    row.note,
    row.excerpt,
    row.title,
    props.detailExportMode,
    props.detailExportSelectionRevision,
    isDetailExportSelected(row.id),
    props.deletingId === row.id
  ]
}
</script>

<template>
  <div
    ref="scrollContainerRef"
    class="excerpt-library-scroll"
    role="list"
    :aria-label="t('library_tab_excerpts')"
    @scroll="handleScroll"
  >
    <div class="excerpt-library-spacer" :style="{ height: `${rowMetrics.totalHeight}px` }">
      <div
        class="excerpt-library-window"
        :style="{ transform: `translateY(${visibleSlice.paddingTop}px)` }"
      >
        <div
          v-for="row in renderedRows"
          :key="row.id"
          v-memo="excerptRowMemoDeps(row)"
          class="excerpt-library-item"
          role="listitem"
          :style="excerptRowStyle(row)"
        >
          <AppLibraryItemCard
            :href="row.href"
            :detail-export-active="detailExportMode"
            :detail-export-selected="isDetailExportSelected(row.id)"
            fill-height
            @activate="emit('activate', $event, row)"
          >
            <template v-if="row.sourceUrl" #leading>
              <AppLibraryItemFavicon :page-url="row.sourceUrl" fallback-icon="format_quote" />
            </template>
            <template #title>
              <p v-if="row.excerpt" class="lib-item-body">{{ row.excerpt }}</p>
              <p v-else-if="row.title" class="lib-item-title">{{ row.title }}</p>
            </template>
            <template v-if="row.note" #note>
              <p class="lib-item-note">
                <span class="lib-item-note-label">{{ t('detail_note_label') }}</span>
                {{ row.note }}
              </p>
            </template>
            <template #footer>
              <p class="lib-item-subtitle">{{ row.subtitle }}</p>
            </template>
            <template #time>
              <p class="lib-item-time">{{ row.savedAtLabel }}</p>
            </template>
            <template #actions>
              <AppIconButton
                type="button"
                :title="row.note ? t('library_edit_note_aria') : t('library_add_note_aria')"
                :aria-label="row.note ? t('library_edit_note_aria') : t('library_add_note_aria')"
                @click="
                  emit('editNote', {
                    memoryItemId: row.id,
                    title: row.title || row.excerpt || row.subtitle,
                    note: row.note ?? ''
                  })
                "
              >
                <AppIcon name="edit_note" size="20px" />
              </AppIconButton>
              <AppIconButton
                type="button"
                tone="danger"
                :title="t('library_delete_excerpt_aria')"
                :aria-label="t('library_delete_excerpt_aria')"
                :disabled="deletingId === row.id"
                @click="emit('deleteExcerpt', row.id)"
              >
                <AppIcon name="delete" size="20px" />
              </AppIconButton>
            </template>
          </AppLibraryItemCard>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.excerpt-library-scroll {
  --library-list-row-gap: var(--space-xs);

  flex: 1;
  min-height: 0;
  overflow: auto;
  overscroll-behavior: contain;
}

.excerpt-library-spacer {
  position: relative;
  width: 100%;
}

.excerpt-library-window {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
}

.excerpt-library-item {
  box-sizing: border-box;
  min-width: 0;

  /* 与书签树 .tree-row 一致：stride 含 gap，padding 留缝，卡片不填满间距 */
  padding-bottom: var(--library-list-row-gap, var(--space-xs));
  content-visibility: auto;
  contain-intrinsic-size: auto 80px;
}
</style>
