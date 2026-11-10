<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import AppButton from '@/infrastructure/ui/AppButton.vue'

import { RECALL_RESULT_PAGE_SIZE } from '@/core/recall/build-recall-result'
import {
  recallObjectTypeLabelKey,
  recallTimeLabelMessageKey,
  type RecallUnderstandingEchoChip
} from '@/core/recall/format-recall-understanding-echo'
import { RECALL_OBJECT_TYPE_CANONICAL_SURFACES } from '@/core/recall/parse-recall-clue-lexicon'
import type { RecallObjectType } from '@/core/recall/parse-recall-clue-types'
import { recallRemainingVisibleCount } from '@/core/recall/recall-result-visible-count'
import {
  ECHO_CORRECTION_TIME_OPTIONS,
  synthesizeEchoContentTermExcludeClue,
  synthesizeEchoObjectTypeReplaceClue,
  synthesizeEchoTimeReplaceClue
} from '@/core/recall/synthesize-echo-correction-clue'
import {
  RECALL_CONVERSATION_TURN_PAGE_SIZE,
  recallHiddenEarlierTurnCount,
  resolveNextEarlierTurnReveal,
  sliceVisibleConversationTurns
} from '@/pages/sidepanel/recall-conversation-turn-window'
import type { ConversationTurn, AssistantTurn } from '@/pages/sidepanel/recall-conversation-types'
import type { RecallCardModel } from '@/pages/sidepanel/RecallResultCard.vue'
import ClueFormattedText from '@/pages/sidepanel/composer/ClueFormattedText.vue'
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
  /** 理解回声纠错：合成英文 refine clue */
  correctUnderstanding: [value: string]
  toggleDetailExportSelection: [memoryItemId: string]
  /** 空库「导入书签」→ Settings 书签灌库开关 */
  openBookmarkIngestSettings: []
}>()

/** 纠错菜单：`${turnId}::${chipId}`；null = 关闭。 */
const openEchoMenuKey = ref<string | null>(null)

const ALL_OBJECT_TYPES = Object.keys(RECALL_OBJECT_TYPE_CANONICAL_SURFACES) as RecallObjectType[]

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
      openEchoMenuKey.value = null
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
function understandingEchoAriaLabel(chips: RecallUnderstandingEchoChip[]): string {
  return `${t('popup_recall_heard_as')} ${chips
    .map(chip => chip.label)
    .join(t('popup_recall_echo_aria_sep'))}`
}

function echoMenuKey(turnId: string, chipId: string): string {
  return `${turnId}::${chipId}`
}

function isEchoMenuOpen(turnId: string, chipId: string): boolean {
  return openEchoMenuKey.value === echoMenuKey(turnId, chipId)
}

function toggleEchoMenu(turnId: string, chip: RecallUnderstandingEchoChip): void {
  if (!chip.correctable) {
    return
  }
  const key = echoMenuKey(turnId, chip.id)
  openEchoMenuKey.value = openEchoMenuKey.value === key ? null : key
}

function closeEchoMenu(): void {
  openEchoMenuKey.value = null
}

function echoCorrectAria(chip: RecallUnderstandingEchoChip): string {
  return t('popup_recall_echo_correct_aria', [chip.label])
}

/** 时间纠错选项：排除当前 label。 */
function echoTimeOptions(chip: RecallUnderstandingEchoChip) {
  return ECHO_CORRECTION_TIME_OPTIONS.filter(label => label !== chip.timeLabel).map(label => ({
    label: t(recallTimeLabelMessageKey(label)),
    value: synthesizeEchoTimeReplaceClue(label)
  }))
}

/** 类型纠错选项：排除当前类型。 */
function echoObjectTypeOptions(chip: RecallUnderstandingEchoChip) {
  return ALL_OBJECT_TYPES.filter(type => type !== chip.objectType).map(type => ({
    label: t(recallObjectTypeLabelKey(type)),
    value: synthesizeEchoObjectTypeReplaceClue(type)
  }))
}

