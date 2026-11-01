<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'

import {
  getChromeBookmarkImportPercent,
  type ChromeBookmarkImportState
} from '@/core/memory/chrome-bookmark-import-state'
import { parseChromeBookmarkTreeChangedMessage } from '@/core/messaging/ui-messages'
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
import { markInstallOnboardingDone } from '@/infrastructure/storage/install-onboarding-storage'
import AppButton from '@/infrastructure/ui/AppButton.vue'
import AppLinearProgress from '@/infrastructure/ui/AppLinearProgress.vue'
import {
  deriveGettingStartedProgress,
  isGettingStartedInventorySettling,
  shouldRefreshGettingStartedProgress,
  type GettingStartedLibraryPhase
} from '@/pages/getting-started/getting-started-progress'
import GettingStartedRecallPanel from '@/pages/getting-started/GettingStartedRecallPanel.vue'
import { useGettingStartedInPageRecall } from '@/pages/getting-started/use-getting-started-in-page-recall'

defineOptions({ name: 'GettingStartedBookmarksPanel' })

/** 书签灌库产品同意（与 settings.chromeBookmarkIngestEnabled 同步）。 */
const bookmarkConsent = ref(false)
const consentBusy = ref(false)
const consentError = ref('')
/** 未同意前不展示召回区。 */
const libraryPhase = ref<GettingStartedLibraryPhase>('ready')
const oralClues = ref<string[]>([])
const oralCluesGenerating = ref(false)
const importState = ref<ChromeBookmarkImportState | null>(null)

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
    }
  } catch (error) {
    logger.warn('Onboarding', '读取灌库同意失败（保持关）', { error })
    bookmarkConsent.value = false
  }
}

/** 明示授权并启动灌库（Settings 开同键会 ensureChromeBookmarksImported）。失败可再点重试。 */
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
      logger.warn('Onboarding', '写入灌库同意失败', { errorCode: response.errorCode })
      return
    }
    bookmarkConsent.value = response.settings.chromeBookmarkIngestEnabled
    logger.info('Onboarding', '书签灌库已授权，开始导入', { enabled: bookmarkConsent.value })
    if (bookmarkConsent.value) {
      libraryPhase.value = 'importing'
      void refreshInventory()
    }
  } catch (error) {
    consentError.value = t('getting_started_consent_failed')
    logger.warn('Onboarding', '写入灌库同意异常', { error })
  } finally {
    consentBusy.value = false
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
  try {
    // 先开火开壳再写预填（保扩展页用户手势）；开壳失败则不 mark，引导可重试
    const opening = openRecallSidePanelFromExtensionPage()
    await writeRecallPrefill(trimmed)
    await opening
    await markInstallOnboardingDone()
    logger.info('Onboarding', 'GS Try it 已开 Side Panel 并预填', {
      cluePreview: trimmed.slice(0, 48)
    })
    window.close()
  } catch (error) {
    logger.warn('Onboarding', 'GS Try it 开壳失败', { error })
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
          <p class="gs-bookmarks__frame">{{ t('getting_started_bookmarks_frame') }}</p>
          <h2 class="gs-bookmarks__consent-title">{{ t('getting_started_consent_title') }}</h2>
          <p class="gs-bookmarks__consent-body">{{ t('getting_started_consent_body') }}</p>
          <p v-if="consentError" class="gs-bookmarks__consent-error" role="alert">
            {{ consentError }}
          </p>
          <AppButton
            type="button"
            variant="filled"
            class="gs-bookmarks__consent-cta"
            :disabled="consentBusy"
            @click="handleAuthorize"
          >
            {{ t('getting_started_consent_cta') }}
          </AppButton>
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
          <p class="gs-bookmarks__consent-body">{{ t('getting_started_consent_failed_body') }}</p>
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

    <div v-if="showRecall" class="gs-bookmarks__recall">
      <GettingStartedRecallPanel
        v-model:clue="clueDraft"
        clue-input-id="gs-recall-clue-bookmarks"
        :section-aria-label="t('getting_started_recall_card_aria')"
        :library-phase="libraryPhase"
        :suggestions="[]"
        :oral-clues="oralClues"
        :oral-clues-generating="oralCluesGenerating"
        :show-composer="false"
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

.gs-bookmarks__frame {
  margin: 0;
  font-size: 13px;
  font-weight: 500;
  line-height: 1.4;
  color: var(--on-surface-muted);
}

.gs-bookmarks__consent-title {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  line-height: 1.35;
}

.gs-bookmarks__consent-body,
.gs-bookmarks__consent-detail {
  margin: 0;
  font-size: 13px;
  line-height: 1.5;
  color: var(--on-surface-muted);
  text-wrap: pretty;
}

.gs-bookmarks__consent-error {
  margin: 0;
  font-size: 13px;
  line-height: 1.45;
  color: var(--danger);
}

.gs-bookmarks__consent-cta {
  margin-top: var(--space-2xs);
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
