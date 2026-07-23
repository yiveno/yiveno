<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'

import type { ChromeBookmarkImportState } from '@/core/memory/chrome-bookmark-import-state'
import { getChromeBookmarkImportPercent } from '@/core/memory/chrome-bookmark-import-state'
import type { RecallMatch, RecallResult } from '@/core/recall/recall-result'
import { formatMatchedFields, getMemoryItemDisplay } from '@/core/recall/recall-result'
import {
  captureCurrentPage,
  fetchChromeBookmarkImportStatus,
  recallWithClue
} from '@/infrastructure/messaging/background-client'

defineOptions({ name: 'PopupPage' })

type RecallViewState = 'idle' | 'loading' | 'result' | 'no_match' | 'error'
type CaptureViewState = 'idle' | 'saving' | 'saved' | 'error'

const clue = ref('')
const viewState = ref<RecallViewState>('idle')
const captureState = ref<CaptureViewState>('idle')
const recallResult = ref<RecallResult | null>(null)
const errorMessage = ref('')
const captureMessage = ref('')
const importState = ref<ChromeBookmarkImportState | null>(null)

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

const importProgressLabel = computed(() => {
  const state = importState.value
  if (!state) {
    return ''
  }
  if (state.status === 'failed') {
    return state.error ?? '书签导入失败，请重新加载扩展后重试'
  }
  if (state.totalCount && state.totalCount > 0) {
    return `正在导入书签 ${state.importedCount} / ${state.totalCount}`
  }
  return '正在导入书签…'
})

async function refreshImportStatus() {
  const response = await fetchChromeBookmarkImportStatus()
  if (!response.ok) {
    return
  }
  importState.value = response.state

  if (response.state?.status === 'completed' || response.state?.status === 'failed') {
    stopImportPolling()
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
  startImportPolling()
})

onUnmounted(() => {
  stopImportPolling()
})

const topPickDisplay = computed(() => {
  const match = recallResult.value?.topPick
  return match ? toMatchCard(match) : null
})

const alsoPossibleCards = computed(() => {
  return (recallResult.value?.alsoPossible ?? []).map(toMatchCard)
})

function toMatchCard(match: RecallMatch) {
  const display = getMemoryItemDisplay(match.item)
  return {
    id: match.item.id,
    title: display.title,
    subtitle: display.subtitle,
    url: display.url,
    excerpt: display.excerpt,
    typeLabel: display.typeLabel,
    reason: formatMatchedFields(match.matchedFields)
  }
}

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
  } catch (error) {
    viewState.value = 'error'
    errorMessage.value = error instanceof Error ? error.message : '找回失败，请稍后再试'
  }
}

async function handleCaptureCurrentPage() {
  captureState.value = 'saving'
  captureMessage.value = ''

  try {
    const response = await captureCurrentPage({ captureEntry: 'popup' })
    if (!response.ok) {
      captureState.value = 'error'
      captureMessage.value = response.error
      return
    }
    if (!('item' in response)) {
      captureState.value = 'error'
      captureMessage.value = '保存失败，请稍后再试'
      return
    }

    captureState.value = 'saved'
    const title =
      response.item.type === 'bookmark'
        ? response.item.payload.title
        : response.item.payload.pageTitle
    captureMessage.value = `已保存：${title}`
  } catch (error) {
    captureState.value = 'error'
    captureMessage.value = error instanceof Error ? error.message : '保存失败，请稍后再试'
  }
}
</script>

