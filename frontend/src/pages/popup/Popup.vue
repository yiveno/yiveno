<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'

import type { ChromeBookmarkImportState } from '@/core/memory/chrome-bookmark-import-state'
import { getChromeBookmarkImportPercent } from '@/core/memory/chrome-bookmark-import-state'
import { shortenClueForRetry } from '@/core/recall/explain-recall-match'
import {
  getPopupIdleEmptyCopy,
  getPopupNoMatchCopy,
  type PopupLibraryState
} from '@/core/recall/popup-empty-copy'
import type { RecallMatch, RecallResult } from '@/core/recall/recall-result'
import { getMemoryItemDisplay } from '@/core/recall/recall-result'
import { buildRecallCardHighlightParts } from '@/core/recall/highlight-recall-text'
import { getMemoryItemOpenHref } from '@/core/recall/memory-open-href'
import { listDeltaFromNavigateDirection, moveListSelectionIndex } from '@/core/ui/list-selection'
import { interpretKeyboardCommand } from '@/core/ui/keyboard-command'
import { openExtensionOptionsPage } from '@/infrastructure/browser/options-page'
import { tImportStateError, tRecallError } from '@/infrastructure/i18n/background-error'
import { t } from '@/infrastructure/i18n/t'
import {
  fetchChromeBookmarkImportStatus,
  listMemoryItems,
  recallWithClue,
  recordMemoryOpen,
  recordRecallDismiss
} from '@/infrastructure/messaging/background-client'
import {
  consumePopupRecallPrefill,
  markFirstRecallOpenDone
} from '@/infrastructure/storage/first-recall-onboarding-storage'
import AppPageHeader from '@/infrastructure/ui/AppPageHeader.vue'
import MaterialSymbolIcon from '@/infrastructure/ui/icons/MaterialSymbolIcon.vue'
import RecallResultCard, { type PopupRecallCardModel } from '@/pages/popup/RecallResultCard.vue'

defineOptions({ name: 'PopupPage' })

type RecallViewState = 'idle' | 'loading' | 'result' | 'need_a_clue' | 'no_match' | 'error'

/** 停输后触发找回的防抖间隔（毫秒）。 */
const RECALL_DEBOUNCE_MS = 400

const clue = ref('')
const clueInputRef = ref<HTMLTextAreaElement | null>(null)
/** Also 列表滚动容器；Top Pick 固定不滚。 */
const alsoScrollRef = ref<HTMLElement | null>(null)
const viewState = ref<RecallViewState>('idle')
const recallResult = ref<RecallResult | null>(null)
/** 有旧结果时后台刷新，避免拆掉列表 DOM。 */
const isRecallRefreshing = ref(false)
const errorMessage = ref('')
const importState = ref<ChromeBookmarkImportState | null>(null)
const libraryState = ref<PopupLibraryState>('unknown')

let importPollTimer: ReturnType<typeof setInterval> | null = null
let recallDebounceTimer: ReturnType<typeof setTimeout> | null = null
/** 递增以丢弃过期找回响应，避免慢请求覆盖新线索结果。 */
let recallRequestId = 0

/** 是否展示结果列表（含刷新中的旧结果；Need A Clue 仅有弱候选）。 */
const showRecallResults = computed(
  () =>
    Boolean(recallResult.value?.topPick || (recallResult.value?.alsoPossible?.length ?? 0) > 0) &&
    (viewState.value === 'result' || viewState.value === 'need_a_clue' || isRecallRefreshing.value)
)

const importProgressPercent = computed(() => {
  if (!importState.value) {
    return 0
  }
  return getChromeBookmarkImportPercent(importState.value)
})

const showImportProgress = computed(() => {
  const status = importState.value?.status
  return status === 'running' || status === 'failed'
})

const isImporting = computed(() => importState.value?.status === 'running')

const importProgressLabel = computed(() => {
  const state = importState.value
  if (!state) {
    return ''
  }
  if (state.status === 'failed') {
    return state.errorCode ? tImportStateError(state.errorCode) : t('popup_import_failed_fallback')
  }
  if (state.totalCount && state.totalCount > 0) {
    return t('popup_import_progress', [String(state.importedCount), String(state.totalCount)])
  }
  return t('popup_import_progress_indeterminate')
})

const idleEmptyCopy = computed(() =>
  viewState.value === 'idle'
    ? getPopupIdleEmptyCopy(libraryState.value, isImporting.value, t)
    : null
)

