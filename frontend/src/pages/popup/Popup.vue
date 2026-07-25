<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'

import type { ChromeBookmarkImportState } from '@/core/memory/chrome-bookmark-import-state'
import { getChromeBookmarkImportPercent } from '@/core/memory/chrome-bookmark-import-state'
import {
  explainRecallMatch,
  formatRecallClueEcho,
  shortenClueForRetry
} from '@/core/recall/explain-recall-match'
import {
  getPopupIdleEmptyCopy,
  getPopupNoMatchCopy,
  type PopupLibraryState
} from '@/core/recall/popup-empty-copy'
import type { RecallMatch, RecallResult } from '@/core/recall/recall-result'
import { getMemoryItemDisplay } from '@/core/recall/recall-result'
import { getMemoryItemOpenHref } from '@/core/recall/memory-open-href'
import { openExtensionOptionsPage } from '@/infrastructure/browser/options-page'
import { t, translate } from '@/infrastructure/i18n/t'
import {
  fetchChromeBookmarkImportStatus,
  listMemoryItems,
  recallWithClue
} from '@/infrastructure/messaging/background-client'
import AppPageHeader from '@/infrastructure/ui/AppPageHeader.vue'

defineOptions({ name: 'PopupPage' })

type RecallViewState = 'idle' | 'loading' | 'result' | 'no_match' | 'error'

const clue = ref('')
const viewState = ref<RecallViewState>('idle')
const recallResult = ref<RecallResult | null>(null)
const errorMessage = ref('')
const importState = ref<ChromeBookmarkImportState | null>(null)
const libraryState = ref<PopupLibraryState>('unknown')

let importPollTimer: ReturnType<typeof setInterval> | null = null

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
    return state.error ?? t('popup_import_failed_fallback')
  }
  if (state.totalCount && state.totalCount > 0) {
    return t('popup_import_progress', [String(state.importedCount), String(state.totalCount)])
  }
  return t('popup_import_progress_indeterminate')
})

const idleEmptyCopy = computed(() =>
  viewState.value === 'idle'
    ? getPopupIdleEmptyCopy(libraryState.value, isImporting.value, translate)
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
    translate
  )
)

const clueEcho = computed(() => {
  const resultClue = recallResult.value?.clue ?? clue.value
  return formatRecallClueEcho(resultClue, translate)
})

const topPickDisplay = computed(() => {
  const match = recallResult.value?.topPick
  return match ? toMatchCard(match, recallResult.value?.clue ?? clue.value) : null
})

const alsoPossibleCards = computed(() => {
  const resultClue = recallResult.value?.clue ?? clue.value
  return (recallResult.value?.alsoPossible ?? []).map(match => toMatchCard(match, resultClue))
})