<template>
  <main class="recall-shell">
    <header class="recall-header">
      <p class="recall-eyebrow">Yiveno</p>
      <h1 class="recall-title">找到它！</h1>
      <p class="recall-subtitle">在你存过的东西里找，不用再去网上搜。</p>

      <section
        v-if="showImportProgress"
        class="recall-import"
        :class="{ 'recall-import--error': importState?.status === 'failed' }"
        aria-live="polite"
      >
        <p class="recall-import-label">{{ importProgressLabel }}</p>
        <div
          v-if="importState?.status === 'running'"
          class="recall-import-track"
          role="progressbar"
          :aria-valuenow="importProgressPercent"
          aria-valuemin="0"
          aria-valuemax="100"
        >
          <div class="recall-import-bar" :style="{ width: `${importProgressPercent}%` }" />
        </div>
      </section>

      <button
        class="recall-save-page"
        type="button"
        :disabled="captureState === 'saving'"
        @click="handleCaptureCurrentPage"
      >
        {{ captureState === 'saving' ? '正在保存…' : '保存当前页' }}
      </button>
      <p
        v-if="captureState === 'saved'"
        class="recall-save-feedback recall-save-feedback--success"
        role="status"
      >
        {{ captureMessage }}
      </p>
      <p
        v-else-if="captureState === 'error'"
        class="recall-save-feedback recall-save-feedback--error"
        role="alert"
      >
        {{ captureMessage }}
      </p>
    </header>

    <form class="recall-form" @submit.prevent="handleRecallSubmit">
      <label class="recall-label" for="recall-clue">还记得的任意一点线索</label>
      <textarea
        id="recall-clue"
        v-model="clue"
        class="recall-input"
        rows="3"
        placeholder="例如：上周那篇讲留存的、某个产品的分析…"
      />
      <button
        class="recall-submit"
        type="submit"
        :disabled="!clue.trim() || viewState === 'loading'"
      >
        {{ viewState === 'loading' ? '正在找回…' : '开始找回' }}
      </button>
    </form>

    <p v-if="viewState === 'loading'" class="recall-status" role="status">正在你的记忆库里筛选…</p>

    <p v-else-if="viewState === 'error'" class="recall-error" role="alert">
      {{ errorMessage }}
    </p>

    <section v-else-if="viewState === 'no_match'" class="recall-empty" aria-live="polite">
      <p class="recall-empty-title">还没找到匹配的</p>
      <p class="recall-empty-copy">试试更短的关键词，或先保存一些内容再来找。</p>
    </section>

    <section
      v-else-if="viewState === 'result' && topPickDisplay"
      class="recall-results"
      aria-live="polite"
    >
      <div class="recall-top-pick">
        <p class="recall-section-label">最可能的结果</p>
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
          <h2 class="recall-card-title">{{ topPickDisplay.title }}</h2>
          <p class="recall-card-subtitle">{{ topPickDisplay.subtitle }}</p>
          <p v-if="topPickDisplay.excerpt" class="recall-card-excerpt">
            {{ topPickDisplay.excerpt }}
          </p>
        </a>
        <p class="recall-affirmation">对，就是这个？点卡片打开看看。</p>
      </div>

      <div v-if="alsoPossibleCards.length > 0" class="recall-also">
        <p class="recall-section-label">也可能是这些</p>
        <ul class="recall-also-list">
          <li v-for="item in alsoPossibleCards" :key="item.id">
            <a class="recall-card" :href="item.url" target="_blank" rel="noopener noreferrer">
              <div class="recall-card-meta">
                <span class="recall-type">{{ item.typeLabel }}</span>
                <span class="recall-reason">{{ item.reason }}</span>
              </div>
              <h3 class="recall-card-title recall-card-title--compact">{{ item.title }}</h3>
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
  color: var(--recall-fg, #17202a);
  background: var(--recall-bg, #f8fafc);
}

.recall-header {
  margin-bottom: 16px;
}

.recall-eyebrow {
  margin: 0 0 4px;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: #64748b;
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
  color: #52606d;
}

.recall-import {
  margin-bottom: 12px;
  padding: 10px 12px;
  border: 1px solid #dbe3ea;
  border-radius: 10px;
  background: #fff;
}

.recall-import--error {
  border-color: #fecaca;
  background: #fef2f2;
}

.recall-import-label {
  margin: 0 0 8px;
  font-size: 12px;
  line-height: 1.4;
  color: #64748b;
}

.recall-import--error .recall-import-label {
  color: #b42318;
}

.recall-import-track {
  height: 6px;
  border-radius: 999px;
  background: #e2e8f0;
  overflow: hidden;
}

.recall-import-bar {
  height: 100%;
  border-radius: 999px;
  background: #0891b2;
}

.recall-save-page {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #cbd5e1;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 600;
  color: #0e7490;
  background: #fff;
  cursor: pointer;
}

.recall-save-page:disabled {
  color: #94a3b8;
  cursor: not-allowed;
}

.recall-save-page:not(:disabled):hover {
  background: #eef2f6;
}

.recall-save-feedback {
  margin: 8px 0 0;
  font-size: 12px;
  line-height: 1.4;
}

.recall-save-feedback--success {
  color: #0f766e;
}

.recall-save-feedback--error {
  color: #b42318;
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
  border: 1px solid #cbd5e1;
  border-radius: 10px;
  font-family: inherit;
  font-size: inherit;
  line-height: 1.5;
  color: inherit;
  background: #fff;
  resize: vertical;
}

.recall-input:focus {
  border-color: #0891b2;
  outline: 2px solid rgb(8 145 178 / 20%);
}

.recall-submit {
  padding: 10px 14px;
  border: none;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 600;
  color: #fff;
  background: #0891b2;
  cursor: pointer;
}

.recall-submit:disabled {
  background: #94a3b8;
  cursor: not-allowed;
}

.recall-submit:not(:disabled):hover {
  background: #0e7490;
}

.recall-status {
  margin: 14px 0 0;
  font-size: 13px;
  line-height: 1.4;
  color: #64748b;
}

.recall-error {
  margin: 14px 0 0;
  font-size: 13px;
  line-height: 1.4;
  color: #b42318;
}

.recall-empty {
  margin-top: 16px;
  padding: 14px;
  border: 1px dashed #cbd5e1;
  border-radius: 12px;
  background: #fff;
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
  color: #64748b;
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
  color: #64748b;
}

.recall-top-pick {
  display: grid;
  gap: 8px;
}

.recall-affirmation {
  margin: 0;
  font-size: 12px;
  line-height: 1.4;
  color: #0f766e;
}

.recall-card {
  display: block;
  padding: 12px;
  border: 1px solid #dbe3ea;
  border-radius: 12px;
  text-decoration: none;
  color: inherit;
  background: #fff;
}

.recall-card--top {
  border-color: #99d5df;
  background: #f0fbfd;
}

.recall-card:hover {
  background: #eef2f6;
}

.recall-card--top:hover {
  background: #e6f7fa;
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
  color: #0e7490;
}

.recall-reason {
  font-size: 11px;
  color: #64748b;
}

.recall-card-title {
  margin: 0 0 4px;
  font-size: 16px;
  line-height: 1.35;
}

.recall-card-title--compact {
  font-size: 14px;
}

.recall-card-subtitle {
  margin: 0;
  font-size: 12px;
  color: #64748b;
}

.recall-card-excerpt {
  margin: 8px 0 0;
  font-size: 12px;
  line-height: 1.5;
  color: #334155;
}

.recall-also-list {
  display: grid;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}
</style>