const shortenedClue = computed(() => shortenClueForRetry(clue.value))

const shortenRetryLabel = computed(() => {
  if (!shortenedClue.value) {
    return t('popup_shorten_retry')
  }
  return t('popup_shorten_retry_with_clue', shortenedClue.value)
})

const noMatchCopy = computed(() =>
  getPopupNoMatchCopy(
    {
      library: libraryState.value,
      clue: clue.value,
      canShorten: shortenedClue.value !== null
    },
    t
  )
)

const topPickDisplay = computed(() => {
  const match = recallResult.value?.topPick
  return match ? toMatchCard(match, recallResult.value?.clue ?? clue.value) : null
})

const alsoPossibleCards = computed(() => {
  const resultClue = recallResult.value?.clue ?? clue.value
  return (recallResult.value?.alsoPossible ?? []).map(match => toMatchCard(match, resultClue))
})

/** Top Pick + Also Possible 扁平列表，供键盘上下切换。 */
const navigableResultCards = computed(() => {
  const top = topPickDisplay.value
  if (top) {
    return [top, ...alsoPossibleCards.value]
  }
  // Need A Clue：无 Top，仅弱候选可键盘浏览
  return alsoPossibleCards.value
})

const keyboardSelectedIndex = ref(-1)
/** 当前展开的重复组代表 id；同时只展开一组。 */
const expandedDuplicateGroupId = ref<string | null>(null)

watch(
  navigableResultCards,
  cards => {
    // 结果集替换时回到首项并收起展开；刷新期间 recallResult 未变则本 watch 不触发
    keyboardSelectedIndex.value = cards.length > 0 ? 0 : -1
    expandedDuplicateGroupId.value = null
  },
  { flush: 'sync' }
)

function toMatchCard(
  match: RecallMatch,
  resultClue: string,
  options: { includeSiblings?: boolean } = {}
): PopupRecallCardModel {
  const display = getMemoryItemDisplay(match.item, t)
  const highlights = buildRecallCardHighlightParts({
    clue: resultClue,
    matchedFields: match.matchedFields,
    item: match.item,
    title: display.title,
    subtitle: display.subtitle,
    ...(display.excerpt === undefined ? {} : { excerpt: display.excerpt }),
    ...(display.note === undefined ? {} : { note: display.note })
  })

  const duplicateTotalCount = match.duplicateGroup?.totalCount
  const duplicateLabel =
    duplicateTotalCount !== undefined && duplicateTotalCount >= 2
      ? match.item.type === 'bookmark'
        ? t('popup_duplicate_group_bookmark', String(duplicateTotalCount))
        : t('popup_duplicate_group_excerpt', String(duplicateTotalCount))
      : undefined

  const siblings =
    options.includeSiblings !== false && match.duplicateGroup
      ? match.duplicateGroup.siblings.map(sibling =>
          toMatchCard(sibling, resultClue, { includeSiblings: false })
        )
      : undefined

  return {
    id: match.item.id,
    title: display.title,
    subtitle: display.subtitle,
    url: getMemoryItemOpenHref(match.item, {
      detailPageUrl: chrome.runtime.getURL('detail.html')
    }),
    excerpt: display.excerpt,
    note: display.note,
    typeLabel: display.typeLabel,
    titleParts: highlights.titleParts,
    subtitleParts: highlights.subtitleParts,
    excerptParts: highlights.excerptParts,
    noteParts: highlights.noteParts,
    ...(duplicateTotalCount !== undefined && duplicateTotalCount >= 2
      ? { duplicateTotalCount, duplicateLabel }
      : {}),
    ...(siblings && siblings.length > 0 ? { siblings } : {})
  }
}

function isDuplicateGroupExpanded(cardId: string): boolean {
  return expandedDuplicateGroupId.value === cardId
}

function toggleDuplicateGroup(cardId: string): void {
  expandedDuplicateGroupId.value = expandedDuplicateGroupId.value === cardId ? null : cardId
}

function handleCardOpen(payload: { id: string; url: string }): void {
  handleRecallResultOpen(payload.id, payload.url)
}

