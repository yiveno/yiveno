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
import { tImportError } from '@/infrastructure/i18n/background-error'
import { t } from '@/infrastructure/i18n/t'
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
import type { AppIconName } from '@/infrastructure/ui/icons/icon-paths'
import BookmarkLibraryTree from '@/pages/library/BookmarkLibraryTree.vue'
import ExcerptLibraryList from '@/pages/library/ExcerptLibraryList.vue'
import {
  buildExcerptLibraryListRows,
  collectBookmarkExportableMemoryIds,
  type ExcerptLibraryListRow
} from '@/pages/library/library-excerpt-list-rows'
import DetailExportBar from '@/infrastructure/ui/DetailExportBar.vue'
import DetailExportBarDock from '@/infrastructure/ui/DetailExportBarDock.vue'
import AppToastHost from '@/infrastructure/ui/AppToastHost.vue'
import { useAppToast } from '@/infrastructure/ui/use-app-toast'
import {
  copyDetailExportToClipboard,
  downloadDetailExport
} from '@/infrastructure/recall/detail-export-client'
import {
  invertDetailExportSelection,
  selectAllDetailExportItems,
  toggleDetailExportSelection as toggleDetailExportSelectionSet
} from '@/infrastructure/recall/detail-export-selection'

defineOptions({ name: 'LibraryPage' })

type LoadState = 'loading' | 'ready' | 'error'

/** Detail export 顶栏批量操作：全选 ↔ 反选。 */
type DetailExportBulkAction = 'selectAll' | 'invert'

/** 书签树静默刷新防抖（Chrome 批量改动时避免连打 getTree）。 */
const BOOKMARK_TREE_REFRESH_DEBOUNCE_MS = 300

const activeType = ref<SupportedMemoryItemType>(
  parseLibraryTypeFromLocationSearch(window.location.search)
)
const loadState = ref<LoadState>('loading')
const errorMessage = ref('')
const items = shallowRef<MemoryItem[]>([])
const listRows = shallowRef<ExcerptLibraryListRow[]>([])
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

const selectedDetailExportIds = shallowRef<Set<string>>(new Set())
/** detail export 多选 revision：配合子列表 v-memo，避免整表重绘。 */
const detailExportSelectionRevision = ref(0)
const bookmarkExportableIds = shallowRef<string[]>([])
/** Detail export 多选模式：点 Export 后才显示勾选框。 */
const detailExportMode = ref(false)
const detailExportBulkAction = ref<DetailExportBulkAction>('selectAll')
const detailExportExporting = ref(false)

const { success: showToastSuccess, error: showToastError } = useAppToast()

const detailExportSelectedCount = computed(() => selectedDetailExportIds.value.size)
const showDetailExportBar = computed(() => detailExportMode.value)

const hasExportableLibraryItems = computed(() => {
  if (showingBookmarkTree.value) {
    return (bookmarkIndex.value?.bookmarkCount ?? 0) > 0
  }
  return listRows.value.length > 0
})

const exportableDetailExportIds = computed(() => {
  if (showingBookmarkTree.value) {
    return bookmarkExportableIds.value
  }
  return listRows.value.map(row => row.id)
})

function rebuildListRows(): void {
  listRows.value = buildExcerptLibraryListRows(items.value)
}

function bumpDetailExportSelectionRevision(): void {
  detailExportSelectionRevision.value += 1
}

const detailExportHeaderIcon = computed((): AppIconName => {
  if (!detailExportMode.value) {
    return 'package'
  }
  return detailExportBulkAction.value === 'selectAll' ? 'list_checks' : 'flip_vertical'
})

/** 悬浮提示：说明按钮具体用途。 */
const detailExportHeaderTitle = computed(() => {
  if (!detailExportMode.value) {
    return t('detail_export_start_hint')
  }
  return detailExportBulkAction.value === 'selectAll'
    ? t('detail_export_select_all_hint')
    : t('detail_export_invert_selection_hint')
})

const detailExportHeaderAriaLabel = computed(() => {
  if (!detailExportMode.value) {
    return t('detail_export_start')
  }
  return detailExportBulkAction.value === 'selectAll'
    ? t('detail_export_select_all')
    : t('detail_export_invert_selection')
})

function enterDetailExportMode(): void {
  detailExportMode.value = true
  detailExportBulkAction.value = 'selectAll'
}

function exitDetailExportMode(): void {
  detailExportMode.value = false
  detailExportBulkAction.value = 'selectAll'
  selectedDetailExportIds.value = new Set()
  bumpDetailExportSelectionRevision()
}

