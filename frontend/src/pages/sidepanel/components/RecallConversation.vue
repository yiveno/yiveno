<script setup lang="ts">
import { computed } from 'vue'
import AppButton from '@/infrastructure/ui/AppButton.vue'

import { RECALL_RESULT_PAGE_SIZE } from '@/core/recall/build-recall-result'
import type { ConversationTurn, AssistantTurn } from '@/pages/sidepanel/recall-conversation-types'
import type { RecallCardModel } from '@/pages/sidepanel/RecallResultCard.vue'
import RecallResultCard from '@/pages/sidepanel/RecallResultCard.vue'
import { t } from '@/infrastructure/i18n/t'

defineOptions({ name: 'RecallConversation' })

/** Show more 续展模式：再展一页 / 展开剩余全部。 */
export type ShowMoreMode = 'page' | 'all'

const props = defineProps<{
  turns: ConversationTurn[]
  expandedDuplicateGroupId: string | null
  expandLabel: string
  collapseLabel: string
  noteFieldLabel: string
  /** 等待本轮 Recall 结果时展示脉冲占位 */
  pending?: boolean
  pendingLabel: string
  selectedDetailExportIds?: Set<string>
  /** 为 true 时结果卡才显示 detail export 勾选框 */
  detailExportSelectionActive?: boolean
}>()

