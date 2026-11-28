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
import {
  CHROME_BOOKMARK_IMPORT_STORAGE_KEY,
  ChromeBookmarkImportStateSchema,
  getChromeBookmarkImportPercent,
  type ChromeBookmarkImportState
} from '@/core/memory/chrome-bookmark-import-state'
import type { MemoryItem } from '@/core/memory/memory-item'
import type { SupportedMemoryItemType } from '@/core/memory/memory-item-type'
import {
  buildLibraryTypeLocationSearch,
  LIBRARY_LIST_LIMIT,
  LIBRARY_TYPE_TABS,
  parseLibraryTypeFromLocationSearch,
  resolveLibraryTypeTab,
  shouldShowLibraryListCapNote
} from '@/core/memory/library-tabs'
import { parseChromeBookmarkTreeChangedMessage } from '@/core/messaging/ui-messages'
import { tChromeBookmarkImportError, tImportError } from '@/infrastructure/i18n/background-error'
import { t } from '@/infrastructure/i18n/t'
import { tMemoryError } from '@/infrastructure/i18n/memory-error'
import {
  deleteMemoryItem,
  ensureChromeBookmarksImportedMessage,
  fetchBookmarkLibraryTree,
  fetchChromeBookmarkImportStatus,
  fetchUserSettings,
  listMemoryItems,
  recordMemoryOpen,
  updateMemoryNote
} from '@/infrastructure/messaging/background-client'
import AppLinearProgress from '@/infrastructure/ui/AppLinearProgress.vue'
import { openExtensionReviewPage } from '@/infrastructure/browser/extension-pages'
import AppPageHeader from '@/infrastructure/ui/AppPageHeader.vue'
import AppIcon from '@/infrastructure/ui/icons/AppIcon.vue'
import type { AppIconName } from '@/infrastructure/ui/icons/icon-paths'
import BookmarkLibraryTree from '@/pages/library/BookmarkLibraryTree.vue'
import ExcerptLibraryList from '@/pages/library/ExcerptLibraryList.vue'
import {
  isLibraryBookmarkImportFailed,
  isLibraryBookmarkImporting,
  resolveLibraryBookmarkRetryBlockedReason
} from '@/pages/library/library-bookmark-import-ui'
import {
  buildAutoExtractUrlIndex,
  type AutoExtractIndexEntry
} from '@/pages/library/library-auto-extract-index'
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
import { MEMORY_LIBRARY_REVISION_LOCAL_KEY } from '@/infrastructure/storage/memory-library-revision-storage'

defineOptions({ name: 'LibraryPage' })

type LoadState = 'loading' | 'ready' | 'error'

/** Detail export 顶栏批量操作：全选 ↔ 反选。 */
type DetailExportBulkAction = 'selectAll' | 'invert'

/** 书签树静默刷新防抖（Chrome 批量改动时避免连打 getTree）。 */
const BOOKMARK_TREE_REFRESH_DEBOUNCE_MS = 300
/** 记忆库搜索框防抖：输入停 300ms 后生效。 */
const LIBRARY_SEARCH_DEBOUNCE_MS = 300

type LibraryListSort = 'newest' | 'oldest'

const activeType = ref<SupportedMemoryItemType>(
  parseLibraryTypeFromLocationSearch(window.location.search)
)
const loadState = ref<LoadState>('loading')
const errorMessage = ref('')
const items = shallowRef<MemoryItem[]>([])
/** 摘录 Tab：LIST 返回的全库活条目总数（可大于已加载条数）。 */
const excerptTotal = ref(0)
const listRows = shallowRef<ExcerptLibraryListRow[]>([])
/** 本 owner auto_extract 摘录 URL 索引（徽标；批量一次，禁止逐卡查库）。 */
const autoExtractIndex = shallowRef<ReadonlyMap<string, AutoExtractIndexEntry>>(new Map())
/** 摘录「加载更多」busy（防连点）。 */
const loadingMoreExcerpts = ref(false)
/** 搜索框即时输入；两 Tab 共用，切 Tab 不清空。 */
const searchText = ref('')
/** 防抖后的生效 query（LIST / 书签树过滤）。 */
const debouncedQuery = ref('')
/** 摘录 Tab 排序；书签树不排序。 */
const sort = ref<LibraryListSort>('newest')
/** 摘录 LIST 竞态守卫：只采纳最新一次请求。 */
let excerptListRequestToken = 0
let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null
/** 书签树过滤后可见行数（含文件夹）；搜索无命中空态用。 */
const bookmarkVisibleRowCount = ref(0)
const bookmarkIndex = shallowRef<BookmarkLibraryIndex | null>(null)
const bookmarkStructureHash = ref('')
const bookmarkSyncReady = ref(false)
/** Chrome 书签导入状态（与树并行拉取；storage 事件驱动刷新）。 */
const bookmarkImportState = ref<ChromeBookmarkImportState | null>(null)
/** 书签导入失败后点「重新导入」busy。 */
const retryingBookmarkImport = ref(false)
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
/** 确认框文案：摘录 vs 书签（仅删 Yiveno 记忆）。 */
const pendingDeleteKind = ref<'excerpt' | 'bookmark'>('excerpt')
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

