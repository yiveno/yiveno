<script setup lang="ts">
import { computed } from 'vue'

import type { ConversationTurn } from '@/pages/popup/recall-conversation-types'
import RecallResultCard from '@/pages/popup/RecallResultCard.vue'
import { t } from '@/infrastructure/i18n/t'

defineOptions({ name: 'RecallConversation' })

const props = defineProps<{
  turns: ConversationTurn[]
  expandedDuplicateGroupId: string | null
  expandLabel: string
  collapseLabel: string
  noteFieldLabel: string
  showShortenRetry: boolean
  shortenRetryLabel: string
}>()

const emit = defineEmits<{
  open: [payload: { id: string; url: string }]
  toggleExpand: [cardId: string]
  dismiss: []
  shortenRetry: []
  useSuggestion: [value: string]
}>()

const latestDismissibleAssistantId = computed(() => {
  for (let i = props.turns.length - 1; i >= 0; i -= 1) {
    const turn = props.turns[i]
    if (turn && turn.role === 'assistant' && turn.allowDismiss) {
      return turn.id
    }
  }
  return null
})

function onDismissClick(): void {
  emit('dismiss')
}

function onShortenRetryClick(): void {
  emit('shortenRetry')
}

function onSuggestionClick(value: string): void {
  emit('useSuggestion', value)
}

function handleOpen(payload: { id: string; url: string }): void {
  emit('open', payload)
}

function handleToggleExpand(cardId: string): void {
  emit('toggleExpand', cardId)
}
</script>

<template>
  <section class="conversation-list" aria-live="polite">
    <div
      v-for="turn in turns"
      :key="turn.id"
      class="conversation-turn"
      :class="turn.role === 'user' ? 'conversation-turn--user' : 'conversation-turn--assistant'"
    >
      <template v-if="turn.role === 'user'">
        <div class="conversation-bubble conversation-bubble--user">{{ turn.text }}</div>
      </template>

      <template v-else>
        <div class="assistant-turn">
          <p class="assistant-turn-name">Yiveno</p>
          <p
            class="assistant-turn-copy"
            :class="{ 'assistant-turn-copy--error': turn.tone === 'error' }"
          >
            {{ turn.text }}
          </p>

          <div v-if="turn.primaryCard" class="assistant-turn-primary">
            <RecallResultCard
              :card="turn.primaryCard"
              result-dom-id="conversation-primary-card"
              :keyboard-selected="false"
              top-pick
              :expanded="expandedDuplicateGroupId === turn.primaryCard.id"
              :expand-label="expandLabel"
              :collapse-label="collapseLabel"
              :note-field-label="noteFieldLabel"
              @open="handleOpen"
              @toggle-expand="() => handleToggleExpand(turn.primaryCard!.id)"
            />
          </div>

          <ul
            v-if="turn.candidateCards && turn.candidateCards.length > 0"
            class="assistant-turn-candidates"
          >
            <li v-for="(item, index) in turn.candidateCards" :key="item.id">
              <RecallResultCard
                :card="item"
                :result-dom-id="`conversation-candidate-${turn.id}-${index}`"
                :keyboard-selected="false"
                compact
                :expanded="expandedDuplicateGroupId === item.id"
                :expand-label="expandLabel"
                :collapse-label="collapseLabel"
                :note-field-label="noteFieldLabel"
                @open="handleOpen"
                @toggle-expand="() => handleToggleExpand(item.id)"
              />
            </li>
          </ul>

          <div
            v-if="turn.allowDismiss && latestDismissibleAssistantId === turn.id"
            class="recall-feedback-actions"
          >
            <md-text-button type="button" @click="onDismissClick">
              {{ t('popup_dismiss_candidates') }}
            </md-text-button>
          </div>

          <div v-if="turn.tone === 'miss' && props.showShortenRetry" class="assistant-turn-actions">
            <button
              type="button"
              class="assistant-turn-pill assistant-turn-pill--secondary"
              @click="onShortenRetryClick"
            >
              {{ props.shortenRetryLabel }}
            </button>
          </div>

          <div
            v-if="turn.suggestions && turn.suggestions.length > 0"
            class="assistant-turn-suggestions"
          >
            <button
              v-for="suggestion in turn.suggestions"
              :key="suggestion.id"
              type="button"
              class="assistant-turn-pill"
              @click="onSuggestionClick(suggestion.value)"
            >
              {{ suggestion.label }}
            </button>
          </div>
        </div>
      </template>
    </div>
  </section>
</template>

<style scoped>
.conversation-list {
  display: grid;
  gap: 18px;
  min-width: 0;
  padding: 6px 0 2px;
}

.conversation-turn {
  display: flex;
  min-width: 0;
}

.conversation-turn--user {
  justify-content: flex-end;
}

.conversation-turn--assistant {
  justify-content: flex-start;
}

.conversation-bubble {
  max-width: 80%;
  padding: 10px 14px;
  border-radius: 18px;
  font-size: 14px;
  line-height: 1.45;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.conversation-bubble--user {
  color: var(--md-sys-color-on-surface);
  background: var(--md-sys-color-surface-container-high);
}

.assistant-turn {
  display: grid;
  gap: 10px;
  width: 100%;
  min-width: 0;
}

.assistant-turn-name {
  margin: 0;
  font-size: 12px;
  font-weight: 600;
  color: var(--md-sys-color-on-surface-variant);
  letter-spacing: 0.01em;
}

.assistant-turn-copy {
  margin: 0;
  font-size: 14px;
  line-height: 1.5;
  color: var(--md-sys-color-on-surface);
  white-space: pre-wrap;
  max-width: 30ch;
  text-wrap: pretty;
}

.assistant-turn-copy--error {
  color: var(--md-sys-color-error);
}

.assistant-turn-primary,
.assistant-turn-actions {
  display: grid;
  gap: 8px;
}

.recall-feedback-actions {
  display: flex;
  justify-content: flex-end;
  padding-top: 2px;
}

.assistant-turn-suggestions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding-top: 2px;
}

.assistant-turn-pill {
  display: inline-flex;
  align-items: center;
  min-height: 32px;
  padding: 0 12px;
  border: 1px solid var(--md-sys-color-outline-variant);
  border-radius: 999px;
  font: inherit;
  font-size: 13px;
  line-height: 1;
  color: var(--md-sys-color-on-surface);
  background: var(--md-sys-color-surface-container-lowest);
  cursor: pointer;
}

.assistant-turn-pill:hover {
  background: var(--md-sys-color-surface-container-high);
}

.assistant-turn-pill:focus-visible {
  outline: 2px solid var(--md-sys-color-primary);
  outline-offset: 2px;
}

.assistant-turn-pill--secondary {
  color: var(--md-sys-color-primary);
}

.assistant-turn-candidates {
  display: grid;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}
</style>
