<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'

import { openRecallSidePanelFromExtensionPage } from '@/infrastructure/browser/side-panel'
import { t } from '@/infrastructure/i18n/t'
import { logger } from '@/infrastructure/logging/logger'
import { listMemoryItems } from '@/infrastructure/messaging/background-client'
import {
  readExcerptCaptureCount,
  writeRecallPrefill
} from '@/infrastructure/storage/first-recall-onboarding-storage'
import { markInstallOnboardingDone } from '@/infrastructure/storage/install-onboarding-storage'
import { openGettingStartedRecallShell } from '@/pages/getting-started/getting-started-actions'
import {
  deriveGettingStartedExcerptPhase,
  shouldRefreshGettingStartedProgress,
  type GettingStartedLibraryPhase
} from '@/pages/getting-started/getting-started-progress'
import GettingStartedPassage from '@/pages/getting-started/GettingStartedPassage.vue'
import GettingStartedRecallPanel from '@/pages/getting-started/GettingStartedRecallPanel.vue'
import { useGettingStartedInPageRecall } from '@/pages/getting-started/use-getting-started-in-page-recall'

defineOptions({ name: 'GettingStartedExcerptsPanel' })

const libraryPhase = ref<GettingStartedLibraryPhase>('empty')
/** Try it 开壳失败时的可见提示 */
const trySidePanelError = ref('')
/** 定稿示意 clue（Things we miss · 意义/感觉印象，非细节拼盘） */
const oralClues = computed(() => [t('getting_started_sample_clue')])
const sourceUnlocked = computed(() => true)

let pollTimer: ReturnType<typeof setInterval> | null = null

const {
  clueDraft,
  recallBusy,
  recallError,
  primaryCard,
  secondaryCard,
  emptyKind,
  recallDone,
  syncRecallDoneFlag,
  handleSubmitClue,
  handleOpenCard,
  handleFoundYes
} = useGettingStartedInPageRecall({
  libraryPhase,
  sourceUnlocked,
  logLabel: '摘录'
})

async function refreshExcerpts(): Promise<void> {
  let excerptCount = 0

  try {
    const [listRes, count] = await Promise.all([
      listMemoryItems({ type: 'text_excerpt', limit: 1 }),
      readExcerptCaptureCount()
    ])
    excerptCount = count
    if (listRes.ok && 'items' in listRes) {
      excerptCount = Math.max(excerptCount, listRes.total, listRes.items.length)
    }
  } catch (error) {
    logger.warn('Onboarding', '摘录库存探测失败（保持上一帧）', { error })
  }

  libraryPhase.value = deriveGettingStartedExcerptPhase(excerptCount)
  await syncRecallDoneFlag()
}

/** Try it：预填定稿 clue → 开 Side Panel → 结束引导（与书签 tab 同出口）。 */
async function handleTrySidePanel(clue: string): Promise<void> {
  const trimmed = clue.trim()
  if (!trimmed) {
    return
  }
  trySidePanelError.value = ''
  try {
    // 先开火开壳，再落 done + 预填（禁止先 await storage 丢手势）
    await openGettingStartedRecallShell({
      openShell: () => openRecallSidePanelFromExtensionPage(),
      markDone: () => markInstallOnboardingDone(),
      writePrefill: () => writeRecallPrefill(trimmed)
    })
    logger.info('Onboarding', 'GS 摘录 Try it 已开 Side Panel 并预填', {
      cluePreview: trimmed.slice(0, 48)
    })
    window.close()
  } catch (error) {
    logger.warn('Onboarding', 'GS 摘录 Try it 开壳失败', { error })
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
  void refreshExcerpts()
}

function handleDocumentVisibilityChange(): void {
  if (document.visibilityState === 'visible') {
    void refreshExcerpts()
  }
}

onMounted(() => {
  void refreshExcerpts()
  chrome.storage.onChanged.addListener(handleStorageChanged)
  document.addEventListener('visibilitychange', handleDocumentVisibilityChange)
  pollTimer = setInterval(() => {
    if (libraryPhase.value === 'empty') {
      void refreshExcerpts()
    }
  }, 2000)
})

onUnmounted(() => {
  chrome.storage.onChanged.removeListener(handleStorageChanged)
  document.removeEventListener('visibilitychange', handleDocumentVisibilityChange)
  if (pollTimer !== null) {
    clearInterval(pollTimer)
    pollTimer = null
  }
})
</script>

<template>
  <div class="gs-excerpts">
    <GettingStartedPassage v-if="libraryPhase === 'empty'" />

    <template v-else>
      <GettingStartedRecallPanel
        v-model:clue="clueDraft"
        clue-input-id="gs-recall-clue-excerpts"
        :section-aria-label="t('getting_started_excerpt_recall_aria')"
        :library-phase="libraryPhase"
        :suggestions="[]"
        :oral-clues="oralClues"
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
      <p v-if="trySidePanelError" class="gs-excerpts__error" role="alert">
        {{ trySidePanelError }}
      </p>
    </template>
  </div>
</template>

<style scoped>
.gs-excerpts {
  display: grid;
  gap: var(--space-md);
}

.gs-excerpts__error {
  margin: 0;
  font-size: var(--text-meta);
  line-height: var(--leading-relaxed);
  color: var(--danger);
}
</style>