function commitEchoCorrection(clue: string): void {
  const trimmed = clue.trim()
  if (!trimmed) {
    return
  }
  closeEchoMenu()
  emit('correctUnderstanding', trimmed)
}

function commitEchoDropTerm(chip: RecallUnderstandingEchoChip): void {
  if (!chip.contentTerm) {
    return
  }
  commitEchoCorrection(synthesizeEchoContentTermExcludeClue(chip.contentTerm))
}

function onDocumentPointerDown(event: PointerEvent): void {
  if (!openEchoMenuKey.value) {
    return
  }
  const target = event.target
  if (!(target instanceof Element)) {
    closeEchoMenu()
    return
  }
  if (target.closest('.assistant-turn-echo-item')) {
    return
  }
  closeEchoMenu()
}

onMounted(() => {
  document.addEventListener('pointerdown', onDocumentPointerDown, true)
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onDocumentPointerDown, true)
})

function isDetailExportSelected(id: string): boolean {
  return props.selectedDetailExportIds?.has(id) === true
}

function isDetailExportSelectionDisabled(_id: string): boolean {
  return false
}

function handleToggleDetailExportSelection(id: string): void {
  emit('toggleDetailExportSelection', id)
}

/** 本轮是否有可点选结果卡（有卡时 Framing 说明书放到卡后，先扫邻域）。 */
function hasAssistantResultCards(turn: AssistantTurn): boolean {
  if (turn.primaryCard) {
    return true
  }
  if (turn.relatedGuessCard) {
    return true
  }
  return (turn.candidateCards?.length ?? 0) > 0
}

/** Framing/助手正文是否有可渲染内容（避免卡后空段落）。 */
function hasAssistantCopy(turn: AssistantTurn): boolean {
  if (turn.textSegments && turn.textSegments.length > 0) {
    return true
  }
  return turn.text.trim().length > 0
}

/** 本轮已展示卡数（供卡前 P6 紧凑计数）。 */
function shownNeighborhoodCardCount(turn: AssistantTurn): number {
  let count = 0
  if (turn.primaryCard) {
    count += 1
  }
  if (turn.relatedGuessCard) {
    count += 1
  }
  if (turn.candidateCards && turn.candidateCards.length > 0) {
    const limit = turn.visibleCount ?? turn.candidateCards.length
    count += Math.min(turn.candidateCards.length, Math.max(0, limit))
  }
  return count
}

/**
 * 卡前邻域计数（承接 Framing P6）。
 * 有卡时说明书不再拼计数，避免「先卡后 Framing」把 N 埋到卡后。
 */