/** 「都不是这些」：写否定反馈，清空结果，请用户再补线索（最多一轮追问）。 */
async function handleDismissCandidates(): Promise<void> {
  const ids = navigableResultCards.value.map(card => card.id)
  if (ids.length > 0) {
    void recordRecallDismiss({ ids }).catch(() => {
      // 忽略：反馈失败不阻塞继续补线索
    })
  }
  recallResult.value = null
  viewState.value = 'idle'
  errorMessage.value = ''
  await nextTick()
  clueInputRef.value?.focus()
}

/** 打开结果时写行为信号；摘录进详情页由 Detail 记，避免双计。 */
function handleRecallResultOpen(memoryItemId: string, openUrl: string): void {
  void markFirstRecallOpenDone().catch(() => {
    // 忽略：引导标记失败不影响打开
  })
  if (openUrl.includes('/detail.html')) {
    return
  }
  void recordMemoryOpen({ id: memoryItemId }).catch(() => {
    // 忽略：打开记录失败不影响用户跳转
  })
}

function isKeyboardSelected(index: number): boolean {
  return keyboardSelectedIndex.value === index
}

/** 仅在 Also 滚动容器内滚动选中项；Top Pick 不在此容器内。 */
function scrollSelectedResultIntoView(): void {
  const container = alsoScrollRef.value
  const selected = document.getElementById(`recall-result-${keyboardSelectedIndex.value}`)
  if (!container || !selected || !container.contains(selected)) {
    return
  }

  const containerRect = container.getBoundingClientRect()
  const selectedRect = selected.getBoundingClientRect()
  if (selectedRect.top < containerRect.top) {
    container.scrollTop -= containerRect.top - selectedRect.top
    return
  }
  if (selectedRect.bottom > containerRect.bottom) {
    container.scrollTop += selectedRect.bottom - containerRect.bottom
  }
}

/** 回车打开当前键盘选中项（与点击卡片同路径）。 */
function activateKeyboardSelectedResult(): void {
  const item = navigableResultCards.value[keyboardSelectedIndex.value]
  if (!item) {
    return
  }
  handleRecallResultOpen(item.id, item.url)
  window.open(item.url, '_blank', 'noopener,noreferrer')
}

/**
 * 线索框内方向键切换结果、回车打开；有结果时拦截默认换行/光标移动。
 */
function handleClueKeydown(event: KeyboardEvent): void {
  if (!showRecallResults.value || navigableResultCards.value.length === 0) {
    return
  }

  const command = interpretKeyboardCommand(event)
  if (command.type === 'none') {
    return
  }

  if (command.type === 'navigate') {
    const delta = listDeltaFromNavigateDirection(command.direction)
    if (delta === null) {
      return
    }
    event.preventDefault()
    keyboardSelectedIndex.value = moveListSelectionIndex({
      currentIndex: keyboardSelectedIndex.value,
      itemCount: navigableResultCards.value.length,
      delta
    })
    void nextTick(() => {
      scrollSelectedResultIntoView()
    })
    return
  }

  event.preventDefault()
  activateKeyboardSelectedResult()
}

async function probeMemoryLibrary() {
  try {
    const response = await listMemoryItems({ limit: 1 })
    if (!response.ok || !('total' in response)) {
      libraryState.value = 'unknown'
      return
    }
    libraryState.value = response.total > 0 ? 'ready' : 'empty'
  } catch {
    libraryState.value = 'unknown'
  }
}

async function refreshImportStatus() {
  const response = await fetchChromeBookmarkImportStatus()
  if (!response.ok) {
    return
  }
  importState.value = response.state

  if (response.state?.status === 'completed' || response.state?.status === 'failed') {
    stopImportPolling()
    if (response.state.status === 'completed') {
      void probeMemoryLibrary()
    }
  }
}

function startImportPolling() {
  if (importPollTimer) {
    return
  }
  void refreshImportStatus()
  importPollTimer = setInterval(() => {
    void refreshImportStatus()
  }, 500)
}

function stopImportPolling() {
  if (importPollTimer) {
    clearInterval(importPollTimer)
    importPollTimer = null
  }
}

function clearRecallDebounce(): void {
  if (recallDebounceTimer !== null) {
    clearTimeout(recallDebounceTimer)
    recallDebounceTimer = null
  }
}

