<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'

import {
  getChromeBookmarkImportPercent,
  type ChromeBookmarkImportState
} from '@/core/memory/chrome-bookmark-import-state'
import { parseChromeBookmarkTreeChangedMessage } from '@/core/messaging/ui-messages'
import { tChromeBookmarkImportError } from '@/infrastructure/i18n/background-error'
import { t } from '@/infrastructure/i18n/t'
import { logger } from '@/infrastructure/logging/logger'
import {
  fetchBookmarkLibraryTree,
  fetchChromeBookmarkImportStatus,
  fetchColdStartStatus,
  fetchUserSettings,
  generateGettingStartedClueSamplesMessage,
  updateUserSettings
} from '@/infrastructure/messaging/background-client'
import { openRecallSidePanelFromExtensionPage } from '@/infrastructure/browser/side-panel'
import {
  readFirstRecallOpenDone,
  writeRecallPrefill
} from '@/infrastructure/storage/first-recall-onboarding-storage'
import {
  markInstallOnboardingDone,
  readSyncSuggestionDismissed,
  writeSyncSuggestionDismissed
} from '@/infrastructure/storage/install-onboarding-storage'
import AppButton from '@/infrastructure/ui/AppButton.vue'
import AppLinearProgress from '@/infrastructure/ui/AppLinearProgress.vue'
import { shouldShowChromeBookmarkSyncSuggestion } from '@/pages/getting-started/chrome-bookmark-sync-suggestion'
import {
  deriveGettingStartedProgress,
  isGettingStartedInventorySettling,
  shouldRefreshGettingStartedProgress,
  type GettingStartedLibraryPhase
} from '@/pages/getting-started/getting-started-progress'
import GettingStartedRecallPanel from '@/pages/getting-started/GettingStartedRecallPanel.vue'
import { useGettingStartedInPageRecall } from '@/pages/getting-started/use-getting-started-in-page-recall'

defineOptions({ name: 'GettingStartedBookmarksPanel' })

const props = withDefaults(
  defineProps<{
    /** 授权卡旁「不导入，继续」文案（仅 need_consent）。 */
    skipContinueLabel?: string
    skipContinueBusy?: boolean
  }>(),
  {
    skipContinueLabel: '',
    skipContinueBusy: false
  }
)

const emit = defineEmits<{
  /** 授权卡旁软出口：不导入并继续进产品 */
  'skip-continue': []
}>()

/** 书签一次性导入授权（与 settings.chromeBookmarkIngestEnabled 同步）。 */
const bookmarkConsent = ref(false)
const consentBusy = ref(false)
const consentError = ref('')
/** Try it 开壳失败时的可见提示 */
const trySidePanelError = ref('')
/** 持续同步开关（与 settings.chromeBookmarkSyncEnabled 同步）。 */
const bookmarkSyncEnabled = ref(false)
const syncSuggestionDismissed = ref(false)
const syncSuggestBusy = ref(false)
/** 未同意前不展示召回区。 */
const libraryPhase = ref<GettingStartedLibraryPhase>('ready')
const oralClues = ref<string[]>([])
const oralCluesGenerating = ref(false)
const importState = ref<ChromeBookmarkImportState | null>(null)

const consentDetailKeys = [
  'getting_started_consent_detail_what',
  'getting_started_consent_detail_local',
  'getting_started_consent_detail_onetime',
  'getting_started_consent_detail_control'
] as const

let inventoryPollTimer: ReturnType<typeof setInterval> | null = null
let oralCluesRequestId = 0
let lastOralCluesPhase: GettingStartedLibraryPhase | null = null

const sourceUnlocked = computed(() => bookmarkConsent.value)

const importPercent = computed(() => {
  if (!importState.value) {
    return undefined
  }
  if (!importState.value.totalCount || importState.value.totalCount <= 0) {
    return importState.value.status === 'completed' ? 1 : undefined
  }
  return getChromeBookmarkImportPercent(importState.value) / 100
})

/**
 * 授权卡 UI 阶段：征求 → 导入中 → 已授权 → 失败可重试。
 * 关灌库只能去 Settings，本页不做 toggle。
 */
/** 导入失败正文：有结构化 errorCode 则用诚实归因，否则 GS 通用兜底。 */
const consentFailedBody = computed(() => {
  const code = importState.value?.errorCode
  if (code) {
    return tChromeBookmarkImportError(code)
  }
  return t('getting_started_consent_failed_body')
})

