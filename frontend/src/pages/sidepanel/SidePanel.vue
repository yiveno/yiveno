<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import AppButton from '@/infrastructure/ui/AppButton.vue'
import AppLinearProgress from '@/infrastructure/ui/AppLinearProgress.vue'

import { watchAuthSessionStorage } from '@/infrastructure/auth/watch-auth-session-storage'
import type { ChromeBookmarkImportState } from '@/core/memory/chrome-bookmark-import-state'
import { getChromeBookmarkImportPercent } from '@/core/memory/chrome-bookmark-import-state'
import { shouldShowCaptureFirstPopup } from '@/core/capture/install-onboarding'
import {
  getPopupIdleEmptyCopy,
  getPopupNoMatchCopy,
  type PopupLibraryState
} from '@/core/recall/popup-empty-copy'
import { getTimeOfDayGreeting } from '@/core/recall/time-of-day-greeting'
import type { RecallMatch } from '@/core/recall/recall-result'
import { getMemoryItemDisplay } from '@/core/recall/recall-result'
import { buildRecallCardHighlightParts } from '@/core/recall/highlight-recall-text'
import { getMemoryItemOpenHref } from '@/core/recall/memory-open-href'
import { tImportStateError, tRecallError } from '@/infrastructure/i18n/background-error'
import { openGettingStartedPage } from '@/infrastructure/browser/getting-started-page'
import { t } from '@/infrastructure/i18n/t'
import {
  fetchAuthState,
  fetchChromeBookmarkImportStatus,
  listMemoryItems,
  recallWithClue,
  recordMemoryOpen,
  recordRecallDismiss
} from '@/infrastructure/messaging/background-client'
import {
  consumeRecallPrefill,
  markFirstRecallOpenDone,
  readExcerptCaptureCount
} from '@/infrastructure/storage/first-recall-onboarding-storage'
import {
  markInstallOnboardingDone,
  readInstallOnboardingDone
} from '@/infrastructure/storage/install-onboarding-storage'
import AppPageHeader from '@/infrastructure/ui/AppPageHeader.vue'
import { type RecallCardModel } from '@/pages/sidepanel/RecallResultCard.vue'
import RecallConversation from '@/pages/sidepanel/components/RecallConversation.vue'
import RecallComposer from '@/pages/sidepanel/components/RecallComposer.vue'
import { createAssistantTurn } from '@/pages/sidepanel/build-assistant-turn'
import type {
  ConversationTurn,
  AssistantTurn,
  RecallSuggestion
} from '@/pages/sidepanel/recall-conversation-types'
import type { RecallDialogState } from '@/core/recall/merge-recall-dialog-turn'
import {
  commitRecallOutcome,
  createRecallOutcomeSessionState,
  shouldOfferRecallOutcomeExitPrompt,
  withFinalizedLastOpenDwell,
  type RecallOutcomeSessionState
} from '@/application/recall/commit-recall-outcome'

defineOptions({ name: 'SidePanelPage' })

const clue = ref('')
const clueInputRef = ref<InstanceType<typeof RecallComposer> | null>(null)
/** 有旧结果时后台刷新，避免拆掉列表 DOM。 */
const isRecallRefreshing = ref(false)
const errorMessage = ref('')
const importState = ref<ChromeBookmarkImportState | null>(null)
const libraryState = ref<PopupLibraryState>('unknown')
const excerptCaptureCount = ref(0)
const installOnboardingDone = ref(true)
const skipOnboardingBusy = ref(false)
const lastSentClue = ref('')
/** 登录展示名；未登录或无名则空，问候退化为仅时段。 */
const accountDisplayName = ref('')

/** Side Panel 会话：槽位 accumulated + 本会话否定 id（关闭 Panel 即丢，P0）。 */
const dialogState = ref<RecallDialogState>({
  priorUserUtterances: [],
  accumulated: null,
  dismissedIds: []
})

/** §7.2 Outcome 会话信号（与 dialog 同寿；关 Panel / New find 结算后重置）。 */
const outcomeSession = ref<RecallOutcomeSessionState>(createRecallOutcomeSessionState())
/** 出口条（通道 D）：New find 前可选 Found / None / Skip。 */
const showOutcomeExitStrip = ref(false)

const conversationTurns = ref<ConversationTurn[]>([])
let turnSeq = 0