/** 分页拉本 owner 摘录并建成 auto_extract URL 索引（失败静默保留旧索引）。 */
async function refreshAutoExtractIndex(): Promise<void> {
  try {
    const pageSize = 500
    const collected: MemoryItem[] = []
    let offset = 0
    for (;;) {
      const response = await listMemoryItems({
        type: 'text_excerpt',
        limit: pageSize,
        offset
      })
      if (!response.ok || !('items' in response)) {
        return
      }
      collected.push(...response.items)
      if (response.items.length < pageSize || collected.length >= response.total) {
        break
      }
      offset += response.items.length
    }
    const detailPageUrl = chrome.runtime.getURL('detail.html')
    autoExtractIndex.value = buildAutoExtractUrlIndex(collected, detailPageUrl)
  } catch {
    // 忽略：徽标索引失败不影响列表本身
  }
}

const hasActiveLibraryQuery = computed(() => debouncedQuery.value.trim().length > 0)

const showExcerptSearchNoResults = computed(
  () => hasActiveLibraryQuery.value && listRows.value.length === 0
)

const showBookmarkSearchNoResults = computed(
  () =>
    hasActiveLibraryQuery.value &&
    (bookmarkIndex.value?.bookmarkCount ?? 0) > 0 &&
    bookmarkVisibleRowCount.value === 0
)

const showExcerptListCapNote = computed(() =>
  shouldShowLibraryListCapNote(excerptTotal.value, listRows.value.length)
)

function scheduleLibrarySearchDebounce(nextText: string): void {
  if (searchDebounceTimer !== null) {
    clearTimeout(searchDebounceTimer)
  }
  searchDebounceTimer = setTimeout(() => {
    searchDebounceTimer = null
    debouncedQuery.value = nextText.trim()
  }, LIBRARY_SEARCH_DEBOUNCE_MS)
}

function onLibrarySearchInput(event: Event): void {
  const target = event.target
  if (!(target instanceof HTMLInputElement)) {
    return
  }
  searchText.value = target.value
  scheduleLibrarySearchDebounce(target.value)
}

function onLibrarySortChange(event: Event): void {
  const target = event.target
  if (!(target instanceof HTMLSelectElement)) {
    return
  }
  sort.value = target.value === 'oldest' ? 'oldest' : 'newest'
}

function handleBookmarkVisibleRowCountChange(count: number): void {
  bookmarkVisibleRowCount.value = count
}

/** 摘录 LIST 共用 query/sort（三处调用点必须一致）。 */
function buildExcerptListPayload(limit: number, offset: number) {
  return {
    type: 'text_excerpt' as const,
    limit,
    offset,
    sort: sort.value,
    ...(debouncedQuery.value.trim() ? { query: debouncedQuery.value.trim() } : {})
  }
}

const excerptListCapNoteLabel = computed(() => {
  if (!showExcerptListCapNote.value) {
    return ''
  }
  return t('library_list_visible_cap_note', [
    String(listRows.value.length),
    String(excerptTotal.value)
  ])
})

const bookmarkImporting = computed(() =>
  isLibraryBookmarkImporting(bookmarkImportState.value?.status)
)

const isBookmarkImportFailed = computed(() =>
  isLibraryBookmarkImportFailed(bookmarkImportState.value?.status)
)

const bookmarkImportFailedReason = computed(() => {
  const errorCode = bookmarkImportState.value?.errorCode
  return tChromeBookmarkImportError(errorCode ?? 'BOOKMARK_IMPORT_FAILED')
})