function neighborhoodCountLabel(turn: AssistantTurn): string | null {
  const total = turn.rankedTotalCount
  if (!total || total <= 0 || !hasAssistantResultCards(turn)) {
    return null
  }
  const shown = Math.min(shownNeighborhoodCardCount(turn), total)
  if (shown >= total) {
    return t('popup_reply_ranked_all', [String(total)])
  }
  return t('popup_reply_ranked_partial', [String(total), '1', String(shown)])
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
        <div class="conversation-bubble conversation-bubble--user">
          <ClueFormattedText :text="turn.text" />
        </div>
      </template>

      <template v-else>
        <div class="assistant-turn">
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
                :key="`${turn.id}-echo-${chip.id}`"
                class="assistant-turn-echo-item"
              >
                <span v-if="echoIndex > 0" class="assistant-turn-echo-sep" aria-hidden="true"
                  >·</span
                >
                <button
                  v-if="chip.correctable"
                  type="button"
                  class="assistant-turn-echo-chip assistant-turn-echo-chip--correctable"
                  :aria-expanded="isEchoMenuOpen(turn.id, chip.id)"
                  :aria-haspopup="chip.kind === 'content_term' ? 'true' : 'menu'"
                  :title="echoCorrectAria(chip)"
                  :aria-label="echoCorrectAria(chip)"
                  @click.stop="toggleEchoMenu(turn.id, chip)"
                >
                  {{ chip.label }}
                </button>
                <span v-else class="assistant-turn-echo-chip">{{ chip.label }}</span>
                <span
                  v-if="isEchoMenuOpen(turn.id, chip.id)"
                  class="assistant-turn-echo-menu"
                  role="menu"
                  :aria-label="echoCorrectAria(chip)"
                  @click.stop
                >
                  <template v-if="chip.kind === 'time'">
                    <span class="assistant-turn-echo-menu-title" aria-hidden="true">{{
                      t('popup_recall_echo_change_time')
                    }}</span>
                    <button
                      v-for="option in echoTimeOptions(chip)"
                      :key="`${chip.id}-${option.value}`"
                      type="button"
                      class="assistant-turn-echo-menu-item"
                      role="menuitem"
                      @click="commitEchoCorrection(option.value)"
                    >
                      {{ option.label }}
                    </button>
                  </template>
                  <template v-else-if="chip.kind === 'object_type'">
                    <span class="assistant-turn-echo-menu-title" aria-hidden="true">{{
                      t('popup_recall_echo_change_type')
                    }}</span>
                    <button
                      v-for="option in echoObjectTypeOptions(chip)"
                      :key="`${chip.id}-${option.value}`"
                      type="button"
                      class="assistant-turn-echo-menu-item"
                      role="menuitem"
                      @click="commitEchoCorrection(option.value)"
                    >
                      {{ option.label }}
                    </button>
                  </template>
                  <template v-else-if="chip.kind === 'content_term'">
                    <button
                      type="button"
                      class="assistant-turn-echo-menu-item"
                      role="menuitem"
                      @click="commitEchoDropTerm(chip)"
                    >
                      {{ t('popup_recall_echo_drop_term') }}
                    </button>
                  </template>
                </span>
              </span>
            </span>
          </p>
          <p v-if="turn.deeperReadingTip" class="assistant-turn-deeper-tip" role="status">
            {{ turn.deeperReadingTip }}
          </p>
          <p v-if="turn.clueTruncatedTip" class="assistant-turn-deeper-tip" role="status">
            {{ turn.clueTruncatedTip }}
          </p>
          <!-- 无卡：Framing/文案仍在上（空结果/错误主读）；有卡：先卡后说明书 -->
          <p
            v-if="!hasAssistantResultCards(turn) && hasAssistantCopy(turn)"
            class="assistant-turn-copy"
            :class="{ 'assistant-turn-copy--error': turn.tone === 'error' }"
          >
            <template v-if="turn.textSegments && turn.textSegments.length > 0">
              <template v-for="(segment, segmentIndex) in turn.textSegments" :key="segmentIndex">
                <button
                  v-if="segment.kind === 'open_bookmark_ingest_settings'"
                  type="button"
                  class="assistant-turn-inline-link"
                  :title="t('popup_empty_import_bookmarks_aria')"
                  :aria-label="t('popup_empty_import_bookmarks_aria')"
                  @click="emit('openBookmarkIngestSettings')"
                >
                  {{ segment.text }}
                </button>
                <template v-else>{{ segment.text }}</template>
              </template>
            </template>
            <template v-else>{{ turn.text }}</template>
          </p>

          <!-- 邻域锚点：有卡时滚到此处，避免黏底把首卡顶出视口；P6 计数紧贴卡前 -->
          <div
            v-if="hasAssistantResultCards(turn)"
            class="assistant-turn-neighborhood"
            data-recall-neighborhood-anchor
          >
            <p
              v-if="neighborhoodCountLabel(turn)"
              class="assistant-turn-neighborhood-count"
              role="status"
            >
              {{ neighborhoodCountLabel(turn) }}
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
          </div>

          <p
            v-if="hasAssistantResultCards(turn) && hasAssistantCopy(turn)"
            class="assistant-turn-copy assistant-turn-copy--after-cards"
            :class="{ 'assistant-turn-copy--error': turn.tone === 'error' }"
          >
            <template v-if="turn.textSegments && turn.textSegments.length > 0">
              <template
                v-for="(segment, segmentIndex) in turn.textSegments"
                :key="`after-${segmentIndex}`"
              >
                <button
                  v-if="segment.kind === 'open_bookmark_ingest_settings'"
                  type="button"
                  class="assistant-turn-inline-link"
                  :title="t('popup_empty_import_bookmarks_aria')"
                  :aria-label="t('popup_empty_import_bookmarks_aria')"
                  @click="emit('openBookmarkIngestSettings')"
                >
                  {{ segment.text }}
                </button>
                <template v-else>{{ segment.text }}</template>
              </template>
            </template>
            <template v-else>{{ turn.text }}</template>
          </p>

          <!--
            快速反馈区：追问芯片（硬收窄）+「都不是」（否定本轮候选）同区异形。
            芯片在前；否定控件在末尾，用 text 钮而非 pill，避免读成又一条 clue。
          -->
          <div
            v-if="
              (turn.suggestions && turn.suggestions.length > 0) ||
              (turn.allowDismiss && latestDismissibleAssistantId === turn.id)
            "
            class="assistant-turn-quick-feedback"
          >
            <button
              v-for="suggestion in turn.suggestions ?? []"
              :key="suggestion.id"
              type="button"
              class="assistant-turn-pill"
              @click="onSuggestionClick(suggestion.value)"
            >
              {{ suggestion.label }}
            </button>
            <button
              v-if="turn.allowDismiss && latestDismissibleAssistantId === turn.id"
              type="button"
              class="assistant-turn-dismiss"
              @click="onDismissClick"
            >
              {{ t('popup_dismiss_candidates') }}
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
  /* 仅 opacity 呼吸；禁止几何变换（产品 §3） */
  animation: pending-label-breathe 2.4s ease-in-out infinite;
}

