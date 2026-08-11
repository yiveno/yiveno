<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'

import type { ChromeBookmarkImportState } from '@/core/memory/chrome-bookmark-import-state'
import { getChromeBookmarkImportPercent } from '@/core/memory/chrome-bookmark-import-state'
import { shortenClueForRetry } from '@/core/recall/explain-recall-match'
import {
  getPopupIdleEmptyCopy,
  getPopupNoMatchCopy,
  type PopupLibraryState
} from '@/core/recall/popup-empty-copy'
import type { RecallMatch } from '@/core/recall/recall-result'
import { getMemoryItemDisplay } from '@/core/recall/recall-result'
import { buildRecallCardHighlightParts } from '@/core/recall/highlight-recall-text'
import { getMemoryItemOpenHref } from '@/core/recall/memory-open-href'
import { tImportStateError, tRecallError } from '@/infrastructure/i18n/background-error'
import { t } from '@/infrastructure/i18n/t'
import {
  fetchChromeBookmarkImportStatus,
  listMemoryItems,
  recallWithClue,
  recordMemoryOpen,
  recordRecallDismiss
} from '@/infrastructure/messaging/background-client'
import {
  consumePopupRecallPrefill,
  markFirstRecallOpenDone
} from '@/infrastructure/storage/first-recall-onboarding-storage'
import AppPageHeader from '@/infrastructure/ui/AppPageHeader.vue'
import { type PopupRecallCardModel } from '@/pages/popup/RecallResultCard.vue'
import RecallConversation from '@/pages/popup/components/RecallConversation.vue'
import RecallComposer from '@/pages/popup/components/RecallComposer.vue'
import { createAssistantTurn } from '@/pages/popup/build-assistant-turn'
import type {
  ConversationTurn,
  AssistantTurn,
  RecallSuggestion
} from '@/pages/popup/recall-conversation-types'
import type { RecallDialogState } from '@/core/recall/merge-recall-dialog-turn'
import { rollbackLastDialogUtterance } from '@/core/recall/merge-recall-dialog-turn'

defineOptions({ name: 'PopupPage' })

const clue = ref('')
const clueInputRef = ref<InstanceType<typeof RecallComposer> | null>(null)
/** 有旧结果时后台刷新，避免拆掉列表 DOM。 */
const isRecallRefreshing = ref(false)
const errorMessage = ref('')
const importState = ref<ChromeBookmarkImportState | null>(null)
const libraryState = ref<PopupLibraryState>('unknown')
const lastSentClue = ref('')

/** Popup 会话：槽位 accumulated + 本会话否定 id（关闭即丢）。 */
const dialogState = ref<RecallDialogState>({
  priorUserUtterances: [],
  accumulated: null,
  dismissedIds: []
})

const conversationTurns = ref<ConversationTurn[]>([])
let turnSeq = 0

function nextTurnId(): string {
  turnSeq += 1
  return String(turnSeq)
}

function buildRecallSuggestions(): RecallSuggestion[] {
  return [
    {
      id: 'site',
      label: t('popup_suggest_site'),
      // 稳定英文，避免 locale 文案进 parser
      value: 'site'
    },
    {
      id: 'quote',
      label: t('popup_suggest_quote'),
      value: 'quote'
    },
    {
      id: 'note',
      label: t('popup_suggest_note'),
      value: 'my note'
    },
    {
      id: 'type',
      label: t('popup_suggest_type'),
      value: 'article'
    }
  ]
}

/** 无候选 miss：诚实终局文案（无问卷芯片）。 */
function resolveMissAssistantText(input: {
  emptyKind?: string
  hasRelatedGuess: boolean
  library: PopupLibraryState
  clue: string
}): string {
  if (input.emptyKind === 'constrained_none') {
    return input.hasRelatedGuess
      ? t('popup_followup_miss_constrained_empty_with_guess')
      : t('popup_followup_miss_constrained_empty')
  }
  if (input.library === 'empty') {
    const copy = getPopupNoMatchCopy({ library: 'empty', clue: input.clue, canShorten: false }, t)
    return `${copy.title} ${copy.body}`
  }
  return t('popup_reply_miss')
}

