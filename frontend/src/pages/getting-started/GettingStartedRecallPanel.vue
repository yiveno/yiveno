<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import { pickNextDistinctClueIndex } from '@/core/onboarding/gs-clue-samples'
import AppButton from '@/infrastructure/ui/AppButton.vue'
import AppIcon from '@/infrastructure/ui/icons/AppIcon.vue'
import { t } from '@/infrastructure/i18n/t'
import type { GettingStartedRecallCard } from '@/pages/getting-started/map-getting-started-recall-card'
import type { GettingStartedLibraryPhase } from '@/pages/getting-started/getting-started-progress'

defineOptions({ name: 'GettingStartedRecallPanel' })

/** 口语建议最小 shape（摘录 tab 芯片列表）。 */
export type GettingStartedSuggestion = {
  title: string
  clue: string
}

const props = withDefaults(
  defineProps<{
    libraryPhase: GettingStartedLibraryPhase
    suggestions: GettingStartedSuggestion[]
    /** 书签 tab：LLM/模板示意 clue（单条展示 + 随机切换） */
    oralClues?: string[]
    oralCluesGenerating?: boolean
    /** false：不展示页内 composer（书签主路径走 Try it → Side Panel） */
    showComposer?: boolean
    busy: boolean
    error: string
    primaryCard: GettingStartedRecallCard | null
    secondaryCard: GettingStartedRecallCard | null
    recallDone: boolean
    emptyKind: 'none' | 'no_match' | 'need_a_clue' | null
    /** composer input id（双 tab 防重复） */
    clueInputId?: string
    /** section aria-label（经 t()） */
    sectionAriaLabel?: string
  }>(),
  {
    clueInputId: 'gs-recall-clue',
    oralClues: () => [],
    oralCluesGenerating: false,
    showComposer: true
  }
)

const emit = defineEmits<{
  submit: [clue: string]
  openCard: [card: GettingStartedRecallCard]
  foundYes: []
  trySidePanel: [clue: string]
}>()

const clueDraft = defineModel<string>('clue', { required: true })

const oralIndex = ref(0)

const showOralSample = computed(
  () =>
    props.libraryPhase === 'ready' &&
    (props.oralCluesGenerating || props.oralClues.length > 0) &&
    !props.primaryCard &&
    !props.busy
)

const currentOralClue = computed(() => {
  if (props.oralClues.length === 0) {
    return ''
  }
  const index = Math.min(oralIndex.value, props.oralClues.length - 1)
  return props.oralClues[index] ?? ''
})

const canShuffleOral = computed(() => props.oralClues.length > 1 && !props.oralCluesGenerating)

watch(
  () => props.oralClues,
  clues => {
    oralIndex.value = 0
    const first = clues[0]?.trim()
    if (first && !clueDraft.value.trim()) {
      clueDraft.value = first
    }
  },
  { deep: true }
)

watch(currentOralClue, clue => {
  if (clue && showOralSample.value) {
    clueDraft.value = clue
  }
})

const canSubmit = computed(
  () => props.libraryPhase === 'ready' && !props.busy && clueDraft.value.trim().length > 0
)

function handleSubmit(): void {
  if (!canSubmit.value) {
    return
  }
  emit('submit', clueDraft.value.trim())
}

function handleKeydown(event: KeyboardEvent): void {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    handleSubmit()
  }
}

function applySuggestion(clue: string): void {
  clueDraft.value = clue
}

function handleShuffleOral(): void {
  if (!canShuffleOral.value) {
    return
  }
  oralIndex.value = pickNextDistinctClueIndex(oralIndex.value, props.oralClues)
}

function handleTrySidePanel(): void {
  const clue = (currentOralClue.value || clueDraft.value).trim()
  if (!clue || props.libraryPhase !== 'ready') {
    return
  }
  emit('trySidePanel', clue)
}

const inputRef = ref<HTMLTextAreaElement | null>(null)

defineExpose({
  focusInput: () => inputRef.value?.focus()
})
</script>

