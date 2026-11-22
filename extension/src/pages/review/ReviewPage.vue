<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

import type {
  DailyReviewFeaturedReason,
  DailyReviewNoteView,
  DailyReviewRelation
} from '@/core/dreaming/build-daily-review'
import { DAILY_REVIEW_GROUP_NOTE_LIMIT } from '@/core/dreaming/build-daily-review'
import type { GetDailyReviewResponse } from '@/core/messaging/daily-review-messages'
import { openExtensionOptionsPage } from '@/infrastructure/browser/extension-pages'
import { focusOrOpenSettingsTab } from '@/infrastructure/browser/extension-tab'
import { t } from '@/infrastructure/i18n/t'
import { fetchDailyReview } from '@/infrastructure/messaging/background-client'
import AppButton from '@/infrastructure/ui/AppButton.vue'
import AppIconButton from '@/infrastructure/ui/AppIconButton.vue'
import AppPageHeader from '@/infrastructure/ui/AppPageHeader.vue'
import AppIcon from '@/infrastructure/ui/icons/AppIcon.vue'
import AppToastHost from '@/infrastructure/ui/AppToastHost.vue'

defineOptions({ name: 'ReviewPage' })

type LoadState = 'loading' | 'ready' | 'error'

const SOURCE_QUOTE_MAX = 120

const loadState = ref<LoadState>('loading')
const errorMessage = ref('')
const review = ref<Extract<GetDailyReviewResponse, { ok: true }> | null>(null)

const detailPageUrl = chrome.runtime.getURL('detail.html')

function truncateQuote(quote: string): string {
  const trimmed = quote.trim()
  if (trimmed.length <= SOURCE_QUOTE_MAX) {
    return trimmed
  }
  return `${trimmed.slice(0, SOURCE_QUOTE_MAX)}…`
}

function formatRelation(relation: DailyReviewRelation): string {
  if (relation.kind === 'same_source') {
    if (relation.title) {
      return t('review_relation_same_source', [relation.title])
    }
    return t('review_relation_same_source_no_title')
  }
  return t('review_relation_shared_topic', [String(relation.memberCount), relation.term])
}

function formatFeaturedReason(reason: DailyReviewFeaturedReason): string {
  if (reason.kind === 'shared_with_older') {
    return t('review_featured_shared_older', [reason.term, String(reason.olderHitCount)])
  }
  if (reason.kind === 'recent_topic') {
    return t('review_featured_recent_topic', [reason.term])
  }
  return t('review_featured_latest_yesterday')
}

function sourceDetailHref(note: DailyReviewNoteView): string | null {
  if (!note.sourceExists) {
    return null
  }
  const url = new URL(detailPageUrl)
  url.searchParams.set('id', note.sourceMemoryItemId)
  return url.href
}

function formatStaleDate(iso: string | null): string | null {
  if (!iso) {
    return null
  }
  const ms = Date.parse(iso)
  if (!Number.isFinite(ms)) {
    return iso.slice(0, 10)
  }
  try {
    return new Intl.DateTimeFormat(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    }).format(new Date(ms))
  } catch {
    return iso.slice(0, 10)
  }
}

async function loadReview(): Promise<void> {
  loadState.value = 'loading'
  errorMessage.value = ''
  try {
    const response = await fetchDailyReview()
    if (!response.ok) {
      loadState.value = 'error'
      errorMessage.value = t('review_load_failed')
      review.value = null
      return
    }
    review.value = response
    loadState.value = 'ready'
  } catch {
    loadState.value = 'error'
    errorMessage.value = t('review_load_failed')
    review.value = null
  }
}

async function openAiSettings(): Promise<void> {
  try {
    await focusOrOpenSettingsTab({ section: 'ai' })
  } catch {
    try {
      await openExtensionOptionsPage()
    } catch {
      // 入口失败时保持页内空态，不抛到控制台以外
    }
  }
}

const showDreamingOff = computed(
  () => loadState.value === 'ready' && review.value != null && !review.value.aiFeaturesEnabled
)

const showNoNotes = computed(
  () =>
    loadState.value === 'ready' &&
    review.value != null &&
    review.value.aiFeaturesEnabled &&
    review.value.totalNotes === 0
)

const showReviewBody = computed(
  () =>
    loadState.value === 'ready' &&
    review.value != null &&
    review.value.aiFeaturesEnabled &&
    review.value.totalNotes > 0
)