const recallBodyRef = ref<HTMLElement | null>(null)
/** 靠近底部时跟随新消息；用户上翻后暂停。 */
const stickToBottom = ref(true)

/** 有气泡或 dialog 槽位时视为活动线程（可 New find）。 */
const hasActiveFindSession = computed(() => {
  const d = dialogState.value
  return (
    conversationTurns.value.length > 0 ||
    d.priorUserUtterances.length > 0 ||
    d.accumulated !== null ||
    d.dismissedIds.length > 0
  )
})

const isComposerProminent = computed(() => conversationTurns.value.length === 0)

function onRecallBodyScroll(): void {
  const el = recallBodyRef.value
  if (!el) {
    return
  }
  const distance = el.scrollHeight - el.scrollTop - el.clientHeight
  stickToBottom.value = distance < 96
}

function scrollRecallToBottom(): void {
  const el = recallBodyRef.value
  if (!el || !stickToBottom.value) {
    return
  }
  el.scrollTop = el.scrollHeight
}

watch(
  () => [conversationTurns.value.length, isRecallRefreshing.value] as const,
  async () => {
    await nextTick()
    scrollRecallToBottom()
  }
)

function nextTurnId(): string {
  turnSeq += 1
  return String(turnSeq)
}

/** 续找时附带 session status；首轮 / 新会话后首轮不带。 */
function continuingContextStatus(
  priorUtterances: string[],
  accumulated: RecallDialogState['accumulated'],
  dismissedIds: string[]
): { contextStatus?: string } {
  const continuing = priorUtterances.length > 0 || accumulated !== null || dismissedIds.length > 0
  return continuing ? { contextStatus: t('popup_session_status_continuing') } : {}
}

/** 用户显式开新找：若需出口条则先出示；否则结算并清空。 */
function startNewFindSession(): void {
  if (!hasActiveFindSession.value) {
    return
  }
  if (showOutcomeExitStrip.value) {
    return
  }
  finalizeOpenDwell()
  if (shouldOfferRecallOutcomeExitPrompt(outcomeSession.value)) {
    showOutcomeExitStrip.value = true
    return
  }
  void completeNewFindSession('new_find')
}

/** 结算 Outcome 并重置会话 UI。 */
async function completeNewFindSession(reason: string): Promise<void> {
  showOutcomeExitStrip.value = false
  await flushOutcomeSession(reason, true)
  recallRequestId += 1
  isRecallRefreshing.value = false
  dialogState.value = {
    priorUserUtterances: [],
    accumulated: null,
    dismissedIds: []
  }
  outcomeSession.value = createRecallOutcomeSessionState()
  conversationTurns.value = []
  clue.value = ''
  lastSentClue.value = ''
  errorMessage.value = ''
  expandedDuplicateGroupId.value = null
  stickToBottom.value = true
  void nextTick(() => {
    clueInputRef.value?.focus()
  })
}

/** 出口条：Found it（默认最后一次 open）。 */
function handleOutcomeExitFound(): void {
  const opens = outcomeSession.value.opens
  const lastId = opens.length > 0 ? opens[opens.length - 1]?.id : null
  if (!lastId) {
    void completeNewFindSession('exit_skip')
    return
  }
  outcomeSession.value = {
    ...outcomeSession.value,
    exitChoice: 'found',
    exitFoundId: lastId
  }
  void completeNewFindSession('exit_found')
}

/** 出口条：None of these。 */
function handleOutcomeExitNone(): void {
  outcomeSession.value = {
    ...outcomeSession.value,
    exitChoice: 'none',
    exitFoundId: null
  }
  void completeNewFindSession('exit_none')
}

/** 出口条：跳过 → unknown。 */
function handleOutcomeExitSkip(): void {
  void completeNewFindSession('exit_skip')
}

/** §7.2 Mark：钉死本会话答案。 */
function handleMarkMeant(id: string): void {
  finalizeOpenDwell()
  outcomeSession.value = {
    ...outcomeSession.value,
    markedTargetId: id,
    dismissedPending: false,
    sawNoMatchFinal: false
  }
  showOutcomeExitStrip.value = false
  void commitRecallOutcome({
    state: outcomeSession.value,
    reason: 'mark'
  })
    .then(result => {
      if (result.settleWritten) {
        outcomeSession.value = {
          ...outcomeSession.value,
          settleWriteDone: true
        }
      }
    })
    .catch(() => {
      // 忽略
    })
}