function handleDetailExportHeaderAction(): void {
  if (!detailExportMode.value) {
    enterDetailExportMode()
    return
  }

  const ids = exportableDetailExportIds.value
  if (detailExportBulkAction.value === 'selectAll') {
    selectedDetailExportIds.value = selectAllDetailExportItems(ids)
    detailExportBulkAction.value = 'invert'
    bumpDetailExportSelectionRevision()
    return
  }

  selectedDetailExportIds.value = invertDetailExportSelection(ids, selectedDetailExportIds.value)
  detailExportBulkAction.value = 'selectAll'
  bumpDetailExportSelectionRevision()
}

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

/** 列表由子组件内部滚动时，外层 panel 不再叠第二层 overflow。 */
const libraryPanelUsesInnerScroll = computed(() => {
  if (loadState.value !== 'ready') {
    return false
  }
  if (showingBookmarkTree.value) {
    return (bookmarkIndex.value?.bookmarkCount ?? 0) > 0
  }
  return listRows.value.length > 0
})

function canSelectDetailExportItem(_id: string): boolean {
  return true
}

function handleToggleDetailExportSelection(id: string): void {
  selectedDetailExportIds.value = toggleDetailExportSelectionSet(selectedDetailExportIds.value, id)
  bumpDetailExportSelectionRevision()
}

function handleLibraryRowActivate(
  event: MouseEvent | KeyboardEvent,
  row: { id: string; href: string }
): void {
  if (detailExportMode.value) {
    event.preventDefault()
    if (!canSelectDetailExportItem(row.id)) {
      return
    }
    handleToggleDetailExportSelection(row.id)
    return
  }
  event.preventDefault()
  window.open(row.href, '_blank', 'noopener,noreferrer')
}

function clearDetailExportSelection(): void {
  exitDetailExportMode()
}

async function runDetailExportAction(
  format: 'json' | 'markdown',
  channel: 'copy' | 'download'
): Promise<void> {
  if (detailExportExporting.value) {
    return
  }
  detailExportExporting.value = true
  try {
    const ids = [...selectedDetailExportIds.value]
    const result =
      channel === 'copy'
        ? await copyDetailExportToClipboard(ids, format)
        : await downloadDetailExport(ids, format)
    if (!result.ok) {
      showToastError(tMemoryError(result.errorCode))
      return
    }
    showToastSuccess(
      channel === 'copy' ? t('detail_export_copy_success') : t('detail_export_download_success')
    )
  } catch {
    showToastError(t('error_detail_export_operation_failed'))
  } finally {
    detailExportExporting.value = false
  }
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
      bookmarkExportableIds.value = []
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
  bookmarkExportableIds.value = collectBookmarkExportableMemoryIds(response.index.nodes)
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
    listRows.value = []
    return
  }
  if (!('items' in response)) {
    loadState.value = 'error'
    errorMessage.value = t('library_invalid_response')
    items.value = []
    listRows.value = []
    return
  }

  items.value = response.items
  rebuildListRows()
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
    listRows.value = []
    bookmarkIndex.value = null
    bookmarkStructureHash.value = ''
    bookmarkExportableIds.value = []
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
    rebuildListRows()
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
    rebuildListRows()
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
    exitDetailExportMode()
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
  <AppToastHost />
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
        :ariaLabel="t('library_tabs_aria')"
        :panel-id="libraryPanelId"
        :id-prefix="librarySectionTabsId"
        layout="side"
        class="library-tabs"
      />

      <section
        :id="libraryPanelId"
        class="library-panel surface-panel-white"
        role="tabpanel"
        :aria-labelledby="libraryActiveTabId"
        :aria-label="activeTab.label"
        tabindex="0"
      >
        <header
          v-if="loadState === 'ready' && hasExportableLibraryItems"
          class="library-panel-header"
        >
          <AppIconButton
            type="button"
            class="library-detail-export-header-btn"
            :title="detailExportHeaderTitle"
            :aria-label="detailExportHeaderAriaLabel"
            @click="handleDetailExportHeaderAction"
          >
            <AppIcon :name="detailExportHeaderIcon" size="22px" />
          </AppIconButton>
        </header>

        <div
          class="library-panel-body"
          :class="{ 'library-panel-body--inner-scroll': libraryPanelUsesInnerScroll }"
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
            <div v-else class="library-bookmark-tree-host">
              <BookmarkLibraryTree
                :index="bookmarkIndex"
                :show-unsynced-flags="bookmarkSyncReady"
                :show-detail-export-selection="detailExportMode"
                :selected-detail-export-ids="selectedDetailExportIds"
                :detail-export-selection-revision="detailExportSelectionRevision"
                @edit-note="openNoteEditor"
                @open-bookmark="handleOpenBookmark"
                @toggle-detail-export-selection="handleToggleDetailExportSelection"
              />
            </div>
          </template>

          <template v-else>
            <div v-if="listRows.length === 0" class="library-empty">
              <p class="library-empty-title">{{ activeTab.emptyTitle }}</p>
              <p class="library-empty-copy">{{ activeTab.emptyBody }}</p>
            </div>

            <div v-else class="library-list-scroll-host">
              <ExcerptLibraryList
                :rows="listRows"
                :detail-export-mode="detailExportMode"
                :selected-detail-export-ids="selectedDetailExportIds"
                :detail-export-selection-revision="detailExportSelectionRevision"
                :deleting-id="deletingId"
                @activate="handleLibraryRowActivate"
                @edit-note="openNoteEditor"
                @delete-excerpt="handleDeleteExcerpt"
              />
            </div>
          </template>
        </div>
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
          variant="outlined"
          @click="closeNoteEditor"
        >
          {{ t('selection_toolbar_note_cancel') }}
        </AppButton>
        <AppButton type="button" :disabled="noteEditorSaving" variant="filled" @click="saveNote">
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

    <DetailExportBarDock :visible="showDetailExportBar" class="library-detail-export-slot">
      <DetailExportBar
        class="library-detail-export-bar"
        :selected-count="detailExportSelectedCount"
        :exporting="detailExportExporting"
        @copy-json="runDetailExportAction('json', 'copy')"
        @copy-markdown="runDetailExportAction('markdown', 'copy')"
        @download-json="runDetailExportAction('json', 'download')"
        @download-markdown="runDetailExportAction('markdown', 'download')"
        @clear="clearDetailExportSelection"
      />
    </DetailExportBarDock>
  </main>
