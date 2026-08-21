<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'

import { buildRecallPrefillClue } from '@/core/recall/build-prefill-clue'
import { captureTextExcerpt, openRecallShell } from '@/infrastructure/messaging/background-client'
import { t } from '@/infrastructure/i18n/t'
import {
  EXCERPT_CAPTURE_COUNT_LOCAL_KEY,
  FIRST_RECALL_OPEN_DONE_LOCAL_KEY,
  readExcerptCaptureCount,
  readFirstRecallOpenDone,
  writeRecallPrefill
} from '@/infrastructure/storage/first-recall-onboarding-storage'
import { markInstallOnboardingDone } from '@/infrastructure/storage/install-onboarding-storage'
import AppPageHeader from '@/infrastructure/ui/AppPageHeader.vue'
import MaterialSymbolIcon from '@/infrastructure/ui/icons/MaterialSymbolIcon.vue'

defineOptions({ name: 'GettingStartedPage' })

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

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
  const [captureCount, firstRecallOpenDone] = await Promise.all([
    readExcerptCaptureCount(),
    readFirstRecallOpenDone()
  ])
  captureDone.value = captureCount > 0
  recallDone.value = firstRecallOpenDone
}

async function handleSaveDemoLine(): Promise<void> {
  if (saveState.value === 'saving' || captureDone.value) {
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
  if (recallBusy.value || !captureDone.value || recallDone.value) {
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
    }
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
  if (areaName !== 'local') {
    return
  }
  if (EXCERPT_CAPTURE_COUNT_LOCAL_KEY in changes || FIRST_RECALL_OPEN_DONE_LOCAL_KEY in changes) {
    void refreshProgress()
  }
}

onMounted(() => {
  void refreshProgress()
  chrome.storage.onChanged.addListener(handleStorageChanged)
})

onUnmounted(() => {
  chrome.storage.onChanged.removeListener(handleStorageChanged)
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
          <MaterialSymbolIcon
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
          <MaterialSymbolIcon
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
          <md-filled-button type="button" :disabled="recallBusy" @click="handleTryRecall">
            {{ t('selection_toolbar_try_recall') }}
          </md-filled-button>
          <p v-if="recallError" class="getting-started__recall-error" role="alert">
            {{ recallError }}
          </p>
        </div>
      </li>
    </ol>

    <section v-if="allDone" class="getting-started__success" aria-live="polite">
      <MaterialSymbolIcon name="celebration" size="28px" />
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
        <md-text-button
          v-if="!captureDone"
          type="button"
          :disabled="saveState === 'saving'"
          @click="handleSaveDemoLine"
        >
          {{
            saveState === 'saving'
              ? t('getting_started_saving')
              : t('getting_started_save_demo_fallback')
          }}
        </md-text-button>
        <p v-if="saveState === 'error'" class="getting-started__error" role="alert">
          {{ t('getting_started_save_failed') }}
        </p>
      </div>
    </section>

    <footer class="getting-started__footer">
      <md-text-button type="button" :disabled="skipBusy" @click="handleSkip">
        {{ t('getting_started_skip') }}
      </md-text-button>
    </footer>
  </main>
</template>

<style scoped>
.getting-started {
  box-sizing: border-box;
  max-width: 720px;
  margin: 0 auto;
  padding: 24px 24px 40px;
  color: var(--on-surface);
  background: var(--surface);
}

.getting-started__header {
  margin-bottom: 20px;
}

.getting-started__hero {
  display: grid;
  gap: 10px;
  margin-bottom: 28px;
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
  gap: 16px;
  margin: 0 0 24px;
  padding: 0;
  list-style: none;
}

.getting-started__step {
  padding: 14px 16px;
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: var(--surface-white);
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
  gap: 8px;
  margin-bottom: 6px;
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
  margin-top: 10px;
  padding: 10px 12px;
  border-radius: var(--radius-sm);
  background: var(--surface-chrome);
  color: var(--on-surface);
}

.getting-started__recall-actions {
  display: grid;
  gap: 8px;
  justify-items: start;
  margin-top: 10px;
}

.getting-started__recall-error {
  margin: 0;
  font-size: 13px;
  color: var(--danger);
}

.getting-started__demo {
  display: grid;
  gap: 16px;
  padding: 18px 18px 20px;
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
  border-radius: 4px;
  background: color-mix(in srgb, var(--accent) 18%, transparent);
  color: inherit;
}

.getting-started__demo-actions {
  display: grid;
  gap: 8px;
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
  gap: 12px;
  align-items: flex-start;
  padding: 16px 18px;
  border: 1px solid color-mix(in srgb, var(--accent) 35%, var(--border));
  border-radius: var(--radius-xl);
  background: var(--surface-raised);
}

.getting-started__success-title {
  margin: 0 0 6px;
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
  margin-top: 20px;
}
</style>