let importPollTimer: ReturnType<typeof setInterval> | null = null
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
  getPopupIdleEmptyCopy(libraryState.value, isImporting.value, t)
)

const shortenedClue = computed(() => shortenClueForRetry(lastSentClue.value))

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
      clue: lastSentClue.value,
      canShorten: shortenedClue.value !== null
    },
    t
  )
)

/** 当前展开的重复组代表 id；同时只展开一组。 */
const expandedDuplicateGroupId = ref<string | null>(null)

function toMatchCard(
  match: RecallMatch,
  resultClue: string,
  options: { includeSiblings?: boolean } = {}
): PopupRecallCardModel {
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

  const duplicateTotalCount = match.duplicateGroup?.totalCount
  const duplicateLabel =
    duplicateTotalCount !== undefined && duplicateTotalCount >= 2
      ? match.item.type === 'bookmark'
        ? t('popup_duplicate_group_bookmark', String(duplicateTotalCount))
        : t('popup_duplicate_group_excerpt', String(duplicateTotalCount))
      : undefined

  const siblings =
    options.includeSiblings !== false && match.duplicateGroup
      ? match.duplicateGroup.siblings.map(sibling =>
          toMatchCard(sibling, resultClue, { includeSiblings: false })
        )
      : undefined

  return {
    id: match.item.id,
    title: display.title,
    subtitle: display.subtitle,
    url: getMemoryItemOpenHref(match.item, {
      detailPageUrl: chrome.runtime.getURL('detail.html')
    }),
    typeLabel: display.typeLabel,
    titleParts: highlights.titleParts,
    subtitleParts: highlights.subtitleParts,
    excerptParts: highlights.excerptParts,
    noteParts: highlights.noteParts,
    ...(display.excerpt === undefined ? {} : { excerpt: display.excerpt }),
    ...(display.note === undefined ? {} : { note: display.note }),
    ...(duplicateTotalCount !== undefined &&
    duplicateTotalCount >= 2 &&
    duplicateLabel !== undefined
      ? { duplicateTotalCount, duplicateLabel }
      : {}),
    ...(siblings && siblings.length > 0 ? { siblings } : {})
  }
}

function toggleDuplicateGroup(cardId: string): void {
  expandedDuplicateGroupId.value = expandedDuplicateGroupId.value === cardId ? null : cardId
}

function handleCardOpen(payload: { id: string; url: string }): void {
  handleRecallResultOpen(payload.id, payload.url)
}

/** 「都不是这些」：写否定反馈，保留 accumulated，会话 dismissedIds 并集后再请补线索。 */
async function handleDismissCandidates(): Promise<void> {
  const lastAssistant = [...conversationTurns.value]
    .reverse()
    .find((turn): turn is AssistantTurn => turn.role === 'assistant' && turn.allowDismiss)

  if (!lastAssistant) {
    return
  }

  const ids = lastAssistant.primaryCard?.id
    ? [lastAssistant.primaryCard.id]
    : (lastAssistant.candidateCards?.map(c => c.id) ?? [])

  if (ids.length > 0) {
    dialogState.value = {
      ...dialogState.value,
      dismissedIds: [...new Set([...dialogState.value.dismissedIds, ...ids])]
    }
    void recordRecallDismiss({ ids }).catch(() => {
      // 忽略：反馈失败不阻塞继续补线索
    })
  }

  conversationTurns.value = conversationTurns.value.map(turn => {
    if (turn.role === 'assistant' && turn.id === lastAssistant.id) {
      return { ...turn, allowDismiss: false }
    }
    return turn
  })

  conversationTurns.value.push({
    id: nextTurnId(),
    role: 'user',
    text: t('popup_dismiss_candidates')
  })

  conversationTurns.value.push({
    id: nextTurnId(),
    role: 'assistant',
    tone: 'miss',
    text: t('popup_reply_after_dismiss'),
    suggestions: buildRecallSuggestions(),
    allowDismiss: false
  })

  errorMessage.value = ''
  clue.value = ''
  await nextTick()
  clueInputRef.value?.focus()
}

