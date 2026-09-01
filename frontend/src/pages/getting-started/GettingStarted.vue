<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import AppButton from '@/infrastructure/ui/AppButton.vue'

import { buildRecallPrefillClue } from '@/core/recall/build-prefill-clue'
import { captureTextExcerpt, openRecallShell } from '@/infrastructure/messaging/background-client'
import { t } from '@/infrastructure/i18n/t'
import {
  markGettingStartedRecallShellOpened,
  readExcerptCaptureCount,
  readFirstRecallOpenDone,
  readGettingStartedRecallShellOpened,
  writeRecallPrefill
} from '@/infrastructure/storage/first-recall-onboarding-storage'
import { markInstallOnboardingDone } from '@/infrastructure/storage/install-onboarding-storage'
import AppPageHeader from '@/infrastructure/ui/AppPageHeader.vue'
import AppIcon from '@/infrastructure/ui/icons/AppIcon.vue'
import {
  canSaveGettingStartedDemo,
  canTryGettingStartedRecall,
  type GettingStartedSaveState
} from '@/pages/getting-started/getting-started-actions'
import {
  deriveGettingStartedProgress,
  shouldRefreshGettingStartedProgress
} from '@/pages/getting-started/getting-started-progress'

defineOptions({ name: 'GettingStartedPage' })

type SaveState = GettingStartedSaveState

const saveState = ref<SaveState>('idle')
const captureDone = ref(false)
const recallDone = ref(false)
const skipBusy = ref(false)
const recallBusy = ref(false)
const recallError = ref('')

const demoContextBefore = computed(() => t('getting_started_demo_context_before'))
const demoLine = computed(() => t('getting_started_demo_line'))
const demoContextAfter = computed(() => t('getting_started_demo_context_after'))

const allDone = computed(() => captureDone.value && recallDone.value)

async function refreshProgress(): Promise<void> {
  const [captureCount, firstRecallOpenDone, gettingStartedRecallShellOpened] = await Promise.all([
    readExcerptCaptureCount(),
    readFirstRecallOpenDone(),
    readGettingStartedRecallShellOpened()
  ])
  const progress = deriveGettingStartedProgress({
    excerptCaptureCount: captureCount,
    firstRecallOpenDone,
    gettingStartedRecallShellOpened
  })
  captureDone.value = progress.captureDone
  recallDone.value = progress.recallDone
}

async function handleSaveDemoLine(): Promise<void> {
  if (!canSaveGettingStartedDemo({ saveState: saveState.value, captureDone: captureDone.value })) {
    return
  }

  saveState.value = 'saving'

  try {
    const response = await captureTextExcerpt({
      selectedText: demoLine.value,
      sourceUrl: window.location.href,
      pageTitle: document.title,
      contextBefore: demoContextBefore.value,
      contextAfter: demoContextAfter.value,
      captureEntry: 'getting_started'
    })

    if (!response.ok) {
      saveState.value = 'error'
      return
    }

    saveState.value = 'saved'
    captureDone.value = true

    const prefill = buildRecallPrefillClue(demoLine.value)
    if (prefill) {
      await writeRecallPrefill(prefill)
    }
  } catch {
    saveState.value = 'error'
  }
}

async function handleTryRecall(): Promise<void> {
  if (
    !canTryGettingStartedRecall({
      recallBusy: recallBusy.value,
      captureDone: captureDone.value,
      recallDone: recallDone.value
    })
  ) {
    return
  }

  recallBusy.value = true
  recallError.value = ''

  try {
    const prefill = buildRecallPrefillClue(demoLine.value)
    if (prefill) {
      await writeRecallPrefill(prefill)
    }
    const response = await openRecallShell()
    if (!response.ok) {
      recallError.value = t('selection_toolbar_open_recall_failed')
      return
    }
    await markGettingStartedRecallShellOpened()
    recallDone.value = true
  } catch {
    recallError.value = t('selection_toolbar_open_recall_failed')
  } finally {
    recallBusy.value = false
  }
}

async function handleSkip(): Promise<void> {
  if (skipBusy.value) {
    return
  }
  skipBusy.value = true
  try {
    await markInstallOnboardingDone()
  } finally {
    skipBusy.value = false
  }
}