const emit = defineEmits<{
  open: [payload: { id: string; url: string; openInNewTab: boolean; rank?: number }]
  evidenceVisible: [
    payload: {
      memoryItemId: string
      rank: number
      ecs: number
      reasonCodes?: string[]
      anchor?: string
    }
  ]
  toggleExpand: [cardId: string]
  dismiss: []
  showMore: [turnId: string, mode: ShowMoreMode]
  useSuggestion: [value: string]
  toggleDetailExportSelection: [memoryItemId: string]
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

function onSuggestionClick(value: string): void {
  emit('useSuggestion', value)
}

function handleOpen(payload: {
  id: string
  url: string
  openInNewTab: boolean
  rank?: number
}): void {
  emit('open', payload)
}

function handleEvidenceVisible(payload: {
  memoryItemId: string
  rank: number
  ecs: number
  reasonCodes?: string[]
  anchor?: string
}): void {
  emit('evidenceVisible', payload)
}

function handleToggleExpand(cardId: string): void {
  emit('toggleExpand', cardId)
}

function onShowMoreClick(turnId: string, mode: ShowMoreMode): void {
  emit('showMore', turnId, mode)
}

/** 当前轮次可见候选。 */
function visibleCardsFor(turn: AssistantTurn): RecallCardModel[] {
  const cards = turn.candidateCards ?? []
  const limit = turn.visibleCount ?? cards.length
  return cards.slice(0, Math.max(0, limit))
}

function remainingCount(turn: AssistantTurn): number {
  const total = turn.candidateCards?.length ?? 0
  const visible = turn.visibleCount ?? total
  return Math.max(0, total - visible)
}

function canShowMore(turn: AssistantTurn): boolean {
  return remainingCount(turn) > 0
}

/** 剩余多于一页时才出「再展 N 条」；否则只出「展开剩余全部」。 */
function canShowMorePage(turn: AssistantTurn): boolean {
  return remainingCount(turn) > RECALL_RESULT_PAGE_SIZE
}

function showMoreCountLabel(count: number): string {
  return t('popup_show_more_count', String(count))
}

function showAllCountLabel(count: number): string {
  return t('popup_show_all_count', String(count))
}

function isDetailExportSelected(id: string): boolean {
  return props.selectedDetailExportIds?.has(id) === true
}

function isDetailExportSelectionDisabled(_id: string): boolean {
  return false
}

function handleToggleDetailExportSelection(id: string): void {
  emit('toggleDetailExportSelection', id)
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
          <p v-if="turn.contextStatus" class="assistant-turn-status">{{ turn.contextStatus }}</p>
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
              :show-detail-export-selection="detailExportSelectionActive === true"
              :detail-export-item-selected="isDetailExportSelected"
              :detail-export-item-disabled="isDetailExportSelectionDisabled"
              :expanded="expandedDuplicateGroupId === turn.primaryCard.id"
              :expand-label="expandLabel"
              :collapse-label="collapseLabel"
              :note-field-label="noteFieldLabel"
              @open="handleOpen"
              @evidence-visible="handleEvidenceVisible"
              @toggle-detail-export-selection="handleToggleDetailExportSelection"
              @toggle-expand="() => handleToggleExpand(turn.primaryCard!.id)"
            />
          </div>

          <div v-if="turn.relatedGuessCard" class="assistant-turn-related-guess">
            <p class="assistant-turn-related-guess-label">{{ turn.relatedGuessLabel }}</p>
            <RecallResultCard
              :card="turn.relatedGuessCard"
              result-dom-id="conversation-related-guess-card"
              :keyboard-selected="false"
              compact
              :show-detail-export-selection="detailExportSelectionActive === true"
              :detail-export-item-selected="isDetailExportSelected"
              :detail-export-item-disabled="isDetailExportSelectionDisabled"
              :expanded="expandedDuplicateGroupId === turn.relatedGuessCard.id"
              :expand-label="expandLabel"
              :collapse-label="collapseLabel"
              :note-field-label="noteFieldLabel"
              @open="handleOpen"
              @evidence-visible="handleEvidenceVisible"
              @toggle-detail-export-selection="handleToggleDetailExportSelection"
              @toggle-expand="() => handleToggleExpand(turn.relatedGuessCard!.id)"
            />
          </div>

          <div
            v-if="turn.candidateCards && turn.candidateCards.length > 0"
            class="assistant-turn-candidates-block"
          >
            <p v-if="turn.candidateSectionLabel" class="assistant-turn-candidates-label">
              {{ turn.candidateSectionLabel }}
            </p>
            <ol class="assistant-turn-candidates">
              <li v-for="(item, index) in visibleCardsFor(turn)" :key="item.id">
                <RecallResultCard
                  :card="item"
                  :result-dom-id="`conversation-candidate-${turn.id}-${index}`"
                  :keyboard-selected="false"
                  :top-pick="turn.tone === 'confident' && index === 0"
                  :compact="!(turn.tone === 'confident' && index === 0)"
                  :show-detail-export-selection="detailExportSelectionActive === true"
                  :detail-export-item-selected="isDetailExportSelected"
                  :detail-export-item-disabled="isDetailExportSelectionDisabled"
                  :expanded="expandedDuplicateGroupId === item.id"
                  :expand-label="expandLabel"
                  :collapse-label="collapseLabel"
                  :note-field-label="noteFieldLabel"
                  @open="handleOpen"
                  @evidence-visible="handleEvidenceVisible"
                  @toggle-detail-export-selection="handleToggleDetailExportSelection"
                  @toggle-expand="() => handleToggleExpand(item.id)"
                />
              </li>
            </ol>
            <div v-if="canShowMore(turn)" class="assistant-turn-show-more">
              <AppButton
                v-if="canShowMorePage(turn)"
                type="button"
                variant="text"
                @click="onShowMoreClick(turn.id, 'page')"
              >
                {{ showMoreCountLabel(RECALL_RESULT_PAGE_SIZE) }}
              </AppButton>
              <AppButton type="button" variant="text" @click="onShowMoreClick(turn.id, 'all')">
                {{ showAllCountLabel(remainingCount(turn)) }}
              </AppButton>
            </div>
          </div>

          <div
            v-if="turn.allowDismiss && latestDismissibleAssistantId === turn.id"
            class="recall-feedback-actions"
          >
            <AppButton type="button" @click="onDismissClick" variant="text">
              {{ t('popup_dismiss_candidates') }}
            </AppButton>
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

    <div
      v-if="pending"
      class="conversation-turn conversation-turn--assistant"
      role="status"
      :aria-label="pendingLabel"
    >
      <div class="assistant-turn assistant-turn--pending">
        <p class="assistant-turn-name">Yiveno</p>
        <div class="pending-indicator">
          <span class="pending-dot" />
          <span class="pending-dot" />
          <span class="pending-dot" />
        </div>
        <p class="pending-label">{{ pendingLabel }}</p>
      </div>
    </div>
  </section>
</template>

<style scoped>
.conversation-list {
  display: grid;
  /* turn 间节奏：对话区个性化间距 */
  gap: 22px;
  min-width: 0;
  padding: var(--space-2xs) 0 var(--space-md);
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
  max-width: 88%;
  padding: 11px 15px;
  border-radius: 20px;
  font-size: 15px;
  line-height: 1.5;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.conversation-bubble--user {
  color: var(--on-surface);
  background: var(--surface-chrome);
}

.assistant-turn {
  display: grid;
  gap: var(--space-xs);
  width: 100%;
  min-width: 0;
}

.assistant-turn--pending {
  gap: var(--space-sm);
}

.assistant-turn-name {
  margin: 0;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.01em;
  color: var(--on-surface-muted);
}

.assistant-turn-status {
  margin: 0;
  max-width: 40ch;
  font-size: 12px;
  line-height: 1.4;
  color: var(--on-surface-muted);
  text-wrap: pretty;
}

.assistant-turn-copy {
  max-width: 42ch;
  margin: 0;
  font-size: 15px;
  line-height: 1.55;
  white-space: pre-wrap;
  color: var(--on-surface);
  text-wrap: pretty;
}

.assistant-turn-related-guess {
  display: grid;
  gap: var(--space-xs);
  min-width: 0;
  padding-top: 2px;
}

.assistant-turn-related-guess-label {
  margin: 0;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.01em;
  color: var(--on-surface-muted);
}

.assistant-turn-candidates-block {
  display: grid;
  gap: var(--space-xs);
  min-width: 0;
  padding-top: 2px;
}

.assistant-turn-candidates-label {
  margin: 0;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.01em;
  color: var(--on-surface-muted);
}

.assistant-turn-copy--error {
  color: var(--danger);
}

.assistant-turn-primary {
  display: grid;
  gap: var(--space-xs);
  padding-top: 2px;
}

.recall-feedback-actions {
  display: flex;
  justify-content: flex-end;
  padding-top: var(--space-2xs);
}

.assistant-turn-suggestions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-xs);
  padding-top: var(--space-2xs);
}

.assistant-turn-pill {
  display: inline-flex;
  align-items: center;
  min-height: 32px;
  padding: 0 var(--space-sm);
  border: 1px solid var(--border);
  border-radius: var(--radius-full);
  font: inherit;
  font-size: 13px;
  line-height: 1;
  color: var(--on-surface);
  background: var(--surface-white);
  cursor: pointer;
}

.assistant-turn-pill:hover {
  background: var(--surface-chrome);
}

.assistant-turn-pill:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.assistant-turn-pill--secondary {
  color: var(--accent);
}

.assistant-turn-candidates {
  display: grid;
  gap: var(--space-xs);
  margin: 0;
  padding: 0;
  list-style: none;
}

.assistant-turn-show-more {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-xs) var(--space-sm);
  justify-content: flex-start;
  padding-top: var(--space-2xs);
}

.pending-indicator {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  min-height: 20px;
}

.pending-dot {
  width: 7px;
  height: 7px;
  border-radius: var(--radius-full);
  background: var(--on-surface-muted);
  opacity: 0.35;
  animation: pending-pulse 1.1s ease-in-out infinite;
}

.pending-dot:nth-child(2) {
  animation-delay: 0.15s;
}

.pending-dot:nth-child(3) {
  animation-delay: 0.3s;
}

.pending-label {
  margin: 0;
  font-size: 13px;
  line-height: 1.4;
  color: var(--on-surface-muted);
}

@keyframes pending-pulse {
  0%,
  80%,
  100% {
    opacity: 0.28;
  }

  40% {
    opacity: 0.9;
  }
}
</style>