/** 打开结果时写行为信号；摘录进详情页由 Detail 记，避免双计。 */
function handleRecallResultOpen(memoryItemId: string, openUrl: string): void {
  void markFirstRecallOpenDone().catch(() => {
    // 忽略：引导标记失败不影响打开
  })
  if (openUrl.includes('/detail.html')) {
    return
  }
  void recordMemoryOpen({ id: memoryItemId }).catch(() => {
    // 忽略：打开记录失败不影响用户跳转
  })
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

async function runRecall(trimmedClue: string): Promise<void> {
  const trimmed = trimmedClue.trim()
  if (!trimmed) {
    isRecallRefreshing.value = false
    errorMessage.value = ''
    return
  }

  const requestId = ++recallRequestId
  errorMessage.value = ''
  isRecallRefreshing.value = true

  const priorUserUtterances = [...dialogState.value.priorUserUtterances]
  const accumulated = dialogState.value.accumulated
  const dismissedIds = [...dialogState.value.dismissedIds]

  try {
    const response = await recallWithClue({
      clue: trimmed,
      ...(priorUserUtterances.length > 0 || accumulated || dismissedIds.length > 0
        ? {
            context: {
              ...(priorUserUtterances.length > 0 ? { priorUserUtterances } : {}),
              ...(accumulated ? { accumulated } : {}),
              ...(dismissedIds.length > 0 ? { dismissedIds } : {})
            }
          }
        : {})
    })
    if (requestId !== recallRequestId) {
      return
    }
    isRecallRefreshing.value = false
    if (!response.ok) {
      errorMessage.value = tRecallError(response.errorCode)
      conversationTurns.value.push(
        createAssistantTurn({
          id: nextTurnId(),
          tone: 'error',
          text: errorMessage.value
        })
      )
      return
    }

    // 成功且有合并 parsed 时推进会话（噪音拒绝无 parsed，不污染 prior）
    if (response.result.parsed) {
      dialogState.value = {
        priorUserUtterances: [...priorUserUtterances, trimmed].slice(-5),
        accumulated: response.result.parsed,
        dismissedIds
      }
    }

    const highlightClue = response.result.effectiveClue ?? response.result.clue

    if (response.result.outcome === 'top_pick') {
      const alsoCards = response.result.alsoPossible.map(match => toMatchCard(match, highlightClue))
      conversationTurns.value.push(
        createAssistantTurn({
          id: nextTurnId(),
          tone: 'confident',
          text: t('popup_reply_confident'),
          primaryCard: response.result.topPick
            ? toMatchCard(response.result.topPick, highlightClue)
            : null,
          ...(alsoCards.length > 0
            ? {
                candidateCards: alsoCards,
                candidateSectionLabel: t('popup_section_also_possible')
              }
            : {}),
          allowDismiss: response.result.topPick !== null || alsoCards.length > 0
        })
      )
    } else if (response.result.outcome === 'need_a_clue') {
      const llmFollowUp = response.result.assistantFollowUp
      const candidateCards = response.result.alsoPossible.map(match =>
        toMatchCard(match, highlightClue)
      )
      conversationTurns.value.push(
        createAssistantTurn({
          id: nextTurnId(),
          tone: 'uncertain',
          text: llmFollowUp?.text ?? t('popup_reply_uncertain'),
          candidateCards,
          candidateSectionLabel: t('popup_section_also_possible'),
          ...(llmFollowUp?.suggestions?.length ? { suggestions: llmFollowUp.suggestions } : {}),
          allowDismiss: candidateCards.length > 0
        })
      )
    } else {
      const relatedGuess = response.result.relatedGuess ?? null
      conversationTurns.value.push(
        createAssistantTurn({
          id: nextTurnId(),
          tone: 'miss',
          text: resolveMissAssistantText({
            ...(response.result.emptyKind !== undefined
              ? { emptyKind: response.result.emptyKind }
              : {}),
            hasRelatedGuess: relatedGuess !== null,
            library: libraryState.value,
            clue: highlightClue
          }),
          ...(relatedGuess
            ? {
                relatedGuessCard: toMatchCard(relatedGuess, highlightClue),
                relatedGuessLabel: t('popup_related_guess_label')
              }
            : {})
        })
      )
    }

    void probeMemoryLibrary()
    void nextTick(() => {
      clueInputRef.value?.focus()
    })
  } catch {
    if (requestId !== recallRequestId) {
      return
    }
    isRecallRefreshing.value = false
    errorMessage.value = t('popup_recall_failed')
    conversationTurns.value.push(
      createAssistantTurn({
        id: nextTurnId(),
        tone: 'error',
        text: errorMessage.value
      })
    )
  }
}

/** 缩短再试：只替换最近一句，回滚 prior 末轮后再发缩短版。 */
function handleShortenRetry() {
  const next = shortenedClue.value
  if (!next || isRecallRefreshing.value) {
    return
  }
  dialogState.value = rollbackLastDialogUtterance(dialogState.value)
  void handleSendTurn(next)
}

function handleNavigateError(message: string) {
  errorMessage.value = message
}

async function handleSendTurn(overrideClue?: string): Promise<void> {
  const trimmed = (overrideClue ?? clue.value).trim()
  if (!trimmed || isRecallRefreshing.value) {
    return
  }

  lastSentClue.value = trimmed

  conversationTurns.value.push({
    id: nextTurnId(),
    role: 'user',
    text: trimmed
  })

  // 发送后清空输入，避免 no_match 文案仍依赖输入态
  clue.value = ''

  expandedDuplicateGroupId.value = null
  await runRecall(trimmed)
}

/** 追问芯片：点击即发送一轮（稳定英文 value / 当前 locale label）。 */
function handleUseSuggestion(value: string): void {
  if (!value.trim() || isRecallRefreshing.value) {
    return
  }
  void handleSendTurn(value)
}

onMounted(() => {
  void nextTick(() => {
    clueInputRef.value?.focus()
  })
  void (async () => {
    try {
      const prefill = await consumePopupRecallPrefill()
      if (prefill) {
        clue.value = prefill
        await handleSendTurn()
      }
    } catch {
      // 忽略：无预填不阻塞 Popup
    }
  })()
  void probeMemoryLibrary()
  startImportPolling()
})

onUnmounted(() => {
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

    <div class="recall-body" :class="{ 'recall-body--empty': conversationTurns.length === 0 }">
      <section v-if="conversationTurns.length === 0" class="recall-empty" aria-live="polite">
        <p class="recall-empty-title">
          {{ idleEmptyCopy?.title ?? t('popup_welcome_title') }}
        </p>
        <p class="recall-empty-copy">
          {{ idleEmptyCopy?.body ?? t('popup_welcome_body') }}
        </p>
      </section>

      <RecallConversation
        v-else
        :turns="conversationTurns"
        :expandedDuplicateGroupId="expandedDuplicateGroupId"
        :expandLabel="t('popup_duplicate_expand')"
        :collapseLabel="t('popup_duplicate_collapse')"
        :noteFieldLabel="t('detail_note_label')"
        :showShortenRetry="noMatchCopy.showShortenRetry"
        :shortenRetryLabel="shortenRetryLabel"
        @open="handleCardOpen"
        @toggle-expand="toggleDuplicateGroup"
        @dismiss="handleDismissCandidates"
        @shorten-retry="handleShortenRetry"
        @use-suggestion="handleUseSuggestion"
      />
    </div>

    <p v-if="isRecallRefreshing" class="recall-refresh-hint" role="status" aria-live="polite">
      {{ t('popup_filtering_status') }}
    </p>
    <RecallComposer
      ref="clueInputRef"
      v-model="clue"
      :ariaLabel="t('popup_clue_input_aria')"
      :placeholder="t('popup_clue_placeholder')"
      :disabled="isRecallRefreshing"
      @send="handleSendTurn"
    />
  </main>
</template>

<style scoped>
/*
 * Chrome popup 宽度锁死 360：长 URL / flex min-content 会把文档撑宽，
 * 右侧 padding 与卡片边框被视口裁切。勿给 html/body 设 height:100%。
 */
:global(html),
:global(body) {
  width: 360px;
  max-width: 360px;
  margin: 0;
  overflow-x: hidden;
}

.recall-shell {
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  width: 100%;
  min-width: 0;
  max-width: 100%;
  max-height: 560px;
  padding: 16px 20px 12px;
  color: var(--md-sys-color-on-background);
  background: var(--md-sys-color-background);
  overflow: hidden;
}

.recall-header {
  flex-shrink: 0;
  min-width: 0;
  margin-bottom: 14px;
}

.recall-header-top {
  margin-bottom: 2px;
}

.recall-header-top:deep(.app-page-header__logo) {
  width: 24px;
  height: 24px;
}

.recall-header-top:deep(.app-page-header__brand) {
  font-size: 17px;
  font-weight: 600;
  text-transform: none;
  letter-spacing: -0.01em;
  color: var(--md-sys-color-on-background);
}

.recall-header-top:deep(.app-page-header__nav) {
  gap: 2px;
}

.recall-header-top:deep(md-icon-button) {
  color: var(--md-sys-color-on-surface-variant);
}

.recall-import {
  margin-top: 8px;
  margin-bottom: 0;
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
  overflow-wrap: anywhere;
}

.recall-import--error .recall-import-label {
  color: var(--md-sys-color-on-error-container);
}

.recall-refresh-hint {
  margin: 6px 0 0;
  font-size: 12px;
  line-height: 1.3;
  color: var(--md-sys-color-on-surface-variant);
}

.recall-body {
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
  overflow: hidden auto;
}

.recall-body--empty {
  justify-content: center;
}

.recall-status {
  margin: 8px 0 0;
  font-size: 13px;
  line-height: 1.4;
  color: var(--md-sys-color-on-surface-variant);
}

.recall-error {
  margin: 8px 0 0;
  font-size: 13px;
  line-height: 1.4;
  color: var(--md-sys-color-error);
}

.recall-empty {
  display: grid;
  justify-items: center;
  gap: 12px;
  padding: 8px 10px 24px;
  text-align: center;
  background: transparent;
}

.recall-empty-title {
  margin: 0;
  font-size: 28px;
  font-weight: 700;
  line-height: 1.2;
  letter-spacing: -0.02em;
  text-wrap: balance;
}

.recall-empty-copy {
  max-width: 24ch;
  margin: 0;
  font-size: 14px;
  line-height: 1.5;
  color: var(--md-sys-color-on-surface-variant);
  text-wrap: pretty;
}

.recall-results {
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-width: 0;
  max-width: 100%;
  min-height: 0;
}

.recall-need-clue {
  display: grid;
  gap: 4px;
}

.recall-need-clue-title {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--md-sys-color-on-surface);
}

.recall-need-clue-copy {
  margin: 0;
  font-size: 12px;
  line-height: 1.4;
  color: var(--md-sys-color-on-surface-variant);
}

.recall-section-label {
  margin: 0 0 8px;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.02em;
  color: var(--md-sys-color-on-surface-variant);
}

.recall-feedback-actions {
  display: flex;
  justify-content: flex-end;
  padding-top: 2px;
}

.recall-top-pick {
  display: grid;
  flex-shrink: 0;
  gap: 8px;
  min-width: 0;
}

/* Also 区块：标题固定，仅列表滚动 */
.recall-also {
  display: flex;
  flex-direction: column;
  flex: 0 1 auto;
  min-width: 0;
  min-height: 0;
}

.recall-also > .recall-section-label {
  flex-shrink: 0;
}

.recall-also-list {
  display: grid;
  flex: 0 1 auto;
  gap: 8px;
  min-width: 0;
  min-height: 0;
  margin: 0;
  padding: 0 0 4px;
  overflow: hidden auto;
  overscroll-behavior: contain;
  list-style: none;
}

.recall-also-list > li {
  min-width: 0;
  max-width: 100%;
}
</style>