const showFeaturedSection = computed(
  () => showReviewBody.value && review.value != null && review.value.yesterdayCount > 0
)

const groupsTruncationNote = computed(() => {
  if (!review.value?.groupsTruncated) {
    return null
  }
  return t('review_groups_truncated', [
    String(review.value.yesterdayCount),
    String(DAILY_REVIEW_GROUP_NOTE_LIMIT)
  ])
})

onMounted(() => {
  void loadReview()
})
</script>

<template>
  <AppToastHost />
  <main class="review-shell">
    <header class="review-header">
      <AppPageHeader current="none" class="review-header-top" />
      <h1 class="review-title">{{ t('review_title') }}</h1>
      <p class="review-subtitle">{{ t('review_subtitle') }}</p>
    </header>

    <p v-if="loadState === 'loading'" class="review-status" role="status">
      {{ t('review_loading') }}
    </p>

    <div v-else-if="loadState === 'error'" class="review-error-block" role="alert">
      <p class="review-error">{{ errorMessage }}</p>
      <AppIconButton
        type="button"
        :title="t('review_retry')"
        :aria-label="t('review_retry')"
        @click="loadReview"
      >
        <AppIcon name="refresh" size="22px" />
      </AppIconButton>
    </div>

    <section v-else-if="showDreamingOff" class="review-empty" role="status">
      <p class="review-empty-title">{{ t('review_empty_dreaming_off_title') }}</p>
      <p class="review-empty-copy">{{ t('review_empty_dreaming_off_body') }}</p>
      <AppButton type="button" variant="tonal" @click="openAiSettings">
        {{ t('review_empty_dreaming_off_open_settings') }}
      </AppButton>
    </section>

    <section v-else-if="showNoNotes" class="review-empty" role="status">
      <p class="review-empty-title">{{ t('review_empty_no_notes_title') }}</p>
      <p class="review-empty-copy">{{ t('review_empty_no_notes_body') }}</p>
    </section>

    <div v-else-if="showReviewBody && review" class="review-body">
      <!-- 第一节：昨日关系分组 -->
      <section class="review-section" aria-labelledby="review-groups-heading">
        <h2 id="review-groups-heading" class="review-section-title">
          {{ t('review_section_groups_title') }}
        </h2>
        <p v-if="review.yesterdayCount === 0" class="review-empty-inline" role="status">
          {{ t('review_empty_no_yesterday') }}
        </p>
        <template v-else>
          <p v-if="groupsTruncationNote" class="review-truncation" role="status">
            {{ groupsTruncationNote }}
          </p>
          <article
            v-for="(group, groupIndex) in review.groups"
            :key="`group-${groupIndex}`"
            class="review-group surface-panel-white"
          >
            <p v-if="group.relation" class="review-relation">
              {{ formatRelation(group.relation) }}
            </p>
            <ul class="review-note-list">
              <li v-for="note in group.notes" :key="note.id" class="review-note">
                <p class="review-note-text">{{ note.text }}</p>
                <p v-if="note.sourceQuote" class="review-note-quote">
                  “{{ truncateQuote(note.sourceQuote) }}”
                </p>
                <a
                  v-if="sourceDetailHref(note)"
                  class="review-note-source"
                  :href="sourceDetailHref(note)!"
                  :title="t('review_open_source')"
                >
                  {{ note.sourceTitle || t('review_open_source') }}
                </a>
              </li>
            </ul>
          </article>
        </template>
      </section>

      <!-- 第二节：值得再看（无昨日命题则整节不渲染） -->
      <section
        v-if="showFeaturedSection && review.featured"
        class="review-section"
        aria-labelledby="review-featured-heading"
      >
        <h2 id="review-featured-heading" class="review-section-title">
          {{ t('review_section_featured_title') }}
        </h2>
        <article class="review-featured surface-panel-white">
          <p class="review-note-text">{{ review.featured.note.text }}</p>
          <p v-if="review.featured.note.sourceQuote" class="review-note-quote">
            “{{ truncateQuote(review.featured.note.sourceQuote) }}”
          </p>
          <a
            v-if="sourceDetailHref(review.featured.note)"
            class="review-note-source"
            :href="sourceDetailHref(review.featured.note)!"
            :title="t('review_open_source')"
          >
            {{ review.featured.note.sourceTitle || t('review_open_source') }}
          </a>
          <p class="review-featured-reason">
            {{ formatFeaturedReason(review.featured.reason) }}
          </p>
        </article>
      </section>

      <!-- 第三节：可能过时（有才显示） -->
      <section v-if="review.stale" class="review-section" aria-labelledby="review-stale-heading">
        <h2 id="review-stale-heading" class="review-section-title">
          {{ t('review_section_stale_title') }}
        </h2>
        <article class="review-stale surface-panel-white">
          <p class="review-stale-badge">{{ t('review_stale_reference_only') }}</p>
          <p class="review-note-text">{{ review.stale.note.text }}</p>
          <p v-if="review.stale.note.sourceQuote" class="review-note-quote">
            “{{ truncateQuote(review.stale.note.sourceQuote) }}”
          </p>
          <a
            v-if="sourceDetailHref(review.stale.note)"
            class="review-note-source"
            :href="sourceDetailHref(review.stale.note)!"
            :title="t('review_open_source')"
          >
            {{ review.stale.note.sourceTitle || t('review_open_source') }}
          </a>
          <p v-if="formatStaleDate(review.stale.firstStaleAt)" class="review-stale-date">
            {{ t('review_stale_first_seen', [formatStaleDate(review.stale.firstStaleAt)!]) }}
          </p>
        </article>
      </section>
    </div>
  </main>