<template>
  <section
    class="gs-recall"
    :aria-label="sectionAriaLabel ?? t('getting_started_recall_card_aria')"
  >
    <template v-if="libraryPhase === 'importing'">
      <p class="gs-recall__status-title">{{ t('getting_started_importing_title') }}</p>
      <p class="gs-recall__status-body">{{ t('getting_started_importing_body') }}</p>
    </template>

    <template v-else-if="libraryPhase === 'empty'">
      <p class="gs-recall__status-title">{{ t('getting_started_empty_title') }}</p>
      <p class="gs-recall__status-body">{{ t('getting_started_empty_body') }}</p>
    </template>

    <template v-else>
      <div v-if="showComposer" class="gs-recall__composer">
        <label class="gs-recall__label" :for="clueInputId">
          {{ t('getting_started_composer_label') }}
        </label>
        <textarea
          :id="clueInputId"
          ref="inputRef"
          v-model="clueDraft"
          class="gs-recall__input"
          rows="3"
          :placeholder="t('getting_started_composer_placeholder')"
          :disabled="busy"
          :aria-busy="busy ? 'true' : undefined"
          @keydown="handleKeydown"
        />
        <div class="gs-recall__composer-actions">
          <AppButton type="button" variant="filled" :disabled="!canSubmit" @click="handleSubmit">
            {{ t('getting_started_composer_submit') }}
          </AppButton>
          <p v-if="busy" class="gs-recall__looking" aria-live="polite">
            {{ t('getting_started_looking') }}
          </p>
        </div>
      </div>

      <div
        v-if="showOralSample"
        class="gs-recall__oral"
        aria-live="polite"
        :data-oral-count="oralClues.length"
        :data-oral-index="oralIndex"
      >
        <p class="gs-recall__suggestions-lead">{{ t('getting_started_oral_sample_lead') }}</p>
        <p v-if="oralCluesGenerating && oralClues.length === 0" class="gs-recall__oral-generating">
          {{ t('getting_started_oral_sample_generating') }}
        </p>
        <template v-else-if="currentOralClue">
          <div class="gs-recall__oral-row">
            <p class="gs-recall__oral-text">{{ currentOralClue }}</p>
            <button
              type="button"
              class="gs-recall__oral-shuffle"
              :disabled="!canShuffleOral"
              :title="t('getting_started_oral_sample_shuffle_aria')"
              :aria-label="t('getting_started_oral_sample_shuffle_aria')"
              data-gs-oral-shuffle
              @click="handleShuffleOral"
            >
              <AppIcon name="shuffle" :size="20" />
            </button>
          </div>
          <AppButton
            type="button"
            variant="tonal"
            class="gs-recall__oral-try"
            @click="handleTrySidePanel"
          >
            {{ t('getting_started_oral_sample_try') }}
          </AppButton>
        </template>
      </div>

      <div
        v-else-if="suggestions.length > 0 && !primaryCard && !busy"
        class="gs-recall__suggestions"
      >
        <p class="gs-recall__suggestions-lead">{{ t('getting_started_suggestions_lead') }}</p>
        <ul class="gs-recall__suggestion-list">
          <li v-for="sample in suggestions" :key="sample.clue">
            <button
              type="button"
              class="gs-recall__suggestion"
              @click="applySuggestion(sample.clue)"
            >
              {{ sample.clue }}
            </button>
          </li>
        </ul>
      </div>

      <p v-if="error" class="gs-recall__error" role="alert">{{ error }}</p>

      <div v-if="primaryCard" class="gs-recall__results" aria-live="polite">
        <article class="gs-recall__card gs-recall__card--primary">
          <button
            type="button"
            class="gs-recall__card-hit"
            :aria-label="t('getting_started_open_result_aria', primaryCard.title)"
            @click="emit('openCard', primaryCard)"
          >
            <h3 class="gs-recall__card-title">{{ primaryCard.title }}</h3>
            <p v-if="primaryCard.host" class="gs-recall__card-host">{{ primaryCard.host }}</p>
            <p v-if="primaryCard.reasonLine" class="gs-recall__card-reason">
              {{ primaryCard.reasonLine }}
            </p>
            <p v-if="primaryCard.preview" class="gs-recall__card-preview">
              {{ primaryCard.preview }}
            </p>
          </button>
        </article>

        <article v-if="secondaryCard" class="gs-recall__card gs-recall__card--secondary">
          <button
            type="button"
            class="gs-recall__card-hit"
            :aria-label="t('getting_started_open_result_aria', secondaryCard.title)"
            @click="emit('openCard', secondaryCard)"
          >
            <h3 class="gs-recall__card-title">{{ secondaryCard.title }}</h3>
            <p v-if="secondaryCard.host" class="gs-recall__card-host">{{ secondaryCard.host }}</p>
            <p v-if="secondaryCard.reasonLine" class="gs-recall__card-reason">
              {{ secondaryCard.reasonLine }}
            </p>
          </button>
        </article>

        <div v-if="!recallDone" class="gs-recall__found">
          <p class="gs-recall__found-label">{{ t('getting_started_found_it') }}</p>
          <AppButton type="button" variant="tonal" @click="emit('foundYes')">
            {{ t('getting_started_found_yes') }}
          </AppButton>
        </div>
        <p v-else class="gs-recall__done">{{ t('getting_started_you_found_something') }}</p>
      </div>

      <p v-else-if="emptyKind === 'no_match'" class="gs-recall__empty">
        {{ t('getting_started_no_match_body') }}
      </p>
    </template>
  </section>