/** 线索变化：空则回 idle；非空则防抖后找回。 */
function scheduleRecallFromClue(): void {
  clearRecallDebounce()
  const trimmed = clue.value.trim()
  if (!trimmed) {
    recallRequestId += 1
    isRecallRefreshing.value = false
    viewState.value = 'idle'
    recallResult.value = null
    errorMessage.value = ''
    return
  }

  recallDebounceTimer = setTimeout(() => {
    recallDebounceTimer = null
    void runRecall(trimmed)
  }, RECALL_DEBOUNCE_MS)
}

async function runRecall(trimmedClue: string): Promise<void> {
  const trimmed = trimmedClue.trim()
  if (!trimmed) {
    isRecallRefreshing.value = false
    viewState.value = 'idle'
    recallResult.value = null
    errorMessage.value = ''
    return
  }

  const requestId = ++recallRequestId
  errorMessage.value = ''
  const keepStaleResults = navigableResultCards.value.length > 0
  if (keepStaleResults) {
    isRecallRefreshing.value = true
  } else {
    isRecallRefreshing.value = false
    viewState.value = 'loading'
    recallResult.value = null
  }

  try {
    const response = await recallWithClue({ clue: trimmed })
    if (requestId !== recallRequestId) {
      return
    }
    isRecallRefreshing.value = false
    if (!response.ok) {
      viewState.value = 'error'
      recallResult.value = null
      errorMessage.value = tRecallError(response.errorCode)
      return
    }

    recallResult.value = response.result
    if (response.result.outcome === 'no_match') {
      viewState.value = 'no_match'
    } else if (response.result.outcome === 'need_a_clue') {
      viewState.value = 'need_a_clue'
    } else {
      viewState.value = 'result'
    }
    void probeMemoryLibrary()
    void nextTick(() => {
      if (alsoScrollRef.value) {
        alsoScrollRef.value.scrollTop = 0
      }
      scrollSelectedResultIntoView()
      if (response.result.outcome === 'need_a_clue') {
        clueInputRef.value?.focus()
      }
    })
  } catch {
    if (requestId !== recallRequestId) {
      return
    }
    isRecallRefreshing.value = false
    viewState.value = 'error'
    recallResult.value = null
    errorMessage.value = t('popup_recall_failed')
  }
}

function handleShortenRetry() {
  const next = shortenedClue.value
  if (!next) {
    return
  }
  clue.value = next
  clearRecallDebounce()
  void runRecall(next)
}

function handleNavigateError(message: string) {
  errorMessage.value = message
  viewState.value = 'error'
}

async function handleOpenSettings() {
  try {
    await openExtensionOptionsPage()
  } catch {
    handleNavigateError(t('error_open_settings'))
  }
}

watch(clue, () => {
  scheduleRecallFromClue()
})

onMounted(() => {
  void nextTick(() => {
    clueInputRef.value?.focus()
  })
  void (async () => {
    try {
      const prefill = await consumePopupRecallPrefill()
      if (prefill) {
        clue.value = prefill
      }
    } catch {
      // 忽略：无预填不阻塞 Popup
    }
  })()
  void probeMemoryLibrary()
  startImportPolling()
})

onUnmounted(() => {
  clearRecallDebounce()
  recallRequestId += 1
  stopImportPolling()
})
</script>