</template>

<style scoped>
.library-shell {
  --library-detail-export-slot-height: 4.25rem;
  --detail-export-bar-height: var(--library-detail-export-slot-height);
  --detail-export-bar-wrap: nowrap;

  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100vh;
  min-height: 100vh;
  padding: var(--page-shell-padding-top) 0 0;
  color: var(--on-surface);
  overflow: hidden;
}

.library-detail-export-slot {
  z-index: 2;
  display: flex;
  flex-shrink: 0;
  align-items: stretch;
  box-sizing: border-box;
  height: var(--library-detail-export-slot-height);
  min-height: var(--library-detail-export-slot-height);
  max-height: var(--library-detail-export-slot-height);
  border-top: 1px solid var(--border);
  background: var(--surface-white);
  overflow: hidden;
}

.library-detail-export-bar {
  width: 100%;
  height: var(--library-detail-export-slot-height);
  min-height: var(--library-detail-export-slot-height);
  max-height: var(--library-detail-export-slot-height);
  box-shadow: 0 -4px 16px rgb(0 0 0 / 6%);
}

.library-header {
  flex-shrink: 0;
  margin-bottom: var(--space-md);
  padding-inline: var(--space-md);
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
  flex: 1;
  align-items: stretch;
  grid-template-columns: minmax(10.5rem, 12rem) minmax(0, 1fr);
  min-height: 0;
  border-top: 1px solid var(--border);
}

.library-tabs {
  align-self: stretch;
  align-content: start;
  grid-auto-flow: row;
  width: 100%;
  min-height: 0;
  padding: var(--space-sm);
  border: none;
  border-right: 1px solid var(--border);
  border-radius: 0;
  background: var(--surface);
  overflow-y: auto;
}

.library-panel {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  padding: 0;
  border: none;
  border-radius: 0;
  background: var(--surface-white);
}

.library-panel-header {
  display: flex;
  flex-shrink: 0;
  justify-content: flex-end;
  padding: var(--space-sm) var(--space-md);
  border-bottom: 1px solid var(--border);
}

.library-detail-export-header-btn {
  border: 1px solid var(--border-strong);
  color: var(--accent);
}

.library-detail-export-header-btn:hover:not(:disabled) {
  color: var(--accent);
  background: color-mix(
    in srgb,
    var(--accent) calc(var(--state-hover-opacity) * 100%),
    transparent
  );
}

.library-panel-body {
  --library-list-row-gap: var(--space-xs);

  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  padding: var(--space-md);
  overflow-y: auto;
}

.library-panel-body--inner-scroll {
  overflow: hidden;
}

.library-bookmark-tree-host,
.library-list-scroll-host {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
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

  .library-tabs {
    min-height: auto;
    border-right: none;
    border-bottom: 1px solid var(--border);
  }
}
</style>