function handleStorageChanged(
  changes: Record<string, chrome.storage.StorageChange>,
  areaName: string
): void {
  if (!shouldRefreshGettingStartedProgress(changes, areaName)) {
    return
  }
  void refreshProgress()
}

function handleDocumentVisibilityChange(): void {
  if (document.visibilityState === 'visible') {
    void refreshProgress()
  }
}

onMounted(() => {
  void refreshProgress()
  chrome.storage.onChanged.addListener(handleStorageChanged)
  document.addEventListener('visibilitychange', handleDocumentVisibilityChange)
})

onUnmounted(() => {
  chrome.storage.onChanged.removeListener(handleStorageChanged)
  document.removeEventListener('visibilitychange', handleDocumentVisibilityChange)
})
</script>

<template>
  <main class="getting-started">
    <AppPageHeader class="getting-started__header" />

    <section class="getting-started__hero">
      <h1 class="getting-started__title">{{ t('getting_started_hero_title') }}</h1>
      <p class="getting-started__lead">{{ t('getting_started_hero_body') }}</p>
    </section>

    <ol class="getting-started__steps" :aria-label="t('getting_started_steps_aria')">
      <li class="getting-started__step" :class="{ 'getting-started__step--done': captureDone }">
        <div class="getting-started__step-head">
          <AppIcon
            class="getting-started__step-icon"
            :name="captureDone ? 'check_circle' : 'looks_one'"
            size="20px"
          />
          <h2 class="getting-started__step-title">{{ t('getting_started_step_capture_title') }}</h2>
        </div>
        <p class="getting-started__step-copy">{{ t('getting_started_step_capture_body') }}</p>
      </li>

      <li
        class="getting-started__step"
        :class="{
          'getting-started__step--active': captureDone && !recallDone,
          'getting-started__step--done': recallDone
        }"
      >
        <div class="getting-started__step-head">
          <AppIcon
            class="getting-started__step-icon"
            :name="recallDone ? 'check_circle' : 'looks_two'"
            size="20px"
          />
          <h2 class="getting-started__step-title">{{ t('getting_started_step_recall_title') }}</h2>
        </div>
        <p class="getting-started__step-copy">{{ t('getting_started_step_recall_body') }}</p>
        <p v-if="captureDone && !recallDone" class="getting-started__recall-hint">
          {{ t('getting_started_recall_hint') }}
        </p>
        <div v-if="captureDone && !recallDone" class="getting-started__recall-actions">
          <AppButton type="button" :disabled="recallBusy" @click="handleTryRecall" variant="filled">
            {{ t('selection_toolbar_try_recall') }}
          </AppButton>
          <p v-if="recallError" class="getting-started__recall-error" role="alert">
            {{ recallError }}
          </p>
        </div>
      </li>
    </ol>

    <section v-if="allDone" class="getting-started__success" aria-live="polite">
      <AppIcon name="celebration" size="28px" />
      <div>
        <h2 class="getting-started__success-title">{{ t('getting_started_recall_done_title') }}</h2>
        <p class="getting-started__success-copy">{{ t('getting_started_recall_done_body') }}</p>
      </div>
    </section>

    <section v-else class="getting-started__demo" :aria-label="t('getting_started_demo_aria')">
      <p class="getting-started__demo-text">
        {{ demoContextBefore }}
        <mark class="getting-started__demo-mark">{{ demoLine }}</mark>
        {{ demoContextAfter }}
      </p>

      <div class="getting-started__demo-actions">
        <p v-if="!captureDone" class="getting-started__demo-hint">
          {{ t('getting_started_demo_save_hint') }}
        </p>
        <p v-else class="getting-started__demo-done" role="status">
          {{ t('getting_started_capture_done_hint') }}
        </p>
        <AppButton
          v-if="!captureDone"
          type="button"
          :disabled="saveState === 'saving'"
          @click="handleSaveDemoLine"
          variant="text"
        >
          {{
            saveState === 'saving'
              ? t('getting_started_saving')
              : t('getting_started_save_demo_fallback')
          }}
        </AppButton>
        <p v-if="saveState === 'error'" class="getting-started__error" role="alert">
          {{ t('getting_started_save_failed') }}
        </p>
      </div>
    </section>

    <footer class="getting-started__footer">
      <AppButton type="button" :disabled="skipBusy" @click="handleSkip" variant="text">
        {{ t('getting_started_skip') }}
      </AppButton>
    </footer>
  </main>
