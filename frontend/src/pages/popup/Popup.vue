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
import {
  clampListSelectionIndex,
  listDeltaFromNavigateDirection,
  moveListSelectionIndex
} from '@/core/ui/list-selection'
import { interpretKeyboardCommand } from '@/core/ui/keyboard-command'
import { openExtensionOptionsPage } from '@/infrastructure/browser/options-page'
import { tImportStateError, tRecallError } from '@/infrastructure/i18n/background-error'
import { t } from '@/infrastructure/i18n/t'
import {
  fetchChromeBookmarkImportStatus,
  listMemoryItems,
  recallWithClue,
  recordMemoryOpen
} from '@/infrastructure/messaging/background-client'
import AppPageHeader from '@/infrastructure/ui/AppPageHeader.vue'
import MaterialSymbolIcon from '@/infrastructure/ui/icons/MaterialSymbolIcon.vue'
import RecallHighlightText from '@/pages/popup/RecallHighlightText.vue'

defineOptions({ name: 'PopupPage' })

type RecallViewState = 'idle' | 'loading' | 'result' | 'no_match' | 'error'

/** 停输后触发找回的防抖间隔（毫秒）。 */
const RECALL_DEBOUNCE_MS = 400

const clue = ref('')
const clueInputRef = ref<HTMLTextAreaElement | null>(null)
const viewState = ref<RecallViewState>('idle')
const recallResult = ref<RecallResult | null>(null)
const errorMessage = ref('')
const importState = ref<ChromeBookmarkImportState | null>(null)
const libraryState = ref<PopupLibraryState>('unknown')

let importPollTimer: ReturnType<typeof setInterval> | null = null
let recallDebounceTimer: ReturnType<typeof setTimeout> | null = null
/** 递增以丢弃过期找回响应，避免慢请求覆盖新线索结果。 */
let recallRequestId = 0

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
  if (!top) {
    return []
  }
  return [top, ...alsoPossibleCards.value]
})

const keyboardSelectedIndex = ref(-1)

watch(
  navigableResultCards,
  cards => {
    keyboardSelectedIndex.value = cards.length > 0 ? 0 : -1
  },
  { flush: 'sync' }
)

function toMatchCard(match: RecallMatch, resultClue: string) {
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
    noteParts: highlights.noteParts
  }
}