/** 给最后一次 explore open 补 dwell（C1/C2）。 */
function finalizeOpenDwell(): void {
  outcomeSession.value = {
    ...outcomeSession.value,
    opens: withFinalizedLastOpenDwell(outcomeSession.value.opens)
  }
}

/** §7.2：结算当前 Outcome 会话（best-effort）。 */
async function flushOutcomeSession(reason: string, sessionStopped: boolean): Promise<void> {
  finalizeOpenDwell()
  const state = outcomeSession.value
  const hasSignal =
    state.resultIds.length > 0 ||
    state.opens.length > 0 ||
    state.dismissedPending ||
    state.sawNoMatchFinal ||
    state.markedTargetId !== null ||
    state.exitChoice !== null ||
    state.effectiveClue.trim().length > 0
  if (!hasSignal) {
    return
  }
  try {
    const result = await commitRecallOutcome({ state, sessionStopped, reason })
    if (result.settleWritten) {
      outcomeSession.value = {
        ...outcomeSession.value,
        settleWriteDone: true
      }
    }
  } catch {
    // 忽略：结算失败不挡 New find / 关 Panel
  }
}

function collectResultIdsFromRecall(result: {
  topPick: RecallMatch | null
  alsoPossible: RecallMatch[]
}): string[] {
  const ids: string[] = []
  if (result.topPick) {
    ids.push(result.topPick.item.id)
  }
  for (const match of result.alsoPossible) {
    ids.push(match.item.id)
  }
  return [...new Set(ids)]
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
    const copy = getPopupNoMatchCopy({ library: 'empty', clue: input.clue }, t)
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

const captureFirstMode = computed(() =>
  shouldShowCaptureFirstPopup({
    excerptCaptureCount: excerptCaptureCount.value,
    installOnboardingDone: installOnboardingDone.value
  })
)

const idleEmptyCopy = computed(() =>
  getPopupIdleEmptyCopy(libraryState.value, isImporting.value, t, {
    captureFirst: captureFirstMode.value
  })
)

/** 空线程时占位问候：按时段，有名则带名。 */
const idleGreeting = computed(() =>
  getTimeOfDayGreeting(t, {
    ...(accountDisplayName.value ? { displayName: accountDisplayName.value } : {})
  })
)

/** 当前展开的重复组代表 id；同时只展开一组。 */
const expandedDuplicateGroupId = ref<string | null>(null)

function toMatchCard(
  match: RecallMatch,
  resultClue: string,
  options: { includeSiblings?: boolean } = {}
): RecallCardModel {
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
    itemKind: match.item.type === 'bookmark' ? 'bookmark' : 'text_excerpt',
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
    outcomeSession.value = {
      ...outcomeSession.value,
      dismissedPending: true,
      sawNoMatchFinal: false,
      resultIds: ids
    }
    void recordRecallDismiss({ ids }).catch(() => {
      // 忽略：反馈失败不阻塞继续补线索
    })
    void commitRecallOutcome({
      state: outcomeSession.value,
      reason: 'dismiss'
    })
      .then(result => {
        if (result.settleWritten) {
          outcomeSession.value = {
            ...outcomeSession.value,
            settleWriteDone: true
          }
        }
      })
      .catch(() => {
        // 忽略：Outcome 日志失败不挡 dismiss
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
    contextStatus: t('popup_session_status_continuing'),
    suggestions: buildRecallSuggestions(),
    allowDismiss: false
  })

  errorMessage.value = ''
  clue.value = ''
  await nextTick()
  clueInputRef.value?.focus()
}

/** 打开结果时写 explore open（§7.2：≠ settled）；摘录进详情页由 Detail 记，避免双计。 */
function handleRecallResultOpen(memoryItemId: string, openUrl: string): void {
  void markFirstRecallOpenDone().catch(() => {
    // 忽略：引导标记失败不影响打开
  })
  finalizeOpenDwell()
  outcomeSession.value = {
    ...outcomeSession.value,
    opens: [...outcomeSession.value.opens, { id: memoryItemId, at: new Date().toISOString() }]
  }
  if (openUrl.includes('/detail.html')) {
    return
  }
  void recordMemoryOpen({ id: memoryItemId }).catch(() => {
    // 忽略：打开记录失败不影响用户跳转
  })
}

async function loadOnboardingState(): Promise<void> {
  try {
    const [captureCount, onboardingDone] = await Promise.all([
      readExcerptCaptureCount(),
      readInstallOnboardingDone()
    ])
    excerptCaptureCount.value = captureCount
    installOnboardingDone.value = onboardingDone
  } catch {
    // 忽略：默认不展示 Capture-first，避免阻塞 Popup
  }
}

/** 读取展示名供空态问候；无展示名时用邮箱本地段。失败不阻塞主路径。 */
async function loadGreetingIdentity(): Promise<void> {
  try {
    const response = await fetchAuthState()
    if (!response.ok) {
      accountDisplayName.value = ''
      return
    }
    const fromProfile = response.displayName?.trim() ?? ''
    if (fromProfile) {
      accountDisplayName.value = fromProfile
      return
    }
    const email = response.email?.trim() ?? ''
    const localPart = email.includes('@') ? email.slice(0, email.indexOf('@')).trim() : ''
    accountDisplayName.value = localPart
  } catch {
    accountDisplayName.value = ''
  }
}

async function handleSkipOnboarding(): Promise<void> {
  if (skipOnboardingBusy.value) {
    return
  }
  skipOnboardingBusy.value = true
  try {
    await markInstallOnboardingDone()
    installOnboardingDone.value = true
  } finally {
    skipOnboardingBusy.value = false
  }
}

function handleOpenGettingStarted(): void {
  void openGettingStartedPage()
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
  const contextStatusFields = continuingContextStatus(
    priorUserUtterances,
    accumulated,
    dismissedIds
  )

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
          text: errorMessage.value,
          ...contextStatusFields
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
    const resultIds = collectResultIdsFromRecall(response.result)

    if (response.result.outcome === 'top_pick' || response.result.outcome === 'need_a_clue') {
      outcomeSession.value = {
        ...outcomeSession.value,
        effectiveClue: highlightClue,
        resultIds,
        // 新候选短名单出现后，清掉「待处理 dismiss」，避免后续找着了仍被 sticky none 盖住
        dismissedPending: false,
        sawNoMatchFinal: false
      }
    } else {
      outcomeSession.value = {
        ...outcomeSession.value,
        effectiveClue: highlightClue,
        resultIds,
        sawNoMatchFinal: true,
        dismissedPending: false
      }
      void commitRecallOutcome({
        state: outcomeSession.value,
        reason: 'no_match'
      })
        .then(result => {
          if (result.settleWritten) {
            outcomeSession.value = {
              ...outcomeSession.value,
              settleWriteDone: true
            }
          }
        })
        .catch(() => {
          // 忽略
        })
    }

    if (response.result.outcome === 'top_pick') {
      const alsoCards = response.result.alsoPossible.map(match => toMatchCard(match, highlightClue))
      conversationTurns.value.push(
        createAssistantTurn({
          id: nextTurnId(),
          tone: 'confident',
          text: t('popup_reply_confident'),
          ...contextStatusFields,
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
          ...contextStatusFields,
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
          ...contextStatusFields,
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
        text: errorMessage.value,
        ...contextStatusFields
      })
    )
  }
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

  // 发送后强制黏底，保证看见待回复与结果
  stickToBottom.value = true

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

/** 取消登录态 storage 订阅。 */
let stopWatchAuthSession: (() => void) | null = null

onMounted(() => {
  void nextTick(() => {
    clueInputRef.value?.focus()
  })
  void loadOnboardingState()
  void loadGreetingIdentity()
  stopWatchAuthSession = watchAuthSessionStorage(() => {
    void loadGreetingIdentity()
  })
  void (async () => {
    try {
      const prefill = await consumeRecallPrefill()
      if (prefill) {
        clue.value = prefill
        await handleSendTurn()
      }
    } catch {
      // 忽略：无预填不阻塞 Side Panel
    }
  })()
  void probeMemoryLibrary()
  startImportPolling()
})

onUnmounted(() => {
  void flushOutcomeSession('panel_close', true)
  recallRequestId += 1
  stopImportPolling()
  stopWatchAuthSession?.()
  stopWatchAuthSession = null
})
</script>

<template>
  <main class="recall-shell">
    <header class="recall-header">
      <AppPageHeader
        class="recall-header-top"
        show-new-find
        :new-find-enabled="hasActiveFindSession"
        @navigate-error="handleNavigateError"
        @new-find="startNewFindSession"
      />

      <section
        v-if="showImportProgress"
        class="recall-import"
        :class="{ 'recall-import--error': importState?.status === 'failed' }"
        aria-live="polite"
      >
        <p class="recall-import-label">{{ importProgressLabel }}</p>
        <AppLinearProgress
          v-if="importState?.status === 'running'"
          :value="importProgressPercent / 100"
          :aria-label="t('popup_import_progress_aria')"
        />
      </section>
    </header>

    <div
      ref="recallBodyRef"
      class="recall-body"
      :class="{ 'recall-body--empty': conversationTurns.length === 0 }"
      @scroll="onRecallBodyScroll"
    >
      <section v-if="conversationTurns.length === 0" class="recall-empty" aria-live="polite">
        <div class="recall-greeting-slot">
          <p class="recall-greeting">{{ idleGreeting }}</p>
        </div>
        <div class="recall-empty-main">
          <p class="recall-empty-title">
            {{ idleEmptyCopy?.title ?? t('popup_welcome_title') }}
          </p>
          <p class="recall-empty-copy">
            {{ idleEmptyCopy?.body ?? t('popup_welcome_body') }}
          </p>
          <div v-if="captureFirstMode" class="recall-empty-actions">
            <AppButton type="button" @click="handleOpenGettingStarted" variant="tonal">
              {{ t('popup_open_getting_started') }}
            </AppButton>
            <AppButton
              type="button"
              :disabled="skipOnboardingBusy"
              @click="handleSkipOnboarding"
              variant="text"
            >
              {{ t('popup_skip_onboarding') }}
            </AppButton>
          </div>
        </div>
      </section>

      <RecallConversation
        v-else
        :turns="conversationTurns"
        :expandedDuplicateGroupId="expandedDuplicateGroupId"
        :expandLabel="t('popup_duplicate_expand')"
        :collapseLabel="t('popup_duplicate_collapse')"
        :noteFieldLabel="t('detail_note_label')"
        :marked-target-id="outcomeSession.markedTargetId"
        :mark-label="t('popup_mark_as_meant')"
        :marked-label="t('popup_mark_as_meant_done')"
        :pending="isRecallRefreshing"
        :pendingLabel="t('popup_recall_pending')"
        @open="handleCardOpen"
        @toggle-expand="toggleDuplicateGroup"
        @dismiss="handleDismissCandidates"
        @mark="handleMarkMeant"
        @use-suggestion="handleUseSuggestion"
      />
    </div>

    <div
      v-if="showOutcomeExitStrip"
      class="recall-outcome-exit"
      role="group"
      :aria-label="t('popup_outcome_exit_prompt')"
    >
      <p class="recall-outcome-exit__prompt">{{ t('popup_outcome_exit_prompt') }}</p>
      <div class="recall-outcome-exit__actions">
        <AppButton type="button" variant="filled" @click="handleOutcomeExitFound">
          {{ t('popup_outcome_exit_found') }}
        </AppButton>
        <AppButton type="button" variant="outlined" @click="handleOutcomeExitNone">
          {{ t('popup_outcome_exit_none') }}
        </AppButton>
        <AppButton type="button" variant="text" @click="handleOutcomeExitSkip">
          {{ t('popup_outcome_exit_skip') }}
        </AppButton>
      </div>
    </div>

    <RecallComposer
      ref="clueInputRef"
      v-model="clue"
      :ariaLabel="t('popup_clue_input_aria')"
      :placeholder="t('popup_clue_placeholder')"
      :sendLabel="t('popup_submit')"
      :disabled="isRecallRefreshing"
      :prominent="isComposerProminent"
      @send="handleSendTurn"
    />
  </main>
</template>

<style scoped>
/*
 * Side Panel：随侧栏宽度伸缩；竖向占满可视高度以承载持续对话。
 * 勿再锁 360px（那是旧 Action Popup 约束）。
 */
:global(html),
:global(body) {
  width: 100%;
  max-width: 100%;
  height: 100%;
  margin: 0;
  overflow-x: hidden;
}

:global(#app) {
  height: 100%;
}

.recall-shell {
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  width: 100%;
  min-width: 0;
  max-width: 100%;
  height: 100%;
  min-height: 100%;
  max-height: none;
  /* 顶栏非对称内边距：略紧于标准 page shell */
  padding: var(--space-sm) var(--space-md) var(--space-md);
  color: var(--on-surface);
  background: var(--surface);
  overflow: hidden;
}

.recall-outcome-exit {
  display: grid;
  gap: var(--space-xs);
  flex-shrink: 0;
  margin-bottom: var(--space-sm);
  padding: var(--space-sm);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: var(--surface-chrome);
}

.recall-outcome-exit__prompt {
  margin: 0;
  font-size: 13px;
  line-height: 1.4;
  color: var(--on-surface);
}

.recall-outcome-exit__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-xs);
}