</template>

<style scoped>
.getting-started {
  box-sizing: border-box;
  max-width: 720px;
  margin: 0 auto;
  padding: var(--space-lg) var(--space-lg) var(--page-shell-padding-bottom);
  color: var(--on-surface);
  background: var(--surface);
}

.getting-started__header {
  margin-bottom: var(--space-lg);
}

.getting-started__hero {
  display: grid;
  gap: var(--space-sm);
  margin-bottom: var(--page-shell-padding-top);
}

.getting-started__title {
  margin: 0;
  font-size: clamp(28px, 4vw, 36px);
  font-weight: 700;
  line-height: 1.15;
  letter-spacing: -0.02em;
}

.getting-started__lead {
  margin: 0;
  max-width: 42ch;
  font-size: 16px;
  line-height: 1.55;
  color: var(--on-surface-muted);
}

.getting-started__steps {
  display: grid;
  gap: var(--space-md);
  margin: 0 0 var(--space-lg);
  padding: 0;
  list-style: none;
}

.getting-started__step {
  padding: var(--space-md);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: var(--surface-white);
  content-visibility: auto;
  contain-intrinsic-size: auto 120px;
}

.getting-started__step--active {
  border-color: var(--accent);
  background: var(--surface-raised);
}

.getting-started__step--done {
  border-color: color-mix(in srgb, var(--accent) 35%, var(--border));
}

.getting-started__step-head {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  margin-bottom: var(--space-xs);
}

.getting-started__step-icon {
  color: var(--accent);
}

.getting-started__step-title {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
}

.getting-started__step-copy,
.getting-started__recall-hint {
  margin: 0;
  font-size: 14px;
  line-height: 1.5;
  color: var(--on-surface-muted);
}

.getting-started__recall-hint {
  margin-top: var(--space-sm);
  padding: var(--space-sm);
  border-radius: var(--radius-sm);
  background: var(--surface-chrome);
  color: var(--on-surface);
}

.getting-started__recall-actions {
  display: grid;
  gap: var(--space-xs);
  justify-items: start;
  margin-top: var(--space-sm);
}

.getting-started__recall-error {
  margin: 0;
  font-size: 13px;
  color: var(--danger);
}

.getting-started__demo {
  display: grid;
  gap: var(--space-md);
  padding: var(--space-md);
  border: 1px solid var(--border);
  border-radius: var(--radius-xl);
  background: var(--surface-white);
}

.getting-started__demo-text {
  margin: 0;
  font-size: 18px;
  line-height: 1.65;
  text-wrap: pretty;
}

.getting-started__demo-mark {
  padding: 0 2px;
  border-radius: var(--radius-xs);
  background: color-mix(in srgb, var(--accent) 18%, transparent);
  color: inherit;
}

.getting-started__demo-actions {
  display: grid;
  gap: var(--space-xs);
  justify-items: start;
}

.getting-started__demo-hint,
.getting-started__demo-done {
  margin: 0;
  font-size: 14px;
  line-height: 1.5;
  color: var(--on-surface-muted);
}

.getting-started__demo-done {
  color: var(--accent);
  font-weight: 600;
}

.getting-started__error {
  margin: 0;
  font-size: 13px;
  color: var(--danger);
}

.getting-started__success {
  display: flex;
  gap: var(--space-sm);
  align-items: flex-start;
  padding: var(--space-md);
  border: 1px solid color-mix(in srgb, var(--accent) 35%, var(--border));
  border-radius: var(--radius-xl);
  background: var(--surface-raised);
}

.getting-started__success-title {
  margin: 0 0 var(--space-xs);
  font-size: 18px;
  font-weight: 600;
}

.getting-started__success-copy {
  margin: 0;
  font-size: 14px;
  line-height: 1.5;
  color: var(--on-surface-muted);
}

.getting-started__footer {
  display: flex;
  justify-content: flex-end;
  margin-top: var(--space-lg);
}
</style>