@keyframes pending-label-breathe {
  0%,
  100% {
    opacity: 0.78;
  }
  50% {
    opacity: 1;
  }
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
  position: relative;
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
  margin: 0;
  padding: 0;
  border: none;
  font: inherit;
  font-size: inherit;
  line-height: inherit;
  color: var(--on-surface);
  background: transparent;
  overflow-wrap: anywhere;
}

.assistant-turn-echo-chip--correctable {
  text-decoration: underline;
  text-decoration-style: dotted;
  text-underline-offset: 0.18em;
  cursor: pointer;
  border-radius: var(--radius-sm);
}

.assistant-turn-echo-chip--correctable:hover {
  background: var(--surface-chrome);
}

.assistant-turn-echo-chip--correctable:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.assistant-turn-echo-menu {
  position: absolute;
  z-index: 4;
  top: calc(100% + 4px);
  left: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 9rem;
  max-width: min(16rem, 70vw);
  max-height: 14rem;
  overflow: auto;
  padding: var(--space-2xs);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--surface-white);
  box-shadow: var(--elevation-1, 0 4px 12px rgb(0 0 0 / 8%));
}

.assistant-turn-echo-menu-title {
  padding: 2px var(--space-2xs);
  font-size: 11px;
  line-height: 1.3;
  font-weight: 600;
  color: var(--on-surface-muted);
}

.assistant-turn-echo-menu-item {
  display: block;
  width: 100%;
  min-height: 28px;
  padding: 4px var(--space-2xs);
  border: none;
  border-radius: var(--radius-sm);
  font: inherit;
  font-size: 12px;
  line-height: 1.3;
  text-align: left;
  color: var(--on-surface);
  background: transparent;
  cursor: pointer;
}

.assistant-turn-echo-menu-item:hover {
  background: var(--surface-chrome);
}

.assistant-turn-echo-menu-item:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 1px;
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