<template>
  <main class="recall-shell">
    <header class="recall-header">
      <AppPageHeader class="recall-header-top" @navigate-error="handleNavigateError" />

      <section
        v-if="showImportProgress"
        class="recall-import"
        :class="{ 'recall-import--error': importState?.status === 'failed' }"
        aria-live="polite"
      >
        <p class="recall-import-label">{{ importProgressLabel }}</p>
        <md-linear-progress
          v-if="importState?.status === 'running'"
          :value="importProgressPercent / 100"
          :aria-label="t('popup_import_progress_aria')"
        />
      </section>
    </header>

    <div class="recall-form">
      <textarea
        id="recall-clue"
        ref="clueInputRef"
        v-model="clue"
        class="recall-input"
        rows="2"
        :aria-label="t('popup_clue_input_aria')"
        :placeholder="t('popup_clue_placeholder')"
        :aria-controls="showRecallResults ? 'recall-results' : undefined"
        :aria-activedescendant="
          showRecallResults && keyboardSelectedIndex >= 0
            ? `recall-result-${keyboardSelectedIndex}`
            : undefined
        "
        @keydown="handleClueKeydown"
      />
      <p v-if="isRecallRefreshing" class="recall-refresh-hint" role="status" aria-live="polite">
        {{ t('popup_filtering_status') }}
      </p>
    </div>

    <div class="recall-body">
      <section v-if="viewState === 'idle' && idleEmptyCopy" class="recall-empty" aria-live="polite">
        <p class="recall-empty-title">{{ idleEmptyCopy.title }}</p>
        <p class="recall-empty-copy">{{ idleEmptyCopy.body }}</p>
        <div class="recall-empty-actions">
          <md-icon-button
            type="button"
            :title="t('popup_open_settings')"
            :aria-label="t('popup_open_settings')"
            @click="handleOpenSettings"
          >
            <MaterialSymbolIcon name="settings" size="22px" />
          </md-icon-button>
        </div>
      </section>

      <p
        v-else-if="viewState === 'loading' && !showRecallResults"
        class="recall-status"
        role="status"
      >
        {{ t('popup_filtering_status') }}
      </p>

      <p v-else-if="viewState === 'error'" class="recall-error" role="alert">
        {{ errorMessage }}
      </p>

      <section v-else-if="viewState === 'no_match'" class="recall-empty" aria-live="polite">
        <p class="recall-empty-title">{{ noMatchCopy.title }}</p>
        <p class="recall-empty-copy">{{ noMatchCopy.body }}</p>
        <div v-if="noMatchCopy.showShortenRetry" class="recall-empty-actions">
          <md-outlined-button type="button" @click="handleShortenRetry">
            {{ shortenRetryLabel }}
          </md-outlined-button>
        </div>
      </section>

      <section
        v-else-if="showRecallResults"
        id="recall-results"
        class="recall-results"
        aria-live="polite"
      >
        <div
          v-if="viewState === 'need_a_clue' || (!topPickDisplay && alsoPossibleCards.length > 0)"
          class="recall-need-clue"
        >
          <p class="recall-need-clue-title">{{ t('popup_need_a_clue_title') }}</p>
          <p class="recall-need-clue-copy">{{ t('popup_need_a_clue_body') }}</p>
        </div>

        <div v-if="topPickDisplay" class="recall-top-pick">
          <p class="recall-section-label">{{ t('popup_section_top_pick') }}</p>
          <RecallResultCard
            :card="topPickDisplay"
            result-dom-id="recall-result-0"
            :keyboard-selected="isKeyboardSelected(0)"
            top-pick
            :expanded="isDuplicateGroupExpanded(topPickDisplay.id)"
            :expand-label="t('popup_duplicate_expand')"
            :collapse-label="t('popup_duplicate_collapse')"
            :note-field-label="t('detail_note_label')"
            @open="handleCardOpen"
            @toggle-expand="toggleDuplicateGroup(topPickDisplay.id)"
          />
        </div>

        <div v-if="alsoPossibleCards.length > 0" class="recall-also">
          <p class="recall-section-label">
            {{
              topPickDisplay
                ? t('popup_section_also_possible')
                : t('popup_section_possible_matches')
            }}
          </p>
          <ul ref="alsoScrollRef" class="recall-also-list">
            <li v-for="(item, alsoIndex) in alsoPossibleCards" :key="item.id">
              <RecallResultCard
                :card="item"
                :result-dom-id="`recall-result-${topPickDisplay ? alsoIndex + 1 : alsoIndex}`"
                :keyboard-selected="isKeyboardSelected(topPickDisplay ? alsoIndex + 1 : alsoIndex)"
                compact
                :expanded="isDuplicateGroupExpanded(item.id)"
                :expand-label="t('popup_duplicate_expand')"
                :collapse-label="t('popup_duplicate_collapse')"
                :note-field-label="t('detail_note_label')"
                @open="handleCardOpen"
                @toggle-expand="toggleDuplicateGroup(item.id)"
              />
            </li>
          </ul>
        </div>

        <div v-if="navigableResultCards.length > 0" class="recall-feedback-actions">
          <md-text-button type="button" @click="handleDismissCandidates">
            {{ t('popup_dismiss_candidates') }}
          </md-text-button>
        </div>
      </section>
    </div>
  </main>
</template>

<style scoped>
/*
 * Chrome popup 宽度锁死 360：长 URL / flex min-content 会把文档撑宽，
 * 右侧 padding 与卡片边框被视口裁切。勿给 html/body 设 height:100%。
 */
:global(html),
:global(body) {
  width: 360px;
  max-width: 360px;
  margin: 0;
  overflow-x: hidden;
}