const consentUiPhase = computed(() => {
  if (!bookmarkConsent.value) {
    return 'need_consent' as const
  }
  if (importState.value?.status === 'failed') {
    return 'failed' as const
  }
  if (
    libraryPhase.value === 'importing' ||
    importState.value?.status === 'running' ||
    importState.value?.status === 'pending'
  ) {
    return 'importing' as const
  }
  return 'authorized' as const
})

const showRecall = computed(
  () =>
    bookmarkConsent.value &&
    (consentUiPhase.value === 'authorized' || consentUiPhase.value === 'failed')
)

const showSyncSuggestion = computed(() =>
  shouldShowChromeBookmarkSyncSuggestion({
    importCompleted: importState.value?.status === 'completed',
    syncEnabled: bookmarkSyncEnabled.value,
    dismissed: syncSuggestionDismissed.value,
    libraryPhase: libraryPhase.value
  })
)

const importDetailLine = computed(() => {
  const state = importState.value
  if (!state) {
    return t('getting_started_consent_progress_indeterminate')
  }
  if (state.totalCount && state.totalCount > 0) {
    return t('getting_started_consent_progress_detail', [
      String(state.importedCount),
      String(state.totalCount)
    ])
  }
  if (state.status === 'completed') {
    return t('getting_started_consent_progress_detail', [
      String(state.importedCount),
      String(Math.max(state.importedCount, 1))
    ])
  }
  return t('getting_started_consent_progress_indeterminate')
})

const {
  clueDraft,
  recallBusy,
  recallError,
  primaryCard,
  secondaryCard,
  emptyKind,
  recallDone,
  syncRecallDoneFlag,
  clearResults,
  handleSubmitClue,
  handleOpenCard,
  handleFoundYes
} = useGettingStartedInPageRecall({
  libraryPhase,
  sourceUnlocked,
  logLabel: '书签'
})

async function loadConsentFromSettings(): Promise<void> {
  try {
    const response = await fetchUserSettings()
    if (response.ok) {
      bookmarkConsent.value = response.settings.chromeBookmarkIngestEnabled
      bookmarkSyncEnabled.value = response.settings.chromeBookmarkSyncEnabled
    }
  } catch (error) {
    logger.warn('Onboarding', '读取导入同意失败（保持关）', { error })
    bookmarkConsent.value = false
    bookmarkSyncEnabled.value = false
  }
}

/** 明示授权一次性导入（不碰 sync）。失败可再点重试。 */
async function handleAuthorize(): Promise<void> {
  if (consentBusy.value) {
    return
  }
  consentBusy.value = true
  consentError.value = ''
  try {
    const response = await updateUserSettings({ chromeBookmarkIngestEnabled: true })
    if (!response.ok) {
      consentError.value = t('getting_started_consent_failed')
      logger.warn('Onboarding', '写入导入同意失败', { errorCode: response.errorCode })
      return
    }
    bookmarkConsent.value = response.settings.chromeBookmarkIngestEnabled
    bookmarkSyncEnabled.value = response.settings.chromeBookmarkSyncEnabled
    logger.info('Onboarding', '书签导入已授权，开始一次性导入', { enabled: bookmarkConsent.value })
    if (bookmarkConsent.value) {
      libraryPhase.value = 'importing'
      void refreshInventory()
    }
  } catch (error) {
    consentError.value = t('getting_started_consent_failed')
    logger.warn('Onboarding', '写入导入同意异常', { error })
  } finally {
    consentBusy.value = false
  }
}

/** 开启持续同步建议。 */
async function handleEnableSyncSuggestion(): Promise<void> {
  if (syncSuggestBusy.value) {
    return
  }
  syncSuggestBusy.value = true
  try {
    const response = await updateUserSettings({ chromeBookmarkSyncEnabled: true })
    if (!response.ok) {
      logger.warn('Onboarding', '开启书签同步失败', { errorCode: response.errorCode })
      return
    }
    bookmarkSyncEnabled.value = response.settings.chromeBookmarkSyncEnabled
    bookmarkConsent.value = response.settings.chromeBookmarkIngestEnabled
    logger.info('Onboarding', 'GS 已开启书签同步', { enabled: bookmarkSyncEnabled.value })
  } catch (error) {
    logger.warn('Onboarding', '开启书签同步异常', { error })
  } finally {
    syncSuggestBusy.value = false
  }
}

/** 关掉同步建议卡（持久 dismissal）。 */
async function handleDismissSyncSuggestion(): Promise<void> {
  if (syncSuggestBusy.value) {
    return
  }
  syncSuggestBusy.value = true
  try {
    await writeSyncSuggestionDismissed()
    syncSuggestionDismissed.value = true
    logger.info('Onboarding', 'GS 书签同步建议已关掉')
  } catch (error) {
    logger.warn('Onboarding', '写入同步建议 dismissal 失败', { error })
  } finally {
    syncSuggestBusy.value = false
  }
}

