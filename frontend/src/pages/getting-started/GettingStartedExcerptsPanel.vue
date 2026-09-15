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
  try {
    await writeRecallPrefill(trimmed)
    await markInstallOnboardingDone()
    await openRecallSidePanelFromExtensionPage()
    logger.info('Onboarding', 'GS 摘录 Try it 已开 Side Panel 并预填', {
      cluePreview: trimmed.slice(0, 48)
    })
    window.close()
  } catch (error) {
    logger.warn('Onboarding', 'GS 摘录 Try it 开壳失败', { error })
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
    <template v-if="libraryPhase === 'empty'">
      <div class="gs-excerpts__empty">
        <p class="gs-excerpts__frame">{{ t('getting_started_excerpt_frame') }}</p>
        <h2 class="gs-excerpts__empty-title">{{ t('getting_started_excerpt_empty_title') }}</h2>
        <p class="gs-excerpts__empty-body">{{ t('getting_started_excerpt_empty_body') }}</p>
      </div>
      <GettingStartedPassage />
    </template>

    <GettingStartedRecallPanel
      v-else
      v-model:clue="clueDraft"
      clue-input-id="gs-recall-clue-excerpts"
      :section-aria-label="t('getting_started_excerpt_recall_aria')"
      :library-phase="libraryPhase"
      :suggestions="[]"
      :oral-clues="oralClues"
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
</template>

<style scoped>
.gs-excerpts {
  display: grid;
  gap: var(--space-lg);
}

.gs-excerpts__empty {
  display: grid;
  gap: var(--space-2xs);
}

.gs-excerpts__frame {
  margin: 0;
  font-size: 13px;
  font-weight: 500;
  line-height: 1.4;
  color: var(--on-surface-muted);
}

.gs-excerpts__empty-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  line-height: 1.35;
}

.gs-excerpts__empty-body {
  margin: 0;
  max-width: 42ch;
  font-size: 14px;
  line-height: 1.5;
  color: var(--on-surface-muted);
}
</style>