.recall-shell {
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  /* 随内容增高；触顶后由 .recall-also 内部滚动（勿写死 height，避免单条结果底部大片空白） */
  max-height: 560px;
  padding: 16px 20px 12px;
  overflow: hidden;
  color: var(--md-sys-color-on-background);
  background: var(--md-sys-color-background);
}

.recall-header {
  flex-shrink: 0;
  min-width: 0;
  margin-bottom: 12px;
}

.recall-header-top {
  margin-bottom: 4px;
}

.recall-import {
  margin-bottom: 0;
  margin-top: 8px;
  padding: 10px 12px;
  border: 1px solid var(--md-sys-color-outline-variant);
  border-radius: var(--md-sys-shape-corner-medium, 10px);
  background: var(--md-sys-color-surface-container-lowest);
}

.recall-import--error {
  border-color: var(--md-sys-color-error-container);
  background: var(--md-sys-color-error-container);
}

.recall-import-label {
  margin: 0 0 8px;
  font-size: 12px;
  line-height: 1.4;
  color: var(--md-sys-color-on-surface-variant);
  overflow-wrap: anywhere;
}

.recall-import--error .recall-import-label {
  color: var(--md-sys-color-on-error-container);
}

.recall-form {
  display: grid;
  flex-shrink: 0;
  min-width: 0;
  gap: 6px;
  margin-bottom: 8px;
}

.recall-input {
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
  padding: 10px 12px;
  border: 1px solid var(--md-sys-color-outline);
  border-radius: var(--md-sys-shape-corner-medium, 10px);
  font-family: inherit;
  font-size: inherit;
  line-height: 1.5;
  color: inherit;
  background: var(--md-sys-color-surface-container-lowest);
  resize: none;
}

.recall-input:focus {
  border-color: var(--md-sys-color-primary);
  outline: 2px solid color-mix(in srgb, var(--md-sys-color-primary) 20%, transparent);
}

.recall-refresh-hint {
  margin: 0;
  font-size: 12px;
  line-height: 1.3;
  color: var(--md-sys-color-on-surface-variant);
}

.recall-body {
  /* 不 flex-grow，避免单条结果时被撑出底部空白 */
  flex: 0 1 auto;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.recall-status {
  margin: 8px 0 0;
  font-size: 13px;
  line-height: 1.4;
  color: var(--md-sys-color-on-surface-variant);
}

.recall-error {
  margin: 8px 0 0;
  font-size: 13px;
  line-height: 1.4;
  color: var(--md-sys-color-error);
}

.recall-empty {
  margin-top: 4px;
  padding: 14px;
  border: 1px dashed var(--md-sys-color-outline);
  border-radius: var(--md-sys-shape-corner-medium, 12px);
  background: var(--md-sys-color-surface-container-lowest);
}

.recall-empty-title {
  margin: 0 0 6px;
  font-size: 14px;
  font-weight: 600;
}

.recall-empty-copy {
  margin: 0;
  font-size: 13px;
  line-height: 1.5;
  color: var(--md-sys-color-on-surface-variant);
}

.recall-empty-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 10px;
}

.recall-results {
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-width: 0;
  min-height: 0;
  max-width: 100%;
}

.recall-need-clue {
  display: grid;
  gap: 4px;
}

.recall-need-clue-title {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--md-sys-color-on-surface);
}

.recall-need-clue-copy {
  margin: 0;
  font-size: 12px;
  line-height: 1.4;
  color: var(--md-sys-color-on-surface-variant);
}

.recall-section-label {
  margin: 0 0 8px;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.02em;
  color: var(--md-sys-color-on-surface-variant);
}

.recall-feedback-actions {
  display: flex;
  justify-content: flex-end;
  padding-top: 2px;
}

.recall-top-pick {
  flex-shrink: 0;
  display: grid;
  gap: 8px;
  min-width: 0;
}

/* Also 区块：标题固定，仅列表滚动 */
.recall-also {
  flex: 0 1 auto;
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
}

.recall-also > .recall-section-label {
  flex-shrink: 0;
}

.recall-also-list {
  display: grid;
  flex: 0 1 auto;
  gap: 8px;
  min-width: 0;
  min-height: 0;
  margin: 0;
  padding: 0 0 4px;
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior: contain;
  list-style: none;
}

.recall-also-list > li {
  min-width: 0;
  max-width: 100%;
}
</style>