async function refreshInventory(): Promise<void> {
  if (!bookmarkConsent.value) {
    oralClues.value = []
    oralCluesGenerating.value = false
    libraryPhase.value = 'ready'
    importState.value = null
    lastOralCluesPhase = null
    return
  }

  let bookmarkCount = 0
  let coldStartStatus: string | null = null
  let coldStartStage: string | null = null
  let importStatus: string | null = null

  try {
    const [treeRes, coldRes, importRes] = await Promise.all([
      fetchBookmarkLibraryTree(),
      fetchColdStartStatus(),
      fetchChromeBookmarkImportStatus()
    ])

    if (treeRes.ok) {
      bookmarkCount = treeRes.bookmarkCount
    }

    if (coldRes.ok && coldRes.state) {
      coldStartStatus = coldRes.state.status
      coldStartStage = coldRes.state.stage
      if (bookmarkCount === 0 && typeof coldRes.state.importImportedCount === 'number') {
        bookmarkCount = Math.max(bookmarkCount, coldRes.state.importImportedCount)
      }
    }

    if (importRes.ok) {
      importState.value = importRes.state
      if (importRes.state) {
        importStatus = importRes.state.status
        if (bookmarkCount === 0) {
          bookmarkCount = Math.max(bookmarkCount, importRes.state.importedCount)
        }
      }
    }
  } catch (error) {
    logger.warn('Onboarding', '书签库存探测失败（保持上一帧）', { error })
  }

  const firstRecallOpenDone = await readFirstRecallOpenDone()
  const progress = deriveGettingStartedProgress({
    bookmarkCount,
    firstRecallOpenDone,
    inventorySettling: isGettingStartedInventorySettling({
      coldStartStatus,
      coldStartStage,
      importStatus
    })
  })
  recallDone.value = progress.recallDone
  libraryPhase.value = progress.libraryPhase

  if (progress.libraryPhase === 'ready') {
    void loadOralCluesIfNeeded()
  } else {
    oralClues.value = []
    oralCluesGenerating.value = false
    lastOralCluesPhase = progress.libraryPhase
  }
}

/** 库 ready 后请求一次示意 clue（session 缓存命中则不烧配额）。 */
async function loadOralCluesIfNeeded(): Promise<void> {
  if (oralCluesGenerating.value) {
    return
  }
  if (lastOralCluesPhase === 'ready' && oralClues.value.length > 0) {
    return
  }
  lastOralCluesPhase = 'ready'
  const requestId = ++oralCluesRequestId
  oralCluesGenerating.value = true
  try {
    const response = await generateGettingStartedClueSamplesMessage({
      fallbackClue: t('getting_started_sample_clue_fallback')
    })
    if (requestId !== oralCluesRequestId) {
      return
    }
    if (response.ok && response.clues.length > 0) {
      oralClues.value = response.clues
      logger.info('Onboarding', 'GS 示意 clue 已就绪', {
        origin: response.origin,
        fromCache: response.fromCache,
        clueCount: response.clues.length
      })
    } else {
      oralClues.value = []
      logger.warn('Onboarding', 'GS 示意 clue 无结果', {
        ok: response.ok,
        errorCode: response.ok ? null : response.errorCode
      })
    }
  } catch (error) {
    if (requestId === oralCluesRequestId) {
      oralClues.value = []
    }
    logger.warn('Onboarding', 'GS 示意 clue 请求异常', { error })
  } finally {
    if (requestId === oralCluesRequestId) {
      oralCluesGenerating.value = false
    }
  }
}

async function handleTrySidePanel(clue: string): Promise<void> {
  const trimmed = clue.trim()
  if (!trimmed) {
    return
  }
  trySidePanelError.value = ''
  try {
    // 先落引导完成标记，再开火开壳+写预填（storage 写毫秒级，仍在手势窗口内）
    await markInstallOnboardingDone()
    const opening = openRecallSidePanelFromExtensionPage()
    await writeRecallPrefill(trimmed)
    await opening
    logger.info('Onboarding', 'GS Try it 已开 Side Panel 并预填', {
      cluePreview: trimmed.slice(0, 48)
    })
    window.close()
  } catch (error) {
    logger.warn('Onboarding', 'GS Try it 开壳失败', { error })
    trySidePanelError.value = t('getting_started_open_side_panel_failed')
  }
}