const bookmarkImportPercent = computed(() => {
  const state = bookmarkImportState.value
  if (!state) {
    return undefined
  }
  if (!state.totalCount || state.totalCount <= 0) {
    return state.status === 'completed' ? 1 : undefined
  }
  return getChromeBookmarkImportPercent(state) / 100
})

const bookmarkImportDetailLine = computed(() => {
  const state = bookmarkImportState.value
  if (!state) {
    return t('library_bookmark_import_progress_indeterminate')
  }
  if (state.totalCount && state.totalCount > 0) {
    return t('library_bookmark_import_progress_detail', [
      String(state.importedCount),
      String(state.totalCount)
    ])
  }
  return t('library_bookmark_import_progress_indeterminate')
})

const showBookmarkImportWaiting = computed(
  () => bookmarkImporting.value && (!bookmarkIndex.value || bookmarkIndex.value.bookmarkCount === 0)
)

const showBookmarkImportProgress = computed(
  () =>
    bookmarkImporting.value &&
    !bookmarkSyncReady.value &&
    (bookmarkIndex.value?.bookmarkCount ?? 0) > 0
)

const showBookmarkImportFailedEmpty = computed(
  () =>
    isBookmarkImportFailed.value &&
    (!bookmarkIndex.value || bookmarkIndex.value.bookmarkCount === 0)
)

const showBookmarkImportFailedBanner = computed(
  () => isBookmarkImportFailed.value && (bookmarkIndex.value?.bookmarkCount ?? 0) > 0
)

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
const librarySortSelectId = useId()
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
async function refreshBookmarkImportState(): Promise<void> {
  try {
    const importRes = await fetchChromeBookmarkImportStatus()
    if (importRes.ok) {
      bookmarkImportState.value = importRes.state
    }
  } catch {
    // 忽略：导入状态探测失败不打断树浏览
  }
}