.recall-header {
  flex-shrink: 0;
  min-width: 0;
  margin-bottom: var(--space-sm);
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
  color: var(--on-surface);
}

.recall-header-top:deep(.app-page-header__nav) {
  gap: 2px;
}

.recall-header-top:deep(.app-icon-button) {
  color: var(--on-surface-muted);
}

.recall-import {
  margin-top: var(--space-xs);
  margin-bottom: 0;
  padding: var(--space-sm);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--surface-white);
}

.recall-import--error {
  border-color: color-mix(in srgb, var(--danger) 16%, var(--paper));
  background: color-mix(in srgb, var(--danger) 16%, var(--paper));
}

.recall-import-label {
  margin: 0 0 var(--space-xs);
  font-size: 12px;
  line-height: 1.4;
  color: var(--on-surface-muted);
  overflow-wrap: anywhere;
}

.recall-import--error .recall-import-label {
  color: var(--danger);
}

.recall-body {
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
  overflow: hidden auto;
  overscroll-behavior: contain;
  scroll-behavior: smooth;
}

.recall-body--empty {
  padding-bottom: var(--space-xs);
}

.recall-empty {
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  gap: var(--space-md);
  width: 100%;
  min-height: 0;
  padding: var(--space-2xs) var(--space-2xs) var(--space-md);
  text-align: left;
  background: transparent;
}