/* 有邻域卡时：说明书退居卡后，略降字号/对比，不抢扫读 */
.assistant-turn-copy--after-cards {
  margin-top: var(--space-2xs);
  font-size: 13px;
  line-height: 1.45;
  color: var(--on-surface-muted);
}

.assistant-turn-inline-link {
  display: inline;
  padding: 0;
  margin: 0;
  font: inherit;
  line-height: inherit;
  color: var(--primary);
  text-decoration: underline;
  text-underline-offset: 0.12em;
  cursor: pointer;
  background: none;
  border: none;
}

.assistant-turn-inline-link:hover,
.assistant-turn-inline-link:focus-visible {
  color: var(--primary);
  opacity: 0.85;
  outline: none;
}

.assistant-turn-inline-link:focus-visible {
  outline: 2px solid color-mix(in srgb, var(--primary) 45%, transparent);
  outline-offset: 2px;
  border-radius: 2px;
}

.assistant-turn-neighborhood {
  display: grid;
  gap: var(--space-xs);
  min-width: 0;
}

.assistant-turn-neighborhood-count {
  margin: 0;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.01em;
  color: var(--on-surface-muted);
}

.assistant-turn-related-guess {
  display: grid;
  gap: var(--space-xs);
  min-width: 0;
  padding-top: 2px;
  animation: recall-result-card-enter var(--motion-duration-short, 150ms)
    var(--motion-easing-standard, cubic-bezier(0.2, 0, 0, 1)) both;
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
  animation: recall-result-card-enter var(--motion-duration-short, 150ms)
    var(--motion-easing-standard, cubic-bezier(0.2, 0, 0, 1)) both;
}

.assistant-turn-quick-feedback {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-xs) var(--space-sm);
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

/* 否定反馈：同区末尾弱化文字钮，禁止做成追问 pill */
.assistant-turn-dismiss {
  display: inline-flex;
  align-items: center;
  min-height: 32px;
  padding: 0 var(--space-2xs);
  border: none;
  border-radius: var(--radius-sm);
  font: inherit;
  font-size: 13px;
  line-height: 1;
  color: var(--on-surface-muted);
  background: transparent;
  cursor: pointer;
}

.assistant-turn-dismiss:hover {
  color: var(--on-surface);
  background: var(--surface-chrome);
}

.assistant-turn-dismiss:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.assistant-turn-candidates {
  display: grid;
  gap: var(--space-xs);
  margin: 0;
  padding: 0;
  list-style: none;
}

/* 邻域入场：仅 opacity stagger；禁止几何变换（设计标准 §5.3–5.4） */
.assistant-turn-candidates > li {
  animation: recall-result-card-enter var(--motion-duration-medium, 250ms)
    var(--motion-easing-standard, cubic-bezier(0.2, 0, 0, 1)) both;
}

.assistant-turn-candidates > li:nth-child(1) {
  animation-delay: 0ms;
}

.assistant-turn-candidates > li:nth-child(2) {
  animation-delay: 40ms;
}

.assistant-turn-candidates > li:nth-child(3) {
  animation-delay: 80ms;
}

.assistant-turn-candidates > li:nth-child(4) {
  animation-delay: 120ms;
}

.assistant-turn-candidates > li:nth-child(5) {
  animation-delay: 160ms;
}

.assistant-turn-candidates > li:nth-child(n + 6) {
  animation-delay: 200ms;
}

.assistant-turn-show-more {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-start;
  gap: var(--space-xs) var(--space-sm);
  padding-top: var(--space-2xs);
}

@keyframes recall-result-card-enter {
  from {
    opacity: 0;
  }

  to {
    opacity: 1;
  }
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

@media (prefers-reduced-motion: reduce) {
  .assistant-turn-primary,
  .assistant-turn-related-guess,
  .assistant-turn-candidates > li {
    animation: none;
  }

  .pending-dot,
  .pending-label {
    animation: none;
  }
}
</style>