async function loadBookmarkTree(options: { silent?: boolean } = {}) {
  if (!options.silent) {
    loadState.value = 'loading'
  }
  const [response] = await Promise.all([
    fetchBookmarkLibraryTree({
      clientHash: bookmarkStructureHash.value || undefined
    }),
    refreshBookmarkImportState()
  ])
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

/**
 * 可见时静默对齐当前 Tab（摘录重拉 / 书签树防抖刷新）。
 * 划存后切回 Library、或页仍开着时靠 revision 信号；勿只刷书签树。
 */
function refreshVisibleLibraryPanel(): void {
  if (document.visibilityState !== 'visible') {
    return
  }
  void refreshAutoExtractIndex()
  if (showingBookmarkTree.value) {
    scheduleBookmarkTreeRefresh()
    return
  }
  void refreshExcerptListSilent()
}

/** 摘录 Tab 静默重拉：不闪 loading，失败保留旧列表；窗口同步到已加载条数。 */
async function refreshExcerptListSilent(): Promise<void> {
  if (showingBookmarkTree.value) {
    return
  }
  const requestToken = ++excerptListRequestToken
  try {
    const response = await listMemoryItems(
      buildExcerptListPayload(Math.max(LIBRARY_LIST_LIMIT, items.value.length), 0)
    )
    if (requestToken !== excerptListRequestToken) {
      return
    }
    if (!response.ok || !('items' in response)) {
      return
    }
    items.value = response.items
    excerptTotal.value = response.total
    rebuildListRows()
    if (loadState.value !== 'ready') {
      loadState.value = 'ready'
    }
    errorMessage.value = ''
  } catch {
    // 忽略：静默刷新失败不打断浏览
  }
}

/** 摘录「加载更多」：offset 分页追加；busy 中连点直接返回。 */
async function loadMoreExcerpts(): Promise<void> {
  if (loadingMoreExcerpts.value || showingBookmarkTree.value) {
    return
  }
  if (!shouldShowLibraryListCapNote(excerptTotal.value, listRows.value.length)) {
    return
  }
  loadingMoreExcerpts.value = true
  const requestToken = ++excerptListRequestToken
  try {
    const response = await listMemoryItems(
      buildExcerptListPayload(LIBRARY_LIST_LIMIT, listRows.value.length)
    )
    if (requestToken !== excerptListRequestToken) {
      return
    }
    if (!response.ok) {
      showToastError(tMemoryError(response.errorCode))
      return
    }
    if (!('items' in response)) {
      showToastError(t('library_invalid_response'))
      return
    }
    items.value = [...items.value, ...response.items]
    excerptTotal.value = response.total
    rebuildListRows()
  } catch {
    showToastError(tMemoryError('MEMORY_OPERATION_FAILED'))
  } finally {
    loadingMoreExcerpts.value = false
  }
}

/** 书签导入失败后重试：ingest OFF 时只 toast 指路；否则复用 ENSURE。 */
async function retryBookmarkImport(): Promise<void> {
  if (retryingBookmarkImport.value) {
    return
  }
  retryingBookmarkImport.value = true
  try {
    // 读设置失败 → fail-open 仍发 ENSURE；明确 OFF 才拦（ADR-024 不替用户开开关）
    let ingestEnabled: boolean | undefined
    try {
      const settingsResponse = await fetchUserSettings()
      if (settingsResponse.ok) {
        ingestEnabled = settingsResponse.settings.chromeBookmarkIngestEnabled
      }
    } catch {
      ingestEnabled = undefined
    }
    if (resolveLibraryBookmarkRetryBlockedReason(ingestEnabled) === 'ingest_off') {
      showToastError(t('library_bookmark_import_ingest_off'))
      return
    }

    const response = await ensureChromeBookmarksImportedMessage()
    if (!response.ok) {
      showToastError(tImportError(response.errorCode))
      return
    }
    bookmarkImportState.value = response.state
  } catch {
    showToastError(tImportError('IMPORT_STATUS_READ_FAILED'))
  } finally {
    retryingBookmarkImport.value = false
  }
}

function handleDocumentVisibilityChange(): void {
  refreshVisibleLibraryPanel()
}

/** 划存 / 删摘录 / 清库 bump 的库修订信号 → 可见时静默对齐列表。 */
function handleLibraryRevisionStorageChanged(
  changes: Record<string, chrome.storage.StorageChange>,
  areaName: string
): void {
  if (areaName !== 'local') {
    return
  }
  if (CHROME_BOOKMARK_IMPORT_STORAGE_KEY in changes) {
    const parsed = ChromeBookmarkImportStateSchema.safeParse(
      changes[CHROME_BOOKMARK_IMPORT_STORAGE_KEY]?.newValue
    )
    if (parsed.success) {
      bookmarkImportState.value = parsed.data
    } else {
      void refreshBookmarkImportState()
    }
    if (showingBookmarkTree.value) {
      scheduleBookmarkTreeRefresh()
    }
  }
  if (!(MEMORY_LIBRARY_REVISION_LOCAL_KEY in changes)) {
    return
  }
  refreshVisibleLibraryPanel()
}

async function loadExcerptList() {
  const requestToken = ++excerptListRequestToken
  const response = await listMemoryItems(buildExcerptListPayload(LIBRARY_LIST_LIMIT, 0))
  if (requestToken !== excerptListRequestToken) {
    return
  }
  if (!response.ok) {
    loadState.value = 'error'
    errorMessage.value = tMemoryError(response.errorCode)
    items.value = []
    excerptTotal.value = 0
    listRows.value = []
    return
  }
  if (!('items' in response)) {
    loadState.value = 'error'
    errorMessage.value = t('library_invalid_response')
    items.value = []
    excerptTotal.value = 0
    listRows.value = []
    return
  }

  items.value = response.items
  excerptTotal.value = response.total
  rebuildListRows()
  loadState.value = 'ready'
}

async function loadPanel() {
  loadState.value = 'loading'
  errorMessage.value = ''

  try {
    void refreshAutoExtractIndex()
    if (showingBookmarkTree.value) {
      await loadBookmarkTree()
      return
    }
    await loadExcerptList()
  } catch {
    loadState.value = 'error'
    errorMessage.value = t('library_load_failed')
    items.value = []
    excerptTotal.value = 0
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

function openDeleteConfirm(id: string, kind: 'excerpt' | 'bookmark') {
  if (deletingId.value) {
    return
  }
  pendingDeleteId.value = id
  pendingDeleteKind.value = kind
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

/** 删除成功（或已不存在）后关确认框；不可走 closeDeleteConfirm（其在 deletingId 占用时会拒关）。 */
function dismissDeleteConfirmAfterSuccess(): void {
  deleteConfirmOpen.value = false
  pendingDeleteId.value = null
  deleteConfirmError.value = ''
}

async function openDailyReview(): Promise<void> {
  try {
    await openExtensionReviewPage()
  } catch {
    showToastError(t('error_open_review'))
  }
}

const deleteConfirmTitle = computed(() =>
  pendingDeleteKind.value === 'bookmark'
    ? t('library_delete_bookmark_aria')
    : t('library_delete_excerpt_aria')
)

const deleteConfirmBody = computed(() =>
  pendingDeleteKind.value === 'bookmark'
    ? t('library_delete_bookmark_confirm')
    : t('library_delete_confirm')
)

/** 从本地摘录列表静默移除一行（删成功 / NOT_FOUND）。 */
function removeExcerptRowLocally(id: string): void {
  items.value = items.value.filter(item => item.id !== id)
  excerptTotal.value = Math.max(0, excerptTotal.value - 1)
  rebuildListRows()
}

async function confirmDeleteMemoryItem() {
  const id = pendingDeleteId.value
  const kind = pendingDeleteKind.value
  if (!id || deletingId.value) {
    return
  }

  deletingId.value = id
  deleteConfirmError.value = ''
  try {
    const response = await deleteMemoryItem({ id })
    if (!response.ok) {
      // 首点已删成、弹窗未关时再点：服务端 NOT_FOUND；列表已空，应关框而非卡死再报错
      if (response.errorCode === 'MEMORY_NOT_FOUND') {
        if (kind === 'excerpt') {
          removeExcerptRowLocally(id)
        } else {
          scheduleBookmarkTreeRefresh()
        }
        dismissDeleteConfirmAfterSuccess()
        return
      }
      deleteConfirmError.value = tMemoryError(response.errorCode)
      return
    }
    if (kind === 'excerpt') {
      removeExcerptRowLocally(id)
    } else {
      // 墓碑已写入；重拉树以隐藏行（revision 信号也会触发，这里主动一把更稳）
      scheduleBookmarkTreeRefresh()
    }
    dismissDeleteConfirmAfterSuccess()
  } catch {
    deleteConfirmError.value = t('library_delete_failed')
  } finally {
    deletingId.value = null
  }
}

async function handleDeleteExcerpt(id: string) {
  openDeleteConfirm(id, 'excerpt')
}

function handleDeleteBookmark(id: string) {
  openDeleteConfirm(id, 'bookmark')
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

/** query / sort 变化：摘录从 offset 0 重拉（书签树仅靠 prop 过滤）。 */
watch([debouncedQuery, sort], () => {
  if (showingBookmarkTree.value) {
    return
  }
  if (loadState.value === 'loading') {
    return
  }
  void loadExcerptList()
})

onMounted(() => {
  chrome.runtime.onMessage.addListener(handleUiPushMessage)
  chrome.storage.onChanged.addListener(handleLibraryRevisionStorageChanged)
  document.addEventListener('visibilitychange', handleDocumentVisibilityChange)
})

onUnmounted(() => {
  chrome.runtime.onMessage.removeListener(handleUiPushMessage)
  chrome.storage.onChanged.removeListener(handleLibraryRevisionStorageChanged)
  document.removeEventListener('visibilitychange', handleDocumentVisibilityChange)
  if (bookmarkTreeRefreshTimer !== null) {
    clearTimeout(bookmarkTreeRefreshTimer)
    bookmarkTreeRefreshTimer = null
  }
  if (searchDebounceTimer !== null) {
    clearTimeout(searchDebounceTimer)
    searchDebounceTimer = null
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
      <p class="library-review-entry">
        <AppButton type="button" variant="text" @click="openDailyReview">
          {{ t('review_nav_open') }}
        </AppButton>
      </p>
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
          <div class="library-toolbar" role="search">
            <input
              class="library-search-input"
              type="search"
              :value="searchText"
              :placeholder="t('library_search_placeholder')"
              :aria-label="t('library_search_aria')"
              maxlength="200"
              @input="onLibrarySearchInput"
            />
            <label
              v-if="!showingBookmarkTree"
              class="library-sort-label"
              :for="librarySortSelectId"
            >
              <span class="library-sort-label-text">{{ t('library_sort_label') }}</span>
              <select
                :id="librarySortSelectId"
                class="library-sort-select"
                :value="sort"
                @change="onLibrarySortChange"
              >
                <option value="newest">{{ t('library_sort_newest') }}</option>
                <option value="oldest">{{ t('library_sort_oldest') }}</option>
              </select>
            </label>
          </div>

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
            <div v-if="showBookmarkImportWaiting" class="library-empty" role="status">
              <p class="library-empty-title">{{ t('library_bookmark_importing_title') }}</p>
              <p class="library-empty-copy">{{ t('library_bookmark_importing_body') }}</p>
              <p class="library-import-detail">{{ bookmarkImportDetailLine }}</p>
              <AppLinearProgress
                v-if="bookmarkImportPercent === undefined"
                class="library-import-bar"
                :aria-label="t('library_bookmark_import_progress_aria')"
              />
              <AppLinearProgress
                v-else
                class="library-import-bar"
                :value="bookmarkImportPercent"
                :aria-label="t('library_bookmark_import_progress_aria')"
              />
            </div>
            <div v-else-if="showBookmarkImportFailedEmpty" class="library-empty" role="alert">
              <p class="library-empty-title">{{ t('library_bookmark_import_failed_title') }}</p>
              <p class="library-empty-copy">{{ bookmarkImportFailedReason }}</p>
              <AppButton
                type="button"
                variant="tonal"
                :disabled="retryingBookmarkImport"
                @click="retryBookmarkImport"
              >
                {{
                  retryingBookmarkImport
                    ? t('library_bookmark_import_progress_indeterminate')
                    : t('library_bookmark_import_retry')
                }}
              </AppButton>
            </div>
            <div
              v-else-if="!bookmarkIndex || bookmarkIndex.bookmarkCount === 0"
              class="library-empty"
            >
              <p class="library-empty-title">{{ activeTab.emptyTitle }}</p>
              <p class="library-empty-copy">{{ activeTab.emptyBody }}</p>
            </div>
            <div v-else class="library-bookmark-tree-host">
              <div v-if="showBookmarkImportProgress" class="library-import-banner" role="status">
                <p class="library-import-detail">{{ bookmarkImportDetailLine }}</p>
                <AppLinearProgress
                  v-if="bookmarkImportPercent === undefined"
                  class="library-import-bar"
                  :aria-label="t('library_bookmark_import_progress_aria')"
                />
                <AppLinearProgress
                  v-else
                  class="library-import-bar"
                  :value="bookmarkImportPercent"
                  :aria-label="t('library_bookmark_import_progress_aria')"
                />
              </div>
              <div
                v-else-if="showBookmarkImportFailedBanner"
                class="library-import-banner library-import-banner--failed"
                role="alert"
              >
                <p class="library-import-detail">{{ bookmarkImportFailedReason }}</p>
                <AppButton
                  type="button"
                  variant="tonal"
                  :disabled="retryingBookmarkImport"
                  @click="retryBookmarkImport"
                >
                  {{
                    retryingBookmarkImport
                      ? t('library_bookmark_import_progress_indeterminate')
                      : t('library_bookmark_import_retry')
                  }}
                </AppButton>
              </div>
              <div v-if="showBookmarkSearchNoResults" class="library-empty" role="status">
                <p class="library-empty-title">{{ t('library_search_no_results_title') }}</p>
                <p class="library-empty-copy">{{ t('library_search_no_results_body') }}</p>
              </div>
              <BookmarkLibraryTree
                v-show="!showBookmarkSearchNoResults"
                :index="bookmarkIndex"
                :query="debouncedQuery"
                :show-unsynced-flags="bookmarkSyncReady"
                :show-detail-export-selection="detailExportMode"
                :selected-detail-export-ids="selectedDetailExportIds"
                :detail-export-selection-revision="detailExportSelectionRevision"
                :deleting-id="deletingId"
                :auto-extract-index="autoExtractIndex"
                @edit-note="openNoteEditor"
                @open-bookmark="handleOpenBookmark"
                @toggle-detail-export-selection="handleToggleDetailExportSelection"
                @delete-bookmark="handleDeleteBookmark"
                @visible-row-count-change="handleBookmarkVisibleRowCountChange"
              />
            </div>
          </template>

          <template v-else>
            <p v-if="showExcerptListCapNote" class="library-list-cap-note" role="status">
              {{ excerptListCapNoteLabel }}
            </p>
            <div v-if="showExcerptSearchNoResults" class="library-empty" role="status">
              <p class="library-empty-title">{{ t('library_search_no_results_title') }}</p>
              <p class="library-empty-copy">{{ t('library_search_no_results_body') }}</p>
            </div>
            <div v-else-if="listRows.length === 0" class="library-empty">
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
                :auto-extract-index="autoExtractIndex"
                @activate="handleLibraryRowActivate"
                @edit-note="openNoteEditor"
                @delete-excerpt="handleDeleteExcerpt"
              />
            </div>
            <div v-if="showExcerptListCapNote" class="library-load-more">
              <AppButton
                type="button"
                variant="tonal"
                :disabled="loadingMoreExcerpts"
                @click="loadMoreExcerpts"
              >
                {{ loadingMoreExcerpts ? t('library_loading') : t('library_load_more') }}
              </AppButton>
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
      :title="deleteConfirmTitle"
      :body="deleteConfirmBody"
      :cancel-label="t('selection_toolbar_note_cancel')"
      :confirm-label="deleteConfirmTitle"
      confirm-tone="danger"
      :error="deleteConfirmError || undefined"
      :loading="deletingId !== null"
      @close="closeDeleteConfirm"
      @confirm="confirmDeleteMemoryItem"
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

  /* 向上格式菜单必须溢出 slot 可见；勿改回 hidden（F4：hidden 会裁掉菜单） */
  overflow: visible;
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
  font-size: var(--text-display);
  line-height: var(--leading-tight);
}

.library-subtitle {
  margin: 0;
  font-size: var(--text-body);
  line-height: var(--leading-relaxed);
  color: var(--on-surface-muted);
}

.library-review-entry {
  margin: var(--space-xs) 0 0;
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

.library-toolbar {
  display: flex;
  flex-wrap: wrap;
  flex-shrink: 0;
  align-items: center;
  gap: var(--space-sm);
  margin-bottom: var(--space-sm);
}

.library-search-input {
  flex: 1 1 12rem;
  box-sizing: border-box;
  min-width: 0;
  margin: 0;
  padding: var(--space-sm);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  font-family: inherit;
  font-size: var(--text-body);
  line-height: var(--leading-relaxed);
  color: var(--on-surface);
  background: var(--surface-white);
}

.library-search-input::placeholder {
  color: var(--on-surface-muted);
}

.library-search-input:focus {
  outline: 2px solid var(--focus-ring);
  outline-offset: 1px;
}

.library-sort-label {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  gap: var(--space-2xs);
  font-size: var(--text-caption);
  color: var(--on-surface-muted);
}

.library-sort-label-text {
  white-space: nowrap;
}

.library-sort-select {
  margin: 0;
  padding: var(--space-2xs) var(--space-sm);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  font: inherit;
  font-size: var(--text-body);
  color: var(--on-surface);
  background: var(--surface-white);
}

.library-sort-select:focus {
  outline: 2px solid var(--focus-ring);
  outline-offset: 1px;
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

.library-list-cap-note {
  flex-shrink: 0;
  margin: 0 0 var(--space-sm);
  font-size: var(--text-meta);
  line-height: var(--leading-snug);
  color: var(--on-surface-muted);
}

.library-status,
.library-error {
  margin: 0;
  font-size: var(--text-body);
  line-height: var(--leading-relaxed);
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
  font-size: var(--text-body);
  font-weight: var(--font-weight-semibold);
}

.library-empty-copy {
  margin: 0;
  font-size: var(--text-meta);
  line-height: var(--leading-relaxed);
  color: var(--on-surface-muted);
}

.library-import-banner {
  display: grid;
  flex-shrink: 0;
  gap: var(--space-xs);
  margin-bottom: var(--space-sm);
  justify-items: start;
}

.library-load-more {
  display: flex;
  flex-shrink: 0;
  justify-content: center;
  margin-top: var(--space-sm);
}

.library-import-detail {
  margin: 0;
  font-size: var(--text-meta);
  line-height: var(--leading-snug);
  color: var(--on-surface-muted);
}

.library-import-bar {
  width: 100%;
  max-width: 20rem;
}

.library-note-dialog-target {
  margin: 0;
  font-size: var(--text-meta);
  line-height: var(--leading-snug);
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