function handleStorageChanged(
  changes: Record<string, chrome.storage.StorageChange>,
  areaName: string
): void {
  if (!shouldRefreshGettingStartedProgress(changes, areaName)) {
    return
  }
  if (bookmarkConsent.value) {
    void refreshInventory()
  } else {
    void syncRecallDoneFlag()
  }
}

function handleDocumentVisibilityChange(): void {
  if (document.visibilityState === 'visible' && bookmarkConsent.value) {
    void refreshInventory()
  }
}

function handleUiPushMessage(message: unknown): void {
  if (!parseChromeBookmarkTreeChangedMessage(message)) {
    return
  }
  if (bookmarkConsent.value) {
    void refreshInventory()
  }
}

function startInventoryPolling(): void {
  stopInventoryPolling()
  inventoryPollTimer = setInterval(() => {
    if (!bookmarkConsent.value) {
      return
    }
    if (consentUiPhase.value === 'importing' || libraryPhase.value === 'importing') {
      void refreshInventory()
    }
  }, 800)
}

function stopInventoryPolling(): void {
  if (inventoryPollTimer !== null) {
    clearInterval(inventoryPollTimer)
    inventoryPollTimer = null
  }
}

onMounted(() => {
  void (async () => {
    syncSuggestionDismissed.value = await readSyncSuggestionDismissed()
    await loadConsentFromSettings()
    await syncRecallDoneFlag()
    if (bookmarkConsent.value) {
      await refreshInventory()
    } else {
      clearResults()
    }
  })()
  startInventoryPolling()
  chrome.storage.onChanged.addListener(handleStorageChanged)
  chrome.runtime.onMessage.addListener(handleUiPushMessage)
  document.addEventListener('visibilitychange', handleDocumentVisibilityChange)
})

onUnmounted(() => {
  stopInventoryPolling()
  chrome.storage.onChanged.removeListener(handleStorageChanged)
  chrome.runtime.onMessage.removeListener(handleUiPushMessage)
  document.removeEventListener('visibilitychange', handleDocumentVisibilityChange)
})
</script>

