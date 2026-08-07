<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

import type { MemoryItem, TextExcerptMemoryItem } from '@/core/memory/memory-item'
import { getUILanguage, t } from '@/infrastructure/i18n/t'
import { tMemoryError } from '@/infrastructure/i18n/memory-error'
import {
  deleteMemoryItem,
  getMemoryItem,
  recordMemoryOpen
} from '@/infrastructure/messaging/background-client'
import AppPageHeader from '@/infrastructure/ui/AppPageHeader.vue'
import MaterialSymbolIcon from '@/infrastructure/ui/icons/MaterialSymbolIcon.vue'

defineOptions({ name: 'DetailPage' })

type DetailViewState =
  | 'loading'
  | 'ready'
  | 'not_found'
  | 'wrong_type'
  | 'error'
  | 'missing_id'
  | 'deleted'

const viewState = ref<DetailViewState>('loading')
const errorMessage = ref('')
const item = ref<MemoryItem | null>(null)
const deleting = ref(false)
const libraryHref = chrome.runtime.getURL('library.html')

const excerpt = computed((): TextExcerptMemoryItem | null => {
  const current = item.value
  return current?.type === 'text_excerpt' ? current : null
})

const createdAtLabel = computed(() => {
  const raw = excerpt.value?.createdAt
  if (!raw) {
    return ''
  }
  const date = new Date(raw)
  if (Number.isNaN(date.getTime())) {
    return raw
  }
  return date.toLocaleString(getUILanguage(), {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
})

function readMemoryIdFromLocation(): string | null {
  const id = new URLSearchParams(window.location.search).get('id')?.trim()
  return id && id.length > 0 ? id : null
}

async function loadDetail() {
  const id = readMemoryIdFromLocation()
  if (!id) {
    viewState.value = 'missing_id'
    return
  }

  viewState.value = 'loading'
  errorMessage.value = ''
  item.value = null

  try {
    const response = await getMemoryItem({ id })
    if (!response.ok) {
      viewState.value = response.errorCode === 'MEMORY_NOT_FOUND' ? 'not_found' : 'error'
      errorMessage.value = tMemoryError(response.errorCode)
      return
    }

    if (!('item' in response)) {
      viewState.value = 'error'
      errorMessage.value = t('detail_invalid_response')
      return
    }

    item.value = response.item
    if (response.item.type === 'text_excerpt') {
      viewState.value = 'ready'
      void recordMemoryOpen({ id: response.item.id }).catch(() => {
        // 忽略：打开记录失败不影响详情展示
      })
    } else {
      viewState.value = 'wrong_type'
    }
  } catch {
    viewState.value = 'error'
    errorMessage.value = t('detail_load_failed')
  }
}

async function handleDelete() {
  const current = excerpt.value
  if (!current || deleting.value) {
    return
  }
  if (!window.confirm(t('detail_delete_confirm'))) {
    return
  }

  deleting.value = true
  errorMessage.value = ''
  try {
    const response = await deleteMemoryItem({ id: current.id })
    if (!response.ok) {
      errorMessage.value = tMemoryError(response.errorCode)
      return
    }
    item.value = null
    viewState.value = 'deleted'
  } catch {
    errorMessage.value = t('detail_delete_failed')
  } finally {
    deleting.value = false
  }
}

onMounted(() => {
  void loadDetail()
})
</script>

<template>
  <main class="detail-shell">
    <header class="detail-header">
      <AppPageHeader class="detail-header-top" />
      <h1 class="detail-title">{{ t('detail_title') }}</h1>
      <p class="detail-subtitle">{{ t('detail_subtitle') }}</p>
    </header>

    <p v-if="viewState === 'loading'" class="detail-status" role="status">
      {{ t('detail_loading') }}
    </p>

    <section v-else-if="viewState === 'missing_id'" class="detail-empty" role="alert">
      <p class="detail-empty-title">{{ t('detail_missing_id_title') }}</p>
      <p class="detail-empty-copy">{{ t('detail_missing_id_body') }}</p>
    </section>

    <section v-else-if="viewState === 'not_found'" class="detail-empty" role="alert">
      <p class="detail-empty-title">{{ t('detail_not_found_title') }}</p>
      <p class="detail-empty-copy">{{ errorMessage || t('detail_not_found_body') }}</p>
    </section>

    <section v-else-if="viewState === 'deleted'" class="detail-empty" role="status">
      <p class="detail-empty-title">{{ t('detail_deleted_title') }}</p>
      <p class="detail-empty-copy">{{ t('detail_deleted_body') }}</p>
      <md-outlined-button :href="libraryHref" :title="t('detail_open_library')">
        <MaterialSymbolIcon slot="icon" name="library_books" size="18px" />
        {{ t('detail_open_library') }}
      </md-outlined-button>
    </section>

    <section v-else-if="viewState === 'error'" class="detail-empty" role="alert">
      <p class="detail-empty-title">{{ t('detail_error_title') }}</p>
      <p class="detail-empty-copy">{{ errorMessage }}</p>
      <md-icon-button
        type="button"
        :title="t('detail_retry')"
        :aria-label="t('detail_retry')"
        @click="loadDetail"
      >
        <MaterialSymbolIcon name="refresh" size="22px" />
      </md-icon-button>
    </section>

    <section v-else-if="viewState === 'wrong_type' && item" class="detail-empty">
      <p class="detail-empty-title">{{ t('detail_wrong_type_title') }}</p>
      <p class="detail-empty-copy">{{ t('detail_wrong_type_body') }}</p>
      <a
        v-if="item.type === 'bookmark'"
        class="detail-source-link"
        :href="item.payload.url"
        target="_blank"
        rel="noopener noreferrer"
        :title="t('detail_open_bookmark')"
      >
        <MaterialSymbolIcon name="open_in_new" size="16px" />
        {{ t('detail_open_bookmark') }}
      </a>
    </section>

    <article v-else-if="viewState === 'ready' && excerpt" class="detail-article">
      <div class="detail-meta">
        <span class="detail-type">{{ t('detail_type_excerpt') }}</span>
        <span v-if="excerpt.payload.pageTitle.trim()" class="detail-page">{{
          excerpt.payload.pageTitle
        }}</span>
        <span class="detail-domain">{{ excerpt.payload.domain }}</span>
        <span v-if="createdAtLabel" class="detail-time">{{ createdAtLabel }}</span>
      </div>

      <p v-if="excerpt.payload.contextBefore" class="detail-context">
        …{{ excerpt.payload.contextBefore }}
      </p>
      <blockquote class="detail-excerpt">{{ excerpt.payload.selectedText }}</blockquote>
      <p v-if="excerpt.payload.contextAfter" class="detail-context">
        {{ excerpt.payload.contextAfter }}…
      </p>

      <section
        v-if="excerpt.clues.note?.trim()"
        class="detail-note"
        :aria-label="t('detail_note_label')"
      >
        <h2 class="detail-note-label">{{ t('detail_note_label') }}</h2>
        <p class="detail-note-body">{{ excerpt.clues.note }}</p>
      </section>

      <p v-if="errorMessage" class="detail-inline-error" role="alert">{{ errorMessage }}</p>

      <div class="detail-actions">
        <md-filled-button
          :href="excerpt.payload.sourceUrl"
          target="_blank"
          rel="noopener noreferrer"
          :title="t('detail_open_source')"
        >
          <MaterialSymbolIcon slot="icon" name="open_in_new" size="18px" />
          {{ t('detail_open_source') }}
        </md-filled-button>
        <md-icon-button
          type="button"
          class="detail-delete"
          :title="deleting ? t('detail_deleting') : t('detail_delete')"
          :aria-label="deleting ? t('detail_deleting') : t('detail_delete')"
          :disabled="deleting"
          @click="handleDelete"
        >
          <MaterialSymbolIcon name="delete" size="20px" />
        </md-icon-button>
      </div>
    </article>
  </main>
</template>

<style scoped>
.detail-shell {
  max-width: 720px;
  margin: 0 auto;
  padding: 28px 24px 40px;
  color: var(--md-sys-color-on-background);
}

.detail-header {
  margin-bottom: 24px;
}

.detail-header-top {
  margin-bottom: 4px;
}

.detail-title {
  margin: 0 0 8px;
  font-size: 28px;
  line-height: 1.2;
}

.detail-subtitle {
  margin: 0;
  font-size: 14px;
  line-height: 1.5;
  color: var(--md-sys-color-on-surface-variant);
}

.detail-status {
  margin: 0;
  font-size: 14px;
  color: var(--md-sys-color-on-surface-variant);
}

.detail-empty {
  display: grid;
  gap: 10px;
  padding: 18px;
  border: 1px dashed var(--md-sys-color-outline);
  border-radius: var(--md-sys-shape-corner-medium, 12px);
  background: var(--md-sys-color-surface-container-low);
}

.detail-empty-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}

.detail-empty-copy {
  margin: 0;
  font-size: 14px;
  line-height: 1.5;
  color: var(--md-sys-color-on-surface-variant);
}

.detail-article {
  display: grid;
  gap: 14px;
  padding: 18px;
  border: 1px solid var(--md-sys-color-outline-variant);
  border-radius: var(--md-sys-shape-corner-medium, 12px);
  background: var(--md-sys-color-surface-container-lowest);
}

.detail-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 12px;
  font-size: 12px;
  color: var(--md-sys-color-on-surface-variant);
}