</template>

<style scoped>
.review-shell {
  box-sizing: border-box;
  max-width: 720px;
  min-height: 100vh;
  margin: 0 auto;
  padding: var(--space-md) var(--space-md) var(--space-xl);
  color: var(--on-surface);
}

.review-header {
  margin-bottom: var(--space-lg);
}

.review-header-top {
  margin-bottom: var(--space-2xs);
}

.review-title {
  margin: 0 0 var(--space-xs);
  font-size: var(--text-display);
  line-height: 1.2;
}

.review-subtitle {
  margin: 0;
  font-size: var(--text-body);
  line-height: var(--leading-relaxed);
  color: var(--on-surface-muted);
}

.review-status,
.review-error,
.review-empty-title,
.review-empty-copy,
.review-empty-inline,
.review-truncation {
  margin: 0;
  font-size: var(--text-body);
  line-height: var(--leading-relaxed);
}

.review-error-block {
  display: flex;
  gap: var(--space-sm);
  align-items: center;
}

.review-empty {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  align-items: flex-start;
  padding: var(--space-md);
  border-radius: var(--radius);
  background: var(--surface-raised);
}

.review-empty-title {
  font-weight: var(--font-weight-semibold);
  font-size: 16px;
}

.review-empty-copy {
  color: var(--on-surface-muted);
}

.review-body {
  display: flex;
  flex-direction: column;
  gap: var(--space-xl);
}

.review-section-title {
  margin: 0 0 var(--space-sm);
  font-size: 18px;
  line-height: var(--leading-tight);
}

.review-group,
.review-featured,
.review-stale {
  margin-bottom: var(--space-sm);
  padding: var(--space-md);
  border-radius: var(--radius);
}

.review-relation,
.review-featured-reason,
.review-stale-date,
.review-stale-badge {
  margin: 0 0 var(--space-sm);
  font-size: var(--text-meta);
  line-height: var(--leading-snug);
  color: var(--on-surface-muted);
}

.review-stale-badge {
  display: inline-block;
  padding: 2px var(--space-xs);
  border-radius: var(--radius-sm);
  background: var(--surface-2);
  color: var(--on-surface);
  font-weight: var(--font-weight-medium);
}

.review-note-list {
  margin: 0;
  padding: 0;
  list-style: none;
}

.review-note + .review-note {
  margin-top: var(--space-md);
  padding-top: var(--space-md);
  border-top: 1px solid var(--border);
}

.review-note-text {
  margin: 0 0 var(--space-2xs);
  font-size: 15px;
  line-height: 1.45;
}

.review-note-quote {
  margin: 0 0 var(--space-2xs);
  font-size: var(--text-meta);
  line-height: var(--leading-snug);
  color: var(--on-surface-muted);
}

.review-note-source {
  font-size: var(--text-meta);
  line-height: var(--leading-snug);
  color: var(--accent);
  text-decoration: underline;
  text-underline-offset: 2px;
}

.review-note-source:hover,
.review-note-source:focus-visible {
  opacity: 0.85;
}

.review-truncation {
  margin-bottom: var(--space-sm);
  color: var(--on-surface-muted);
}

.review-empty-inline {
  color: var(--on-surface-muted);
}
</style>