/** 打开结果时写行为信号；摘录进详情页由 Detail 记，避免双计。 */
function handleRecallResultOpen(memoryItemId: string, openUrl: string): void {
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

function selectResultByIndex(index: number): void {
  keyboardSelectedIndex.value = clampListSelectionIndex(index, navigableResultCards.value.length)
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
  if (viewState.value !== 'result' || navigableResultCards.value.length === 0) {
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
      document
        .getElementById(`recall-result-${keyboardSelectedIndex.value}`)
        ?.scrollIntoView({ block: 'nearest' })
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
    viewState.value = 'idle'
    recallResult.value = null
    errorMessage.value = ''
    return
  }

  const requestId = ++recallRequestId
  viewState.value = 'loading'
  errorMessage.value = ''
  recallResult.value = null

  try {
    const response = await recallWithClue({ clue: trimmed })
    if (requestId !== recallRequestId) {
      return
    }
    if (!response.ok) {
      viewState.value = 'error'
      errorMessage.value = tRecallError(response.errorCode)
      return
    }

    recallResult.value = response.result
    viewState.value = response.result.outcome === 'no_match' ? 'no_match' : 'result'
    void probeMemoryLibrary()
  } catch {
    if (requestId !== recallRequestId) {
      return
    }
    viewState.value = 'error'
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
        rows="3"
        :aria-label="t('popup_clue_input_aria')"
        :placeholder="t('popup_clue_placeholder')"
        :aria-controls="viewState === 'result' ? 'recall-results' : undefined"
        :aria-activedescendant="
          viewState === 'result' && keyboardSelectedIndex >= 0
            ? `recall-result-${keyboardSelectedIndex}`
            : undefined
        "
        @keydown="handleClueKeydown"
      />
    </div>

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

    <p v-else-if="viewState === 'loading'" class="recall-status" role="status">
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
      v-else-if="viewState === 'result' && topPickDisplay"
      id="recall-results"
      class="recall-results"
      aria-live="polite"
    >
      <div class="recall-top-pick">
        <p class="recall-section-label">{{ t('popup_section_top_pick') }}</p>
        <a
          id="recall-result-0"
          class="recall-card recall-card--top"
          :class="{ 'is-keyboard-selected': isKeyboardSelected(0) }"
          :href="topPickDisplay.url"
          target="_blank"
          rel="noopener noreferrer"
          @mouseenter="selectResultByIndex(0)"
          @click="handleRecallResultOpen(topPickDisplay.id, topPickDisplay.url)"
        >
          <div class="recall-card-meta">
            <span class="recall-type">{{ topPickDisplay.typeLabel }}</span>
          </div>
          <p v-if="topPickDisplay.excerpt" class="recall-card-body">
            <RecallHighlightText :parts="topPickDisplay.excerptParts" />
          </p>
          <h2 v-else class="recall-card-title">
            <RecallHighlightText :parts="topPickDisplay.titleParts" />
          </h2>
          <p v-if="topPickDisplay.note" class="recall-card-note">
            <span class="recall-card-note-label">{{ t('detail_note_label') }}</span>
            <RecallHighlightText :parts="topPickDisplay.noteParts" />
          </p>
          <p class="recall-card-subtitle">
            <RecallHighlightText :parts="topPickDisplay.subtitleParts" />
          </p>
        </a>
      </div>

      <div v-if="alsoPossibleCards.length > 0" class="recall-also">
        <p class="recall-section-label">{{ t('popup_section_also_possible') }}</p>
        <ul class="recall-also-list">
          <li v-for="(item, alsoIndex) in alsoPossibleCards" :key="item.id">
            <a
              :id="`recall-result-${alsoIndex + 1}`"
              class="recall-card"
              :class="{ 'is-keyboard-selected': isKeyboardSelected(alsoIndex + 1) }"
              :href="item.url"
              target="_blank"
              rel="noopener noreferrer"
              @mouseenter="selectResultByIndex(alsoIndex + 1)"
              @click="handleRecallResultOpen(item.id, item.url)"
            >
              <div class="recall-card-meta">
                <span class="recall-type">{{ item.typeLabel }}</span>
              </div>
              <p v-if="item.excerpt" class="recall-card-body recall-card-body--compact">
                <RecallHighlightText :parts="item.excerptParts" />
              </p>
              <h3 v-else class="recall-card-title recall-card-title--compact">
                <RecallHighlightText :parts="item.titleParts" />
              </h3>
              <p v-if="item.note" class="recall-card-note recall-card-note--compact">
                <span class="recall-card-note-label">{{ t('detail_note_label') }}</span>
                <RecallHighlightText :parts="item.noteParts" />
              </p>
              <p class="recall-card-subtitle">
                <RecallHighlightText :parts="item.subtitleParts" />
              </p>
            </a>
          </li>
        </ul>
      </div>
    </section>
  </main>
</template>

<style scoped>
.recall-shell {
  width: 360px;
  padding: 20px;
  color: var(--md-sys-color-on-background);
  background: var(--md-sys-color-background);
}

.recall-header {
  margin-bottom: 16px;
}

.recall-header-top {
  margin-bottom: 4px;
}

.recall-import {
  margin-bottom: 12px;
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
}

.recall-import--error .recall-import-label {
  color: var(--md-sys-color-on-error-container);
}

.recall-form {
  display: grid;
}

.recall-input {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--md-sys-color-outline);
  border-radius: var(--md-sys-shape-corner-medium, 10px);
  font-family: inherit;
  font-size: inherit;
  line-height: 1.5;
  color: inherit;
  background: var(--md-sys-color-surface-container-lowest);
  resize: vertical;
}

.recall-input:focus {
  border-color: var(--md-sys-color-primary);
  outline: 2px solid color-mix(in srgb, var(--md-sys-color-primary) 20%, transparent);
}

.recall-status {
  margin: 14px 0 0;
  font-size: 13px;
  line-height: 1.4;
  color: var(--md-sys-color-on-surface-variant);
}

.recall-error {
  margin: 14px 0 0;
  font-size: 13px;
  line-height: 1.4;
  color: var(--md-sys-color-error);
}

.recall-empty {
  margin-top: 16px;
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
  display: grid;
  gap: 16px;
  margin-top: 16px;
}

.recall-section-label {
  margin: 0 0 8px;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.02em;
  color: var(--md-sys-color-on-surface-variant);
}

.recall-top-pick {
  display: grid;
  gap: 8px;
}

.recall-card {
  display: block;
  padding: 12px;
  border: 1px solid var(--md-sys-color-outline-variant);
  border-radius: var(--md-sys-shape-corner-medium, 12px);
  text-decoration: none;
  color: inherit;
  background: var(--md-sys-color-surface-container-lowest);
}

.recall-card--top {
  border-color: var(--md-sys-color-primary);
  background: var(--md-sys-color-primary-container);
}

.recall-card:hover {
  background: var(--md-sys-color-surface-container-high);
}

.recall-card.is-keyboard-selected:not(.recall-card--top) {
  border-color: var(--md-sys-color-primary);
  background: var(--md-sys-color-primary-container);
}

.recall-card--top.is-keyboard-selected {
  outline: 2px solid var(--md-sys-color-primary);
  outline-offset: 1px;
}

.recall-card--top:hover {
  background: color-mix(
    in srgb,
    var(--md-sys-color-primary-container) 88%,
    var(--md-sys-color-primary) 12%
  );
}

.recall-card-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 6px;
}

.recall-type {
  font-size: 11px;
  font-weight: 600;
  color: var(--md-sys-color-primary);
}

.recall-card-title {
  margin: 0 0 4px;
  font-size: 16px;
  line-height: 1.35;
}

.recall-card-title--compact {
  font-size: 14px;
}

.recall-card-body {
  margin: 0 0 4px;
  font-size: 15px;
  line-height: 1.45;
  color: var(--md-sys-color-on-surface);
  display: -webkit-box;
  -webkit-line-clamp: 4;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.recall-card-body--compact {
  font-size: 13px;
  -webkit-line-clamp: 2;
}

.recall-card-note {
  margin: 0 0 4px;
  font-size: 13px;
  line-height: 1.4;
  color: var(--md-sys-color-on-surface);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.recall-card-note--compact {
  font-size: 12px;
  -webkit-line-clamp: 1;
}

.recall-card-note-label {
  margin-right: 4px;
  font-weight: 600;
  color: var(--md-sys-color-primary);
}

.recall-card-subtitle {
  margin: 0;
  font-size: 12px;
  color: var(--md-sys-color-on-surface-variant);
}

.recall-also-list {
  display: grid;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}
</style>
