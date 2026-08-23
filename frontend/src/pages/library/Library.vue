<script setup lang="ts">
import { computed, markRaw, onMounted, onUnmounted, ref, shallowRef, useId, watch } from 'vue'
import AppButton from '@/infrastructure/ui/AppButton.vue'
import AppIconButton from '@/infrastructure/ui/AppIconButton.vue'
import AppModal from '@/infrastructure/ui/AppModal.vue'
import AppConfirmModal from '@/infrastructure/ui/AppConfirmModal.vue'
import AppSectionTabs from '@/infrastructure/ui/AppSectionTabs.vue'
import AppTextarea from '@/infrastructure/ui/AppTextarea.vue'

import type { BookmarkLibraryIndex } from '@/core/memory/bookmark-library-index'
import {
  computeBookmarkLibraryStructureHash,
  patchBookmarkNoteInIndex
} from '@/core/memory/bookmark-library-index'
import type { MemoryItem } from '@/core/memory/memory-item'
import type { SupportedMemoryItemType } from '@/core/memory/memory-item-type'
import {
  buildLibraryTypeLocationSearch,
  LIBRARY_LIST_LIMIT,
  LIBRARY_TYPE_TABS,
  parseLibraryTypeFromLocationSearch,
  resolveLibraryTypeTab
} from '@/core/memory/library-tabs'
import { parseChromeBookmarkTreeChangedMessage } from '@/core/messaging/ui-messages'
import { getMemoryItemOpenHref } from '@/core/recall/memory-open-href'
import { getMemoryItemDisplay } from '@/core/recall/recall-result'
import { tImportError } from '@/infrastructure/i18n/background-error'
import { getUILanguage, t } from '@/infrastructure/i18n/t'
import { tMemoryError } from '@/infrastructure/i18n/memory-error'
import {
  deleteMemoryItem,
  fetchBookmarkLibraryTree,
  listMemoryItems,
  recordMemoryOpen,
  updateMemoryNote
} from '@/infrastructure/messaging/background-client'
import AppPageHeader from '@/infrastructure/ui/AppPageHeader.vue'
import AppIcon from '@/infrastructure/ui/icons/AppIcon.vue'
import BookmarkLibraryTree from '@/pages/library/BookmarkLibraryTree.vue'

defineOptions({ name: 'LibraryPage' })

type LoadState = 'loading' | 'ready' | 'error'

/** 书签树静默刷新防抖（Chrome 批量改动时避免连打 getTree）。 */
const BOOKMARK_TREE_REFRESH_DEBOUNCE_MS = 300

const activeType = ref<SupportedMemoryItemType>(
  parseLibraryTypeFromLocationSearch(window.location.search)
)
const loadState = ref<LoadState>('loading')
const errorMessage = ref('')
const items = ref<MemoryItem[]>([])
const bookmarkIndex = shallowRef<BookmarkLibraryIndex | null>(null)
const bookmarkStructureHash = ref('')
const bookmarkSyncReady = ref(false)
const deletingId = ref<string | null>(null)
let bookmarkTreeRefreshTimer: ReturnType<typeof setTimeout> | null = null
let bookmarkTreeRefreshInFlight = false
let bookmarkTreeRefreshQueued = false

const NOTE_MAX_LENGTH = 500
const noteEditorOpen = ref(false)
const noteEditorSaving = ref(false)
const noteEditorError = ref('')
const noteEditorMemoryId = ref<string | null>(null)
const noteEditorTitle = ref('')
const noteEditorDraft = ref('')
const deleteConfirmOpen = ref(false)
const pendingDeleteId = ref<string | null>(null)
const deleteConfirmError = ref('')

const activeTabDef = computed(() => resolveLibraryTypeTab(activeType.value))
const activeTab = computed(() => {
  const def = activeTabDef.value
  return {
    type: def.type,
    label: t(def.labelKey),
    emptyTitle: t(def.emptyTitleKey),
    emptyBody: t(def.emptyBodyKey)
  }
})

const librarySectionTabsId = useId()
const libraryPanelId = `${librarySectionTabsId}-panel`
const libraryActiveTabId = computed(() => `${librarySectionTabsId}-tab-${activeType.value}`)
const libraryTypeTabItems = computed(() =>
  LIBRARY_TYPE_TABS.map(tab => ({
    id: tab.type,
    label: t(tab.labelKey)
  }))
)

const showingBookmarkTree = computed(() => activeType.value === 'bookmark')

