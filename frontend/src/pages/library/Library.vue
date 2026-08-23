<script setup lang="ts">
import { computed, markRaw, onMounted, onUnmounted, ref, shallowRef, watch } from 'vue'
import AppButton from '@/infrastructure/ui/AppButton.vue'
import AppIconButton from '@/infrastructure/ui/AppIconButton.vue'

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

function selectType(type: SupportedMemoryItemType) {
  if (activeType.value === type) {
    return
  }
  activeType.value = type
}

function syncActiveTypeToUrl(type: SupportedMemoryItemType) {
  const nextSearch = buildLibraryTypeLocationSearch(type, window.location.search)
  const nextUrl = `${window.location.pathname}${nextSearch}${window.location.hash}`
  const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`
  if (nextUrl !== currentUrl) {
    window.history.replaceState(null, '', nextUrl)
  }
}

async function handleDeleteExcerpt(id: string) {
  if (deletingId.value) {
    return
  }
  if (!window.confirm(t('library_delete_confirm'))) {
    return
  }

  deletingId.value = id
  try {
    const response = await deleteMemoryItem({ id })
    if (!response.ok) {
      window.alert(tMemoryError(response.errorCode))
      return
    }
    items.value = items.value.filter(item => item.id !== id)
  } catch {
    window.alert(t('library_delete_failed'))
  } finally {
    deletingId.value = null
  }
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
      <nav class="library-tabs" :aria-label="t('library_tabs_aria')">
        <button
          v-for="tab in LIBRARY_TYPE_TABS"
          :key="tab.type"
          type="button"
          class="library-tab"
          :class="{ 'library-tab--active': activeType === tab.type }"
          :aria-current="activeType === tab.type ? 'page' : undefined"
          @click="selectType(tab.type)"
        >
          {{ t(tab.labelKey) }}
        </button>
      </nav>

      <section class="library-panel" :aria-label="activeTab.label">
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

    <div
      v-if="noteEditorOpen"
      class="library-note-dialog"
      role="dialog"
      aria-modal="true"
      :aria-label="t('library_note_dialog_title')"
    >
      <div class="library-note-dialog-card">
        <h2 class="library-note-dialog-title">{{ t('library_note_dialog_title') }}</h2>
        <p class="library-note-dialog-target">{{ noteEditorTitle }}</p>
        <textarea
          v-model="noteEditorDraft"
          class="library-note-dialog-input"
          rows="4"
          :maxlength="NOTE_MAX_LENGTH"
          :placeholder="t('selection_toolbar_note_placeholder')"
          :disabled="noteEditorSaving"
        />
        <p v-if="noteEditorError" class="library-note-dialog-error" role="alert">
          {{ noteEditorError }}
        </p>
        <div class="library-note-dialog-actions">
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
        </div>
      </div>
    </div>
  </main>
</template>

<style scoped>
.library-shell {
  max-width: 960px;
  margin: 0 auto;
  padding: 28px 24px 40px;
  color: var(--on-surface);
}

.library-header {
  margin-bottom: 24px;
}

.library-header-top {
  margin-bottom: 4px;
}

.library-title {
  margin: 0 0 8px;
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
  gap: 20px;
  grid-template-columns: 140px minmax(0, 1fr);
}

.library-tabs {
  display: grid;
  gap: 6px;
  padding: 8px;
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: var(--surface-raised);
}

.library-tab {
  margin: 0;
  padding: 10px 12px;
  border: none;
  border-radius: var(--radius-sm);
  font: inherit;
  font-size: 14px;
  font-weight: 600;
  text-align: left;
  color: var(--on-surface-muted);
  background: transparent;
  cursor: pointer;
}

.library-tab:hover {
  background: color-mix(in srgb, var(--on-surface) 6%, transparent);
}

.library-tab--active {
  color: var(--on-surface);
  background: var(--surface-chrome);
}

.library-panel {
  min-height: 280px;
  padding: 16px;
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: var(--surface-white);
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
  gap: 8px;
  justify-items: start;
}

.library-empty {
  display: grid;
  gap: 6px;
  padding: 20px 8px;
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
  gap: 8px;
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
  top: 6px;
  z-index: 1;
  opacity: 0;
  pointer-events: none;
  transition: opacity 120ms cubic-bezier(0.2, 0, 0, 1);
}

.library-item-note {
  right: 44px;
  color: var(--on-surface-muted);
}

.library-item-delete {
  right: 6px;
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
  gap: 8px;
  padding: 12px 84px 12px 14px;
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
  margin: 0 0 4px;
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
  margin-right: 6px;
  font-weight: 600;
  color: var(--accent);
}

.library-row-meta {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
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

.library-note-dialog {
  position: fixed;
  inset: 0;
  z-index: 40;
  display: grid;
  place-items: center;
  padding: 24px;
  background: rgb(15 23 42 / 36%);
}

.library-note-dialog-card {
  display: grid;
  gap: 12px;
  width: min(420px, 100%);
  padding: 18px;
  border-radius: var(--radius-lg);
  background: var(--surface-white);
  box-shadow: 0 12px 40px rgb(15 23 42 / 18%);
}

.library-note-dialog-title {
  margin: 0;
  font-size: 18px;
  line-height: 1.3;
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

.library-note-dialog-input {
  box-sizing: border-box;
  width: 100%;
  margin: 0;
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  resize: vertical;
  font: inherit;
  font-size: 14px;
  line-height: 1.45;
  color: var(--on-surface);
  background: var(--surface);
}

.library-note-dialog-input:focus {
  outline: 2px solid color-mix(in srgb, var(--accent) 35%, transparent);
  outline-offset: 1px;
}

.library-note-dialog-error {
  margin: 0;
  font-size: 13px;
  color: var(--danger);
}

.library-note-dialog-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}

@media (width <= 640px) {
  .library-layout {
    grid-template-columns: 1fr;
  }

  .library-tabs {
    grid-auto-columns: 1fr;
    grid-auto-flow: column;
  }

  .library-tab {
    text-align: center;
  }
}
</style>