<template>
  <div class="gs-bookmarks">
    <section class="gs-bookmarks__consent" :aria-label="t('getting_started_consent_aria')">
      <template v-if="consentUiPhase === 'need_consent'">
        <div class="gs-bookmarks__consent-copy">
          <h2 class="gs-bookmarks__consent-title">{{ t('getting_started_consent_title') }}</h2>
          <p class="gs-bookmarks__consent-body">{{ t('getting_started_consent_body') }}</p>
          <ul class="gs-bookmarks__consent-details">
            <li v-for="key in consentDetailKeys" :key="key">{{ t(key) }}</li>
          </ul>
          <p v-if="consentError" class="gs-bookmarks__consent-error" role="alert">
            {{ consentError }}
          </p>
          <div class="gs-bookmarks__consent-actions">
            <AppButton
              type="button"
              variant="filled"
              class="gs-bookmarks__consent-cta"
              :disabled="consentBusy || props.skipContinueBusy"
              @click="handleAuthorize"
            >
              {{ t('getting_started_consent_cta') }}
            </AppButton>
            <AppButton
              v-if="props.skipContinueLabel"
              type="button"
              variant="text"
              class="gs-bookmarks__consent-skip"
              :disabled="consentBusy || props.skipContinueBusy"
              @click="emit('skip-continue')"
            >
              {{ props.skipContinueLabel }}
            </AppButton>
          </div>
        </div>
      </template>

      <template v-else-if="consentUiPhase === 'importing'">
        <div class="gs-bookmarks__consent-copy" role="status" aria-live="polite">
          <h2 class="gs-bookmarks__consent-title">
            {{ t('getting_started_consent_importing_title') }}
          </h2>
          <p class="gs-bookmarks__consent-body">
            {{ t('getting_started_consent_importing_body') }}
          </p>
          <p class="gs-bookmarks__consent-detail">{{ importDetailLine }}</p>
          <AppLinearProgress
            v-if="importPercent === undefined"
            class="gs-bookmarks__consent-bar"
            :aria-label="t('getting_started_consent_progress_aria')"
          />
          <AppLinearProgress
            v-else
            class="gs-bookmarks__consent-bar"
            :value="importPercent"
            :aria-label="t('getting_started_consent_progress_aria')"
          />
        </div>
      </template>

      <template v-else-if="consentUiPhase === 'failed'">
        <div class="gs-bookmarks__consent-copy">
          <h2 class="gs-bookmarks__consent-title">
            {{ t('getting_started_consent_failed_title') }}
          </h2>
          <p class="gs-bookmarks__consent-body">{{ consentFailedBody }}</p>
          <AppButton
            type="button"
            variant="tonal"
            class="gs-bookmarks__consent-cta"
            :disabled="consentBusy"
            @click="handleAuthorize"
          >
            {{ t('getting_started_consent_retry') }}
          </AppButton>
        </div>
      </template>

      <template v-else>
        <div class="gs-bookmarks__consent-copy">
          <h2 class="gs-bookmarks__consent-title">
            {{ t('getting_started_consent_authorized_title') }}
          </h2>
          <p class="gs-bookmarks__consent-body">
            {{ t('getting_started_consent_authorized_body') }}
          </p>
        </div>
      </template>
    </section>

    <section
      v-if="showSyncSuggestion"
      class="gs-bookmarks__sync-suggest"
      :aria-label="t('getting_started_sync_suggest_title')"
    >
      <div class="gs-bookmarks__consent-copy">
        <h2 class="gs-bookmarks__consent-title">{{ t('getting_started_sync_suggest_title') }}</h2>
        <p class="gs-bookmarks__consent-body">{{ t('getting_started_sync_suggest_body') }}</p>
        <div class="gs-bookmarks__sync-suggest-actions">
          <AppButton
            type="button"
            variant="filled"
            :disabled="syncSuggestBusy"
            @click="handleEnableSyncSuggestion"
          >
            {{ t('getting_started_sync_suggest_enable') }}
          </AppButton>
          <AppButton
            type="button"
            variant="text"
            :disabled="syncSuggestBusy"
            @click="handleDismissSyncSuggestion"
          >
            {{ t('getting_started_sync_suggest_dismiss') }}
          </AppButton>
        </div>
      </div>
    </section>

    <div v-if="showRecall" class="gs-bookmarks__recall">
      <GettingStartedRecallPanel
        v-model:clue="clueDraft"
        clue-input-id="gs-recall-clue-bookmarks"
        :section-aria-label="t('getting_started_recall_card_aria')"
        :library-phase="libraryPhase"
        :suggestions="[]"
        :oral-clues="oralClues"
        :oral-clues-generating="oralCluesGenerating"
        :busy="recallBusy"
        :error="recallError"
        :primary-card="primaryCard"
        :secondary-card="secondaryCard"
        :recall-done="recallDone"
        :empty-kind="emptyKind"
        @submit="handleSubmitClue"
        @open-card="handleOpenCard"
        @found-yes="handleFoundYes"
        @try-side-panel="handleTrySidePanel"
      />
      <p v-if="trySidePanelError" class="gs-bookmarks__consent-error" role="alert">
        {{ trySidePanelError }}
      </p>
    </div>
  </div>
</template>

<style scoped>
.gs-bookmarks {
  display: grid;
  gap: var(--space-lg);
}

.gs-bookmarks__consent {
  padding: var(--space-md);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: var(--surface-white);
}

.gs-bookmarks__consent-copy {
  display: grid;
  gap: var(--space-sm);
  min-width: 0;
  justify-items: start;
}

.gs-bookmarks__consent-title {
  margin: 0;
  font-size: var(--text-body);
  font-weight: var(--font-weight-semibold);
  line-height: var(--leading-snug);
}

.gs-bookmarks__consent-body,
.gs-bookmarks__consent-detail {
  margin: 0;
  font-size: var(--text-meta);
  line-height: var(--leading-relaxed);
  color: var(--on-surface-muted);
  text-wrap: pretty;
}

.gs-bookmarks__consent-details {
  display: grid;
  gap: var(--space-2xs);
  margin: 0;
  padding-left: 1.15em;
  font-size: var(--text-meta);
  line-height: var(--leading-relaxed);
  color: var(--on-surface-muted);
  text-wrap: pretty;
}

.gs-bookmarks__sync-suggest {
  padding: var(--space-md);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: var(--surface-white);
}

.gs-bookmarks__sync-suggest-actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-sm);
  margin-top: var(--space-2xs);
}

.gs-bookmarks__consent-error {
  margin: 0;
  font-size: var(--text-meta);
  line-height: var(--leading-relaxed);
  color: var(--danger);
}

.gs-bookmarks__consent-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-sm);
  margin-top: var(--space-2xs);
}

.gs-bookmarks__consent-cta,
.gs-bookmarks__consent-skip {
  margin: 0;
}

.gs-bookmarks__consent-bar {
  width: 100%;
  max-width: 100%;
  margin-top: var(--space-2xs);
}

.gs-bookmarks__recall {
  margin: 0;
}
</style>