const listRows = computed(() => {
  const detailPageUrl = chrome.runtime.getURL('detail.html')
  return items.value.map(item => {
    const display = getMemoryItemDisplay(item, t)
    return {
      id: item.id,
      typeLabel: display.typeLabel,
      title: display.title,
      subtitle: display.subtitle,
      excerpt: display.excerpt,
      note: item.clues.note?.trim() || null,
      href: getMemoryItemOpenHref(item, { detailPageUrl }),
      updatedAt: item.updatedAt
    }
  })
})

function formatUpdatedAt(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) {
    return ''
  }
  return date.toLocaleString(getUILanguage(), {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

/**
 * 拉取书签树。
 * @param options.silent 为 true 时不切到 loading（SW 推送 / 页签回前台刷新）。
 */
async function loadBookmarkTree(options: { silent?: boolean } = {}) {
  if (!options.silent) {
    loadState.value = 'loading'
  }
  const response = await fetchBookmarkLibraryTree({
    clientHash: bookmarkStructureHash.value || undefined
  })
  if (!response.ok) {
    if (!options.silent || loadState.value !== 'ready') {
      loadState.value = 'error'
      errorMessage.value = tImportError(response.errorCode)
    }
    if (!options.silent) {
      bookmarkIndex.value = null
      bookmarkStructureHash.value = ''
      bookmarkSyncReady.value = false
    }
    return
  }

  if ('unchanged' in response && response.unchanged) {
    bookmarkSyncReady.value = response.syncReady
    if (loadState.value !== 'ready') {
      loadState.value = 'ready'
    }
    errorMessage.value = ''
    return
  }

  if (!('index' in response)) {
    if (!options.silent || loadState.value !== 'ready') {
      loadState.value = 'error'
      errorMessage.value = t('library_invalid_response')
    }
    return
  }

  bookmarkIndex.value = markRaw(response.index)
  bookmarkStructureHash.value = response.structureHash
  bookmarkSyncReady.value = response.syncReady
  loadState.value = 'ready'
  errorMessage.value = ''
}

/** 防抖重拉书签树（仅当前在书签 Tab 时）。 */
function scheduleBookmarkTreeRefresh(): void {
  if (!showingBookmarkTree.value) {
    return
  }
  if (bookmarkTreeRefreshTimer !== null) {
    clearTimeout(bookmarkTreeRefreshTimer)
  }
  bookmarkTreeRefreshTimer = setTimeout(() => {
    bookmarkTreeRefreshTimer = null
    void runSilentBookmarkTreeRefresh()
  }, BOOKMARK_TREE_REFRESH_DEBOUNCE_MS)
}

async function runSilentBookmarkTreeRefresh(): Promise<void> {
  if (!showingBookmarkTree.value) {
    return
  }
  if (bookmarkTreeRefreshInFlight) {
    bookmarkTreeRefreshQueued = true
    return
  }
  bookmarkTreeRefreshInFlight = true
  try {
    await loadBookmarkTree({ silent: true })
  } catch {
    // 静默刷新失败保留旧树，避免打断浏览
  } finally {
    bookmarkTreeRefreshInFlight = false
    if (bookmarkTreeRefreshQueued) {
      bookmarkTreeRefreshQueued = false
      scheduleBookmarkTreeRefresh()
    }
  }
}

function handleUiPushMessage(message: unknown): void {
  if (!parseChromeBookmarkTreeChangedMessage(message)) {
    return
  }
  scheduleBookmarkTreeRefresh()
}

function handleDocumentVisibilityChange(): void {
  if (document.visibilityState !== 'visible') {
    return
  }
  scheduleBookmarkTreeRefresh()
}

async function loadExcerptList() {
  const response = await listMemoryItems({
    type: 'text_excerpt',
    limit: LIBRARY_LIST_LIMIT
  })
  if (!response.ok) {
    loadState.value = 'error'
    errorMessage.value = tMemoryError(response.errorCode)
    items.value = []
    return
  }
  if (!('items' in response)) {
    loadState.value = 'error'
    errorMessage.value = t('library_invalid_response')
    items.value = []
    return
  }

  items.value = response.items
  loadState.value = 'ready'
}

async function loadPanel() {
  loadState.value = 'loading'
  errorMessage.value = ''

  try {
    if (showingBookmarkTree.value) {
      await loadBookmarkTree()
      return
    }
    await loadExcerptList()
  } catch {
    loadState.value = 'error'
    errorMessage.value = t('library_load_failed')
    items.value = []
    bookmarkIndex.value = null
    bookmarkStructureHash.value = ''
  }
}

function syncActiveTypeToUrl(type: SupportedMemoryItemType) {
  const nextSearch = buildLibraryTypeLocationSearch(type, window.location.search)
  const nextUrl = `${window.location.pathname}${nextSearch}${window.location.hash}`
  const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`
  if (nextUrl !== currentUrl) {
    window.history.replaceState(null, '', nextUrl)
  }
}

function openDeleteConfirm(id: string) {
  if (deletingId.value) {
    return
  }
  pendingDeleteId.value = id
  deleteConfirmError.value = ''
  deleteConfirmOpen.value = true
}

function closeDeleteConfirm() {
  if (deletingId.value) {
    return
  }
  deleteConfirmOpen.value = false
  pendingDeleteId.value = null
  deleteConfirmError.value = ''
}

async function confirmDeleteExcerpt() {
  const id = pendingDeleteId.value
  if (!id || deletingId.value) {
    return
  }

  deletingId.value = id
  deleteConfirmError.value = ''
  try {
    const response = await deleteMemoryItem({ id })
    if (!response.ok) {
      deleteConfirmError.value = tMemoryError(response.errorCode)
      return
    }
    items.value = items.value.filter(item => item.id !== id)
    closeDeleteConfirm()
  } catch {
    deleteConfirmError.value = t('library_delete_failed')
  } finally {
    deletingId.value = null
  }
}

async function handleDeleteExcerpt(id: string) {
  openDeleteConfirm(id)
}

function openNoteEditor(payload: { memoryItemId: string; title: string; note: string }) {
  noteEditorMemoryId.value = payload.memoryItemId
  noteEditorTitle.value = payload.title
  noteEditorDraft.value = payload.note
  noteEditorError.value = ''
  noteEditorOpen.value = true
}

/** 记忆库打开书签：有 id 则写回行为；navigate 时再开链接。 */
function handleOpenBookmark(payload: {
  url: string
  navigate: boolean
  memoryItemId?: string
}): void {
  if (payload.memoryItemId) {
    void recordMemoryOpen({ id: payload.memoryItemId }).catch(() => {
      // 忽略：打开记录失败不影响导航
    })
  }
  if (payload.navigate) {
    window.open(payload.url, '_blank', 'noopener,noreferrer')
  }
}

function closeNoteEditor() {
  if (noteEditorSaving.value) {
    return
  }
  noteEditorOpen.value = false
  noteEditorMemoryId.value = null
  noteEditorTitle.value = ''
  noteEditorDraft.value = ''
  noteEditorError.value = ''
}

function patchBookmarkNoteInLocalIndex(memoryItemId: string, note: string | null): void {
  if (!bookmarkIndex.value) {
    return
  }
  bookmarkIndex.value = patchBookmarkNoteInIndex(bookmarkIndex.value, memoryItemId, note)
  bookmarkStructureHash.value = computeBookmarkLibraryStructureHash(bookmarkIndex.value)
  bookmarkIndex.value = markRaw(bookmarkIndex.value)
}

async function saveNote() {
  const id = noteEditorMemoryId.value
  if (!id || noteEditorSaving.value) {
    return
  }

  noteEditorSaving.value = true
  noteEditorError.value = ''
  try {
    const note = noteEditorDraft.value.trim().slice(0, NOTE_MAX_LENGTH)
    const response = await updateMemoryNote({ id, note })
    if (!response.ok || !('item' in response)) {
      noteEditorError.value = response.ok
        ? t('library_note_save_failed')
        : tMemoryError(response.errorCode)
      return
    }
    const savedNote = response.item.clues.note?.trim() || null
    patchBookmarkNoteInLocalIndex(id, savedNote)
    items.value = items.value.map(item => (item.id === id ? response.item : item))
    noteEditorOpen.value = false
    noteEditorMemoryId.value = null
    noteEditorTitle.value = ''
    noteEditorDraft.value = ''
  } catch {
    noteEditorError.value = t('library_note_save_failed')
  } finally {
    noteEditorSaving.value = false
  }
}

watch(
  activeType,
  type => {
    syncActiveTypeToUrl(type)
    void loadPanel()
  },
  { immediate: true }
)

onMounted(() => {
  chrome.runtime.onMessage.addListener(handleUiPushMessage)
  document.addEventListener('visibilitychange', handleDocumentVisibilityChange)
})

onUnmounted(() => {
  chrome.runtime.onMessage.removeListener(handleUiPushMessage)
  document.removeEventListener('visibilitychange', handleDocumentVisibilityChange)
  if (bookmarkTreeRefreshTimer !== null) {
    clearTimeout(bookmarkTreeRefreshTimer)
    bookmarkTreeRefreshTimer = null
  }
})
</script>

<template>
  <main class="library-shell">
    <header class="library-header">
      <AppPageHeader current="library" class="library-header-top" />
      <h1 class="library-title">{{ t('library_title') }}</h1>
      <p class="library-subtitle">{{ t('library_subtitle') }}</p>
    </header>

    <div class="library-layout">
      <AppSectionTabs
        v-model="activeType"
        :items="libraryTypeTabItems"
        :aria-label="t('library_tabs_aria')"
        :panel-id="libraryPanelId"
        :id-prefix="librarySectionTabsId"
      />

      <section
        :id="libraryPanelId"
        class="library-panel surface-panel-white"
        role="tabpanel"
        :aria-labelledby="libraryActiveTabId"
        :aria-label="activeTab.label"
        tabindex="0"
      >
        <p v-if="loadState === 'loading'" class="library-status" role="status">
          {{ t('library_loading') }}
        </p>

        <div v-else-if="loadState === 'error'" class="library-error-block" role="alert">
          <p class="library-error">{{ errorMessage }}</p>
          <AppIconButton
            type="button"
            :title="t('library_retry')"
            :aria-label="t('library_retry')"
            @click="loadPanel"
          >
            <AppIcon name="refresh" size="22px" />
          </AppIconButton>
        </div>

        <template v-else-if="showingBookmarkTree">
          <div v-if="!bookmarkIndex || bookmarkIndex.bookmarkCount === 0" class="library-empty">
            <p class="library-empty-title">{{ activeTab.emptyTitle }}</p>
            <p class="library-empty-copy">{{ activeTab.emptyBody }}</p>
          </div>
          <BookmarkLibraryTree
            v-else
            :index="bookmarkIndex"
            :show-unsynced-flags="bookmarkSyncReady"
            @edit-note="openNoteEditor"
            @open-bookmark="handleOpenBookmark"
          />
        </template>

        <template v-else>
          <div v-if="listRows.length === 0" class="library-empty">
            <p class="library-empty-title">{{ activeTab.emptyTitle }}</p>
            <p class="library-empty-copy">{{ activeTab.emptyBody }}</p>
          </div>

          <ul v-else class="library-list">
            <li v-for="row in listRows" :key="row.id" class="library-item">
              <a class="library-row" :href="row.href" target="_blank" rel="noopener noreferrer">
                <div class="library-row-main">
                  <p v-if="row.excerpt" class="library-row-body">{{ row.excerpt }}</p>
                  <p v-else-if="row.title" class="library-row-title">{{ row.title }}</p>
                  <p v-if="row.note" class="library-row-note">
                    <span class="library-row-note-label">{{ t('detail_note_label') }}</span>
                    {{ row.note }}
                  </p>
                </div>
                <div class="library-row-meta">
                  <p class="library-row-subtitle">{{ row.subtitle }}</p>
                  <p class="library-row-time">{{ formatUpdatedAt(row.updatedAt) }}</p>
                </div>
              </a>
              <AppIconButton
                type="button"
                class="library-item-note"
                :title="row.note ? t('library_edit_note_aria') : t('library_add_note_aria')"
                :aria-label="row.note ? t('library_edit_note_aria') : t('library_add_note_aria')"
                @click="
                  openNoteEditor({
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
                class="library-item-delete"
                tone="danger"
                :title="t('library_delete_excerpt_aria')"
                :aria-label="t('library_delete_excerpt_aria')"
                :disabled="deletingId === row.id"
                @click="handleDeleteExcerpt(row.id)"
              >
                <AppIcon name="delete" size="20px" />
              </AppIconButton>
            </li>
          </ul>
        </template>
      </section>
    </div>

    <AppModal
      :open="noteEditorOpen"
      :title="t('library_note_dialog_title')"
      :loading="noteEditorSaving"
      @close="closeNoteEditor"
    >
      <p class="library-note-dialog-target">{{ noteEditorTitle }}</p>
      <AppTextarea
        v-model="noteEditorDraft"
        :maxlength="NOTE_MAX_LENGTH"
        :placeholder="t('selection_toolbar_note_placeholder')"
        :disabled="noteEditorSaving"
      />

      <template v-if="noteEditorError" #error>{{ noteEditorError }}</template>

      <template #actions>
        <AppButton
          type="button"
          :disabled="noteEditorSaving"
          @click="closeNoteEditor"
          variant="outlined"
        >
          {{ t('selection_toolbar_note_cancel') }}
        </AppButton>
        <AppButton type="button" :disabled="noteEditorSaving" @click="saveNote" variant="filled">
          {{ t('selection_toolbar_note_save') }}
        </AppButton>
      </template>
    </AppModal>

    <AppConfirmModal
      :open="deleteConfirmOpen"
      :title="t('library_delete_excerpt_aria')"
      :body="t('library_delete_confirm')"
      :cancel-label="t('selection_toolbar_note_cancel')"
      :confirm-label="t('library_delete_excerpt_aria')"
      confirm-tone="danger"
      :error="deleteConfirmError || undefined"
      :loading="deletingId !== null"
      @close="closeDeleteConfirm"
      @confirm="confirmDeleteExcerpt"
    />
  </main>
</template>

<style scoped>
.library-shell {
  max-width: 960px;
  margin: 0 auto;
  padding: var(--page-shell-padding-top) var(--page-shell-padding-x)
    var(--page-shell-padding-bottom);
  color: var(--on-surface);
}

.library-header {
  margin-bottom: var(--space-lg);
}

.library-header-top {
  margin-bottom: var(--space-2xs);
}

.library-title {
  margin: 0 0 var(--space-xs);
  font-size: 28px;
  line-height: 1.2;
}

.library-subtitle {
  margin: 0;
  font-size: 14px;
  line-height: 1.5;
  color: var(--on-surface-muted);
}

.library-layout {
  display: grid;
  align-items: start;
  gap: var(--space-lg);
  grid-template-columns: 140px minmax(0, 1fr);
}

.library-panel {
  min-height: 280px;
}

.library-status,
.library-error {
  margin: 0;
  font-size: 14px;
  line-height: 1.5;
}

.library-error {
  color: var(--danger);
}

.library-error-block {
  display: grid;
  gap: var(--space-xs);
  justify-items: start;
}

.library-empty {
  display: grid;
  gap: var(--space-xs);
  padding: var(--space-lg) var(--space-xs);
}

.library-empty-title {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
}

.library-empty-copy {
  margin: 0;
  font-size: 13px;
  line-height: 1.5;
  color: var(--on-surface-muted);
}

.library-list {
  display: grid;
  gap: var(--space-xs);
  margin: 0;
  padding: 0;
  list-style: none;
}

.library-item {
  position: relative;
}

.library-item-note,
.library-item-delete {
  position: absolute;
  top: var(--space-xs);
  z-index: 1;
  opacity: 0;
  pointer-events: none;
  transition: opacity var(--motion-duration-short) var(--motion-easing-standard);
}

.library-item-note {
  right: 44px;
  color: var(--on-surface-muted);
}

.library-item-delete {
  right: var(--space-xs);
  color: var(--danger);
}

.library-item:hover .library-item-note,
.library-item:hover .library-item-delete,
.library-item:focus-within .library-item-note,
.library-item:focus-within .library-item-delete,
.library-item-delete[disabled] {
  opacity: 1;
  pointer-events: auto;
}

@media (hover: none) {
  .library-item-note,
  .library-item-delete {
    opacity: 1;
    pointer-events: auto;
  }
}

@media (prefers-reduced-motion: reduce) {
  .library-item-note,
  .library-item-delete {
    transition: none;
  }
}

.library-row {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
  /* 右侧为行内操作钮预留宽度 */
  padding: var(--space-sm) 84px var(--space-sm) var(--space-md);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  text-decoration: none;
  color: inherit;
  background: var(--surface);
}

.library-row:hover {
  background: var(--surface-chrome);
}

.library-row-main {
  min-width: 0;
}

.library-row-title,
.library-row-body {
  margin: 0 0 var(--space-2xs);
  font-size: 15px;
  font-weight: 600;
  line-height: 1.35;
}

.library-row-body {
  display: -webkit-box;
  font-weight: 500;
  overflow: hidden;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
}

.library-row-note {
  display: -webkit-box;
  margin: 0;
  font-size: 13px;
  line-height: 1.45;
  color: var(--on-surface);
  overflow: hidden;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.library-row-note-label {
  margin-right: var(--space-xs);
  font-weight: 600;
  color: var(--accent);
}

.library-row-meta {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-sm);
  min-width: 0;
}

.library-row-subtitle {
  margin: 0;
  min-width: 0;
  font-size: 12px;
  color: var(--on-surface-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.library-row-time {
  flex-shrink: 0;
  margin: 0;
  font-size: 12px;
  color: var(--border-strong);
}

.library-note-dialog-target {
  margin: 0;
  font-size: 13px;
  line-height: 1.4;
  white-space: nowrap;
  color: var(--on-surface-muted);
  overflow: hidden;
  text-overflow: ellipsis;
}

@media (width <= 640px) {
  .library-layout {
    grid-template-columns: 1fr;
  }
}
</style>