/* 占满中间空白，问候垂直居中，成为空态主视觉 */
.recall-greeting-slot {
  display: flex;
  align-items: center;
  flex: 1 1 auto;
  min-height: 120px;
  padding: var(--space-xs) 0;
}

.recall-greeting {
  margin: 0;
  max-width: 18ch;
  font-size: clamp(28px, 7vw, 36px);
  font-weight: 600;
  line-height: 1.2;
  letter-spacing: -0.03em;
  color: var(--on-surface);
  text-wrap: balance;
  animation: recall-greeting-in var(--motion-duration-medium) var(--motion-easing-emphasized) both;
}

.recall-empty-main {
  display: grid;
  justify-items: start;
  flex-shrink: 0;
  gap: var(--space-xs);
  width: 100%;
  max-width: 36ch;
}

.recall-empty-title {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  line-height: 1.25;
  letter-spacing: -0.02em;
  text-wrap: balance;
}

.recall-empty-copy {
  max-width: 32ch;
  margin: 0;
  font-size: 14px;
  line-height: 1.5;
  color: var(--on-surface-muted);
  text-wrap: pretty;
}

.recall-empty-actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2xs) var(--space-xs);
  justify-content: flex-start;
  margin-top: var(--space-2xs);
}

@keyframes recall-greeting-in {
  from {
    opacity: 0;
  }

  to {
    opacity: 1;
  }
}

@media (prefers-reduced-motion: reduce) {
  .recall-greeting {
    animation: none;
  }
}

.recall-results {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
  min-width: 0;
  max-width: 100%;
  min-height: 0;
}

.recall-need-clue {
  display: grid;
  gap: var(--space-2xs);
}

.recall-need-clue-title {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--on-surface);
}

.recall-need-clue-copy {
  margin: 0;
  font-size: 12px;
  line-height: 1.4;
  color: var(--on-surface-muted);
}

.recall-section-label {
  margin: 0 0 var(--space-xs);
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.02em;
  color: var(--on-surface-muted);
}

.recall-feedback-actions {
  display: flex;
  justify-content: flex-end;
  padding-top: 2px;
}

.recall-top-pick {
  display: grid;
  flex-shrink: 0;
  gap: var(--space-xs);
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
  gap: var(--space-xs);
  min-width: 0;
  min-height: 0;
  margin: 0;
  padding: 0 0 var(--space-2xs);
  overflow: hidden auto;
  overscroll-behavior: contain;
  list-style: none;
}

.recall-also-list > li {
  min-width: 0;
  max-width: 100%;
}
</style>