function toMatchCard(match: RecallMatch, resultClue: string) {
  const display = getMemoryItemDisplay(match.item, translate)
  const explanation = explainRecallMatch(
    {
      clue: resultClue,
      matchedFields: match.matchedFields,
      item: match.item
    },
    translate
  )
  return {
    id: match.item.id,
    title: display.title,
    subtitle: display.subtitle,
    url: getMemoryItemOpenHref(match.item, {
      detailPageUrl: chrome.runtime.getURL('detail.html')
    }),
    excerpt: display.excerpt,
    typeLabel: display.typeLabel,
    reason: explanation.reasonLine
  }
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

onMounted(() => {
  void probeMemoryLibrary()
  startImportPolling()
})

onUnmounted(() => {
  stopImportPolling()
})

async function handleRecallSubmit() {
  const trimmed = clue.value.trim()
  if (!trimmed) {
    return
  }

  viewState.value = 'loading'
  errorMessage.value = ''
  recallResult.value = null

  try {
    const response = await recallWithClue({ clue: trimmed })
    if (!response.ok) {
      viewState.value = 'error'
      errorMessage.value = response.error
      return
    }

    recallResult.value = response.result
    viewState.value = response.result.outcome === 'no_match' ? 'no_match' : 'result'
    void probeMemoryLibrary()
  } catch (error) {
    viewState.value = 'error'
    errorMessage.value = error instanceof Error ? error.message : t('popup_recall_failed')
  }
}

function handleShortenRetry() {
  const next = shortenedClue.value
  if (!next) {
    return
  }
  clue.value = next
  void handleRecallSubmit()
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
</script>

<template>
  <main class="recall-shell">
    <header class="recall-header">
      <AppPageHeader class="recall-header-top" @navigate-error="handleNavigateError" />
      <h1 class="recall-title">{{ t('popup_title') }}</h1>
      <p class="recall-subtitle">{{ t('popup_subtitle') }}</p>

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

    <form class="recall-form" @submit.prevent="handleRecallSubmit">
      <label class="recall-label" for="recall-clue">{{ t('popup_clue_label') }}</label>
      <textarea
        id="recall-clue"
        v-model="clue"
        class="recall-input"
        rows="3"
        :placeholder="t('popup_clue_placeholder')"
      />
      <md-filled-button type="submit" :disabled="!clue.trim() || viewState === 'loading'">
        {{ viewState === 'loading' ? t('popup_submitting') : t('popup_submit') }}
      </md-filled-button>
    </form>

    <section v-if="viewState === 'idle' && idleEmptyCopy" class="recall-empty" aria-live="polite">
      <p class="recall-empty-title">{{ idleEmptyCopy.title }}</p>
      <p class="recall-empty-copy">{{ idleEmptyCopy.body }}</p>
      <div class="recall-empty-actions">
        <md-text-button type="button" @click="handleOpenSettings">
          {{ t('popup_open_settings') }}
        </md-text-button>
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
      class="recall-results"
      aria-live="polite"
    >
      <div class="recall-top-pick">
        <p class="recall-section-label">{{ t('popup_section_top_pick') }}</p>
        <p v-if="clueEcho" class="recall-clue-echo">{{ clueEcho }}</p>
        <a
          class="recall-card recall-card--top"
          :href="topPickDisplay.url"
          target="_blank"
          rel="noopener noreferrer"
        >
          <div class="recall-card-meta">
            <span class="recall-type">{{ topPickDisplay.typeLabel }}</span>
            <span class="recall-reason">{{ topPickDisplay.reason }}</span>
          </div>
          <p v-if="topPickDisplay.excerpt" class="recall-card-body">{{ topPickDisplay.excerpt }}</p>
          <h2 v-else class="recall-card-title">{{ topPickDisplay.title }}</h2>
          <p class="recall-card-subtitle">{{ topPickDisplay.subtitle }}</p>
        </a>
        <p class="recall-affirmation">{{ t('popup_affirmation') }}</p>
      </div>

      <div v-if="alsoPossibleCards.length > 0" class="recall-also">
        <p class="recall-section-label">{{ t('popup_section_also_possible') }}</p>
        <ul class="recall-also-list">
          <li v-for="item in alsoPossibleCards" :key="item.id">
            <a class="recall-card" :href="item.url" target="_blank" rel="noopener noreferrer">
              <div class="recall-card-meta">
                <span class="recall-type">{{ item.typeLabel }}</span>
                <span class="recall-reason">{{ item.reason }}</span>
              </div>
              <p v-if="item.excerpt" class="recall-card-body recall-card-body--compact">
                {{ item.excerpt }}
              </p>
              <h3 v-else class="recall-card-title recall-card-title--compact">{{ item.title }}</h3>
              <p class="recall-card-subtitle">{{ item.subtitle }}</p>
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

.recall-title {
  margin: 0 0 8px;
  font-size: 24px;
  line-height: 1.2;
}

.recall-subtitle {
  margin: 0 0 12px;
  font-size: 14px;
  line-height: 1.5;
  color: var(--md-sys-color-on-surface-variant);
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
  gap: 10px;
}

.recall-label {
  font-size: 13px;
  font-weight: 600;
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

.recall-clue-echo {
  margin: -4px 0 8px;
  font-size: 12px;
  line-height: 1.4;
  color: var(--md-sys-color-on-surface-variant);
}

.recall-top-pick {
  display: grid;
  gap: 8px;
}

.recall-affirmation {
  margin: 0;
  font-size: 12px;
  line-height: 1.4;
  color: var(--md-sys-color-tertiary);
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

.recall-reason {
  font-size: 11px;
  color: var(--md-sys-color-on-surface-variant);
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
