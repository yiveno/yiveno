<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import AppButton from '@/infrastructure/ui/AppButton.vue'

import { RECALL_RESULT_PAGE_SIZE } from '@/core/recall/build-recall-result'
import { recallRemainingVisibleCount } from '@/core/recall/recall-result-visible-count'
import {
  RECALL_CONVERSATION_TURN_PAGE_SIZE,
  recallHiddenEarlierTurnCount,
  resolveNextEarlierTurnReveal,
  sliceVisibleConversationTurns
} from '@/pages/sidepanel/recall-conversation-turn-window'
import type { ConversationTurn, AssistantTurn } from '@/pages/sidepanel/recall-conversation-types'
import type { RecallCardModel } from '@/pages/sidepanel/RecallResultCard.vue'
import RecallResultCard from '@/pages/sidepanel/RecallResultCard.vue'
import { t } from '@/infrastructure/i18n/t'

defineOptions({ name: 'RecallConversation' })

const props = defineProps<{
  turns: ConversationTurn[]
  expandedDuplicateGroupId: string | null
  expandLabel: string
  collapseLabel: string
  noteFieldLabel: string
  /** 等待本轮 Recall 结果时展示脉冲占位 */
  pending?: boolean
  pendingLabel: string
  /** 可见进展：慢请求揭示后的步骤（已完成 + 当前） */
  pendingSteps?: Array<{ label: string; active: boolean }>
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

/** Show more 续展模式：再展一页 / 展开剩余全部。 */
export type ShowMoreMode = 'page' | 'all'

/** a11y：优先当前阶段 / 步骤，否则通用 pending。 */
const pendingAriaLabel = computed(() => {
  if (pendingActiveLabel.value) {
    return pendingActiveLabel.value
  }
  if (props.pendingLabel.trim()) {
    return props.pendingLabel
  }
  return t('popup_recall_pending')
})

/** 当前进行中的阶段文案（与三点同一行）。 */
const pendingActiveLabel = computed(() => {
  const active = props.pendingSteps?.find(step => step.active)
  return active?.label?.trim() ?? ''
})

/** 已完成阶段（列在当前行下方，弱化）。 */
const pendingDoneLabels = computed(() =>
  (props.pendingSteps ?? []).filter(step => !step.active).map(step => step.label)
)

/** 用户已展开的更早 turn 数（超出默认尾部窗口）。 */
const earlierRevealedCount = ref(0)

watch(
  () => props.turns.length,
  (nextLength, previousLength) => {
    if (nextLength > previousLength) {
      earlierRevealedCount.value = 0
    }
  }
)

const visibleTurns = computed(() =>
  sliceVisibleConversationTurns(props.turns, earlierRevealedCount.value)
)

const hiddenEarlierTurnCount = computed(() =>
  recallHiddenEarlierTurnCount(props.turns.length, earlierRevealedCount.value)
)

const canShowEarlierPage = computed(
  () => hiddenEarlierTurnCount.value > RECALL_CONVERSATION_TURN_PAGE_SIZE
)

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
  return recallRemainingVisibleCount(visible, total)
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

function showEarlierCountLabel(count: number): string {
  return t('recall_show_earlier_turns_count', String(count))
}

function showAllEarlierCountLabel(count: number): string {
  return t('recall_show_all_earlier_turns_count', String(count))
}

function onShowEarlierClick(mode: 'page' | 'all'): void {
  earlierRevealedCount.value = resolveNextEarlierTurnReveal(
    earlierRevealedCount.value,
    props.turns.length,
    mode
  )
}

/** 理解回声 a11y：前缀 + 芯片用逗号连接。 */
function understandingEchoAriaLabel(chips: string[]): string {
  return `${t('popup_recall_heard_as')} ${chips.join(t('popup_recall_echo_aria_sep'))}`
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
    <div v-if="hiddenEarlierTurnCount > 0" class="conversation-show-earlier">
      <AppButton
        v-if="canShowEarlierPage"
        type="button"
        variant="text"
        @click="onShowEarlierClick('page')"
      >
        {{ showEarlierCountLabel(RECALL_CONVERSATION_TURN_PAGE_SIZE) }}
      </AppButton>
      <AppButton type="button" variant="text" @click="onShowEarlierClick('all')">
        {{ showAllEarlierCountLabel(hiddenEarlierTurnCount) }}
      </AppButton>
    </div>

    <div
      v-for="turn in visibleTurns"
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
            v-if="turn.understandingEcho && turn.understandingEcho.length > 0"
            class="assistant-turn-echo"
            :aria-label="understandingEchoAriaLabel(turn.understandingEcho)"
          >
            <span class="assistant-turn-echo-prefix">{{ t('popup_recall_heard_as') }}</span>
            <span class="assistant-turn-echo-chips">
              <span
                v-for="(chip, echoIndex) in turn.understandingEcho"
                :key="`${turn.id}-echo-${echoIndex}`"
                class="assistant-turn-echo-item"
              >
                <span v-if="echoIndex > 0" class="assistant-turn-echo-sep" aria-hidden="true"
                  >·</span
                >
                <span class="assistant-turn-echo-chip">{{ chip }}</span>
              </span>
            </span>
          </p>
          <p v-if="turn.deeperReadingTip" class="assistant-turn-deeper-tip" role="status">
            {{ turn.deeperReadingTip }}
          </p>
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
            <AppButton type="button" variant="text" @click="onDismissClick">
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
      :aria-label="pendingAriaLabel"
    >
      <div class="assistant-turn assistant-turn--pending">
        <p class="assistant-turn-name">Yiveno</p>
        <div class="pending-status-row" aria-live="polite">
          <div class="pending-indicator" aria-hidden="true">
            <span class="pending-dot" />
            <span class="pending-dot" />
            <span class="pending-dot" />
          </div>
          <p v-if="pendingActiveLabel" class="pending-label">{{ pendingActiveLabel }}</p>
          <p v-else-if="pendingLabel" class="pending-label">{{ pendingLabel }}</p>
        </div>
        <ol v-if="pendingDoneLabels.length > 0" class="pending-steps-done">
          <li
            v-for="(label, index) in pendingDoneLabels"
            :key="`${index}-${label}`"
            class="pending-step pending-step--done"
          >
            <span class="pending-step-mark" aria-hidden="true">✓</span>
            <span>{{ label }}</span>
          </li>
        </ol>
      </div>
    </div>
  </section>
</template>

<style scoped>
.conversation-show-earlier {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: var(--space-xs) var(--space-sm);
  padding-bottom: var(--space-2xs);
}

.conversation-list {
  display: grid;

  /* turn 间节奏：对话区个性化间距 */
  gap: var(--space-lg);
  min-width: 0;
  padding: var(--space-2xs) 0 var(--space-md);
}

.conversation-turn {
  display: flex;
  min-width: 0;
  content-visibility: auto;
  contain-intrinsic-size: auto 120px;
}

.conversation-turn--user {
  justify-content: flex-end;
}

.conversation-turn--assistant {
  justify-content: flex-start;
}

.conversation-bubble {
  max-width: 88%;
  padding: var(--space-sm) var(--space-md);
  border-radius: var(--radius-xl);
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

.pending-status-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-xs);
  min-width: 0;
}

.pending-indicator {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  gap: var(--space-2xs);
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
  min-width: 0;
  margin: 0;
  font-size: 13px;
  line-height: 1.4;
  color: var(--on-surface);
}

.pending-steps-done {
  display: grid;
  gap: var(--space-2xs);
  margin: 0;
  padding: 0;
  list-style: none;
}

.pending-step {
  display: flex;
  align-items: flex-start;
  gap: var(--space-xs);
  margin: 0;
  font-size: 12px;
  line-height: 1.4;
  color: var(--on-surface-muted);
}

.pending-step--done {
  opacity: 0.72;
}

.pending-step-mark {
  flex: 0 0 auto;
  width: 0.9em;
  font-size: 11px;
  line-height: 1.4;
  text-align: center;
}

.assistant-turn-name {
  margin: 0;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.01em;
  color: var(--on-surface-muted);
}

.assistant-turn-status {
  min-width: 0;
  max-width: 100%;
  margin: 0;
  font-size: 12px;
  line-height: 1.4;
  color: var(--on-surface-muted);
  text-wrap: pretty;
  overflow-wrap: anywhere;
}

.assistant-turn-echo {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: var(--space-2xs) var(--space-xs);
  min-width: 0;
  max-width: 100%;
  margin: 0;
  font-size: 12px;
  line-height: 1.4;
  color: var(--on-surface-muted);
}

.assistant-turn-echo-prefix {
  flex: 0 0 auto;
  font-weight: 600;
  letter-spacing: 0.01em;
}

.assistant-turn-echo-chips {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: var(--space-2xs) var(--space-2xs);
  min-width: 0;
}

.assistant-turn-echo-item {
  display: inline-flex;
  align-items: baseline;
  gap: var(--space-2xs) var(--space-2xs);
  min-width: 0;
}

.assistant-turn-echo-sep {
  color: var(--on-surface-muted);
  opacity: 0.55;
}

.assistant-turn-echo-chip {
  min-width: 0;
  color: var(--on-surface);
  overflow-wrap: anywhere;
}

.assistant-turn-deeper-tip {
  max-width: 42ch;
  margin: 0;
  font-size: 12px;
  line-height: 1.35;
  color: var(--on-surface-muted);
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
  justify-content: flex-start;
  gap: var(--space-xs) var(--space-sm);
  padding-top: var(--space-2xs);
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