</template>

<style scoped>
.gs-recall {
  display: grid;
  gap: var(--space-md);
  min-width: 0;
}

.gs-recall__status-title {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  line-height: 1.35;
}

.gs-recall__status-body,
.gs-recall__looking,
.gs-recall__error,
.gs-recall__empty,
.gs-recall__done,
.gs-recall__oral-generating {
  margin: 0;
  font-size: 13px;
  line-height: 1.45;
  color: var(--on-surface-muted);
}

.gs-recall__error {
  color: var(--danger);
}

.gs-recall__composer {
  display: grid;
  gap: var(--space-sm);
  padding: var(--space-md);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: var(--surface-white);
}

.gs-recall__label {
  font-size: 13px;
  font-weight: 600;
  color: var(--on-surface);
}

.gs-recall__input {
  width: 100%;
  min-height: 4.5rem;
  padding: var(--space-sm);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--surface-white);
  color: var(--on-surface);
  font: inherit;
  line-height: 1.45;
  resize: vertical;
}

.gs-recall__input:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: 1px;
}

.gs-recall__composer-actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-sm);
  align-items: center;
}

.gs-recall__oral,
.gs-recall__suggestions {
  display: grid;
  gap: var(--space-sm);
  min-width: 0;
}

.gs-recall__suggestions-lead {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  color: var(--on-surface-muted);
}

.gs-recall__oral-row {
  display: flex;
  gap: var(--space-xs);
  align-items: flex-start;
  min-width: 0;
  padding: var(--space-sm);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: color-mix(in srgb, var(--on-surface) 4%, var(--surface-white));
}

.gs-recall__oral-text {
  flex: 1;
  margin: 0;
  min-width: 0;
  font-size: 13px;
  line-height: 1.45;
  color: var(--on-surface);
  overflow-wrap: anywhere;
}

.gs-recall__oral-shuffle {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  padding: 0;
  border: none;
  border-radius: var(--radius-full);
  background: transparent;
  color: var(--on-surface-muted);
  cursor: pointer;
}

.gs-recall__oral-shuffle:hover:not(:disabled),
.gs-recall__oral-shuffle:focus-visible:not(:disabled) {
  background: color-mix(
    in srgb,
    var(--on-surface) calc(var(--state-hover-opacity) * 100%),
    transparent
  );
  color: var(--on-surface);
}

.gs-recall__oral-shuffle:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: 1px;
}

.gs-recall__oral-shuffle:disabled {
  opacity: 0.4;
  cursor: default;
}

.gs-recall__oral-try {
  justify-self: start;
}

.gs-recall__suggestion-list {
  display: grid;
  gap: var(--space-xs);
  margin: 0;
  padding: 0;
  list-style: none;
}

.gs-recall__suggestion {
  width: 100%;
  padding: var(--space-sm);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: color-mix(in srgb, var(--on-surface) 4%, var(--surface-white));
  color: var(--on-surface);
  font: inherit;
  font-size: 13px;
  line-height: 1.45;
  text-align: start;
  cursor: pointer;
  overflow-wrap: anywhere;
}

.gs-recall__suggestion:hover,
.gs-recall__suggestion:focus-visible {
  background: color-mix(in srgb, var(--on-surface) 8%, var(--surface-white));
}

.gs-recall__suggestion:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: 1px;
}

.gs-recall__results {
  display: grid;
  gap: var(--space-sm);
}

.gs-recall__card {
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: var(--surface-white);
  overflow: hidden;
}

.gs-recall__card--secondary {
  opacity: 0.92;
}

.gs-recall__card-hit {
  display: grid;
  gap: 4px;
  width: 100%;
  padding: var(--space-md);
  border: none;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: start;
  cursor: pointer;
}

.gs-recall__card-hit:hover,
.gs-recall__card-hit:focus-visible {
  background: color-mix(in srgb, var(--on-surface) 4%, transparent);
}

.gs-recall__card-hit:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: -2px;
}

.gs-recall__card-title {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  line-height: 1.35;
  overflow-wrap: anywhere;
}

.gs-recall__card-host,
.gs-recall__card-reason,
.gs-recall__card-preview {
  margin: 0;
  font-size: 12px;
  line-height: 1.4;
  color: var(--on-surface-muted);
  overflow-wrap: anywhere;
}

.gs-recall__found {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-sm);
  align-items: center;
}

.gs-recall__found-label {
  margin: 0;
  font-size: 13px;
  color: var(--on-surface-muted);
}
</style>