.detail-type {
  font-weight: 600;
  color: var(--md-sys-color-primary);
}

.detail-page {
  max-width: 100%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.detail-context {
  margin: 0;
  font-size: 13px;
  line-height: 1.6;
  color: var(--md-sys-color-on-surface-variant);
}

.detail-excerpt {
  margin: 0;
  padding: 16px 18px;
  border-radius: var(--md-sys-shape-corner-medium, 12px);
  font-size: 16px;
  line-height: 1.65;
  color: var(--md-sys-color-on-surface);
  background: var(--md-sys-color-surface-container);
}

.detail-note {
  display: grid;
  gap: 6px;
  padding: 12px 14px;
  border-radius: var(--md-sys-shape-corner-medium, 12px);
  background: var(--md-sys-color-surface-container-low);
}

.detail-note-label {
  margin: 0;
  font-size: 12px;
  font-weight: 600;
  color: var(--md-sys-color-on-surface-variant);
}

.detail-note-body {
  margin: 0;
  font-size: 14px;
  line-height: 1.55;
  white-space: pre-wrap;
  color: var(--md-sys-color-on-surface);
}

.detail-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 4px;
}

.detail-inline-error {
  margin: 0;
  font-size: 13px;
  line-height: 1.4;
  color: var(--md-sys-color-error);
}

.detail-delete {
  --md-icon-button-icon-color: var(--md-sys-color-error);
  --md-icon-button-hover-icon-color: var(--md-sys-color-error);
  --md-icon-button-pressed-icon-color: var(--md-sys-color-error);
  --md-icon-button-focus-icon-color: var(--md-sys-color-error);
}

.detail-source-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  font-weight: 600;
  text-decoration: none;
  color: var(--md-sys-color-primary);
}
</style>
