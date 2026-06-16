<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { LucideIcon } from '@/components'
import type { ChromeExtensionMessage } from '@/types/chrome-messages'
import { t } from '@/utils/i18n-helpers'
import { STATE_KEYS } from '@/infrastructure/state/extension-state'
import { logger } from '@/infrastructure/logging/logger'

interface Step {
  id: string
  titleKey: string
  subtitleKey?: string
  descriptionKey: string
  visual: 'hero' | 'sync' | 'filter' | 'omnibox' | 'complete'
  showAction?: boolean
}

const steps: Step[] = [
  {
    id: 'welcome',
    titleKey: 'onboarding_welcome_title',
    subtitleKey: 'onboarding_welcome_subtitle',
    descriptionKey: 'onboarding_welcome_description',
    visual: 'hero',
    showAction: true
  },
  {
    id: 'performance',
    titleKey: 'onboarding_performance_title',
    subtitleKey: 'onboarding_performance_subtitle',
    descriptionKey: 'onboarding_performance_description',
    visual: 'hero',
    showAction: true
  },
  {
    id: 'ai-powered',
    titleKey: 'onboarding_ai_title',
    subtitleKey: 'onboarding_ai_subtitle',
    descriptionKey: 'onboarding_ai_description',
    visual: 'filter',
    showAction: true
  },
  {
    id: 'omnibox',
    titleKey: 'onboarding_omnibox_title',
    subtitleKey: 'onboarding_omnibox_subtitle',
    descriptionKey: 'onboarding_omnibox_description',
    visual: 'omnibox',
    showAction: true
  },
  {
    id: 'privacy',
    titleKey: 'onboarding_privacy_title',
    subtitleKey: 'onboarding_privacy_subtitle',
    descriptionKey: 'onboarding_privacy_description',
    visual: 'sync',
    showAction: true
  },
  {
    id: 'ready',
    titleKey: 'onboarding_ready_title',
    subtitleKey: 'onboarding_ready_subtitle',
    descriptionKey: 'onboarding_ready_description',
    visual: 'complete',
    showAction: true
  }
]

const currentStepIndex = ref(0)
const progress = ref(0)
const progressMessage = ref(t('onboarding_initializing'))
const isSyncing = ref(true)
const isCompleted = ref(false)

const fallbackStep: Step = steps[0]!

const currentStep = computed<Step>(() => steps[currentStepIndex.value] ?? fallbackStep)
const isLast = computed(() => currentStepIndex.value === steps.length - 1)

function nextStep() {
  if (currentStepIndex.value < steps.length - 1) {
    currentStepIndex.value++
  } else {
    if (typeof window !== 'undefined') {
      window.close()
    }
  }
}

const messageListener = (message: ChromeExtensionMessage) => {
  if (message.type === 'ottersage-sync-progress') {
    progress.value = message.data.percentage
    progressMessage.value = message.data.message

    if (message.data.phase === 'completed') {
      completeSync()
    }
  } else if (message.type === 'ottersage-db-ready') {
    completeSync()
  }
}

function completeSync() {
  if (!isCompleted.value) {
    isSyncing.value = false
    isCompleted.value = true
    progress.value = 100
    progressMessage.value = t('onboarding_ready')
  }
}

onMounted(() => {
  // 检查 Chrome API 是否可用
  if (typeof chrome !== 'undefined' && chrome.runtime) {
    chrome.runtime.onMessage.addListener(messageListener)

    if (chrome.storage?.local) {
      chrome.storage.local.get([STATE_KEYS.INITIALIZED], result => {
        if (result[STATE_KEYS.INITIALIZED]) {
          completeSync()
        }
      })
    }
  } else {
    // 非扩展环境：模拟开发/演示模式
    logger.warn('Onboarding', 'Env', 'Chrome Extension APIs not available. Running in demo mode.')
    // 模拟进度
    let currentProgress = 0
    const interval = setInterval(() => {
      currentProgress += 10
      progress.value = currentProgress
      progressMessage.value = t('onboarding_processing', String(currentProgress))

      if (currentProgress >= 100) {
        clearInterval(interval)
        completeSync()
      }
    }, 300)
  }
})

onUnmounted(() => {
  if (typeof chrome !== 'undefined' && chrome.runtime) {
    chrome.runtime.onMessage.removeListener(messageListener)
  }
})
</script>

<template>
  <div class="onboarding-container">
    <!-- Header -->
    <header class="onboarding-header">
      <div class="logo-container">
        <img src="/logo.webp" alt="otterSage Logo" class="logo-icon" />
        <span class="logo-text">otterSage</span>
      </div>
    </header>

    <!-- Main Content -->
    <main class="onboarding-main">
      <Transition name="v-step" mode="out-in">
        <div :key="currentStep.id" class="step-content">
          <!-- Visual Area -->
          <div class="visual-area">
            <!-- Hero Visual -->
            <div v-if="currentStep.visual === 'hero'" class="visual-hero">
              <div class="hero-glow"></div>
              <div class="hero-icon">
                <img src="/logo.webp" alt="otterSage" class="hero-logo" />
              </div>
            </div>

            <!-- Sync Progress -->
            <div v-else-if="currentStep.visual === 'sync'" class="visual-sync">
              <div class="progress-circle">
                <svg class="progress-ring" viewBox="0 0 120 120">
                  <circle class="progress-ring__background" cx="60" cy="60" r="54" />
                  <circle
                    class="progress-ring__progress"
                    cx="60"
                    cy="60"
                    r="54"
                    :style="{ strokeDashoffset: 339.29 * (1 - progress / 100) }"
                  />
                </svg>
                <div class="progress-text">
                  <div class="progress-percentage">{{ Math.round(progress) }}%</div>
                  <div class="progress-label">{{ t('onboarding_synced') }}</div>
                </div>
              </div>
              <div class="sync-status">
                <span :class="['status-dot', { 'status-dot--active': isSyncing }]"></span>
                <span class="status-message">{{ progressMessage }}</span>
              </div>
            </div>

            <!-- Filter Mockup -->
            <div v-else-if="currentStep.visual === 'filter'" class="visual-filter">
              <div class="filter-box">
                <LucideIcon name="search" size="sm" />
                <span class="filter-placeholder">"design resources"</span>
              </div>
              <div class="filter-results">
                <div class="result-item">
                  <div class="result-icon" style="background: var(--color-primary-100)">
                    <span style="color: var(--color-primary)">F</span>
                  </div>
                  <div class="result-content">
                    <div class="result-title"></div>
                    <div class="result-url"></div>
                  </div>
                </div>
                <div class="result-item">
                  <div class="result-icon" style="background: var(--color-warning-container)">
                    <span style="color: var(--color-warning)">D</span>
                  </div>
                  <div class="result-content">
                    <div class="result-title" style="width: 60%"></div>
                    <div class="result-url" style="width: 45%"></div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Omnibox Visual -->
            <div v-else-if="currentStep.visual === 'omnibox'" class="visual-omnibox">
              <div class="omnibox-bar">
                <div class="omnibox-icon">
                  <LucideIcon name="search" size="sm" />
                </div>
                <div class="omnibox-input">
                  <span class="omnibox-keyword">os</span>
                  <span class="omnibox-query">设计资源</span>
                </div>
              </div>
              <div class="omnibox-results">
                <div class="omnibox-result omnibox-result--active">
                  <LucideIcon name="bookmark" size="sm" />
                  <div class="omnibox-result-text">
                    <div class="omnibox-result-title">Figma Design Resources</div>
                    <div class="omnibox-result-url">figma.com/resources</div>
                  </div>
                </div>
                <div class="omnibox-result">
                  <LucideIcon name="bookmark" size="sm" />
                  <div class="omnibox-result-text">
                    <div class="omnibox-result-title">Design Systems Database</div>
                    <div class="omnibox-result-url">designsystems.com</div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Complete Visual -->
            <div
              v-else-if="currentStep.visual === 'complete'"
              class="visual-complete md-appear-scale"
            >
              <div class="complete-icon">
                <LucideIcon name="check" size="xl" />
              </div>
            </div>
          </div>

          <!-- Text Content -->
          <div class="text-content">
            <div v-if="currentStep.subtitleKey" class="step-label">
              {{ t(currentStep.subtitleKey) }}
            </div>
            <h1 class="step-title">{{ t(currentStep.titleKey) }}</h1>
            <p class="step-description">{{ t(currentStep.descriptionKey) }}</p>

            <div v-if="currentStep.showAction" class="action-area">
              <button type="button" class="action-button" @click="nextStep">
                {{ isLast ? t('onboarding_get_started') : t('onboarding_next') }}
                <LucideIcon name="arrow-right" size="sm" />
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </main>

    <!-- Footer Navigation -->
    <footer class="onboarding-footer">
      <div class="progress-dots">
        <button
          v-for="(_, idx) in steps"
          :key="idx"
          type="button"
          :class="['dot', { 'dot--active': currentStepIndex === idx }]"
          :aria-label="`跳转到第 ${idx + 1} 步`"
          :aria-current="currentStepIndex === idx ? 'step' : undefined"
          @click="currentStepIndex = idx"
        ></button>
      </div>
    </footer>
  </div>
</template>

<style scoped>
/* Responsive */
@media (width <= 768px) {
  .onboarding-header,
  .onboarding-footer {
    padding: var(--space-4) var(--space-6);
  }

  .onboarding-main {
    padding: var(--space-6);
  }

  .step-title {
    font-size: var(--md-sys-typescale-display-small-size); /* 36px */
  }

  .step-description {
    font-size: var(--md-sys-typescale-body-large-size); /* 16px */
  }
}

.onboarding-container {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  font-family: var(--font-sans);
  color: var(--color-text-primary);
  background: var(--color-background);
  overflow: hidden;
}

/* Header */
.onboarding-header {
  position: relative;
  z-index: 10;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-6) var(--space-8);
}

.logo-container {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.logo-icon {
  width: 32px;
  height: 32px;
  object-fit: contain;
}

.logo-text {
  font-size: var(--md-sys-typescale-title-medium-size); /* 16px */
  font-weight: 700;
  letter-spacing: -0.02em;
}

/* Main Content */
.onboarding-main {
  position: relative;
  display: flex;
  flex: 1;
  justify-content: center;
  align-items: center;
  padding: var(--space-8);
}

.step-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-10);
  width: 100%;
  max-width: 800px;
  text-align: center;
}

/* Visual Area */
.visual-area {
  position: relative;
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
  max-width: 400px;
  min-height: 300px;
}

/* Hero Visual */
.visual-hero {
  position: relative;
  display: flex;
  justify-content: center;
  align-items: center;
}

.hero-glow {
  position: absolute;
  width: 300px;
  height: 300px;
  border-radius: 50%;
  background: radial-gradient(circle, var(--color-primary-alpha-20) 0%, transparent 70%);
  filter: blur(40px);
}

.hero-icon {
  position: relative;
  display: flex;
  justify-content: center;
  align-items: center;
  width: 120px;
  height: 120px;
  transform: rotate(3deg);
}

.hero-logo {
  width: 80px;
  height: 80px;
  object-fit: contain;
}

/* Sync Visual */
.visual-sync {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-6);
}

.progress-circle {
  position: relative;
  width: 160px;
  height: 160px;
}

.progress-ring {
  width: 100%;
  height: 100%;
  transform: rotate(-90deg);
}

.progress-ring__background {
  fill: none;
  stroke: var(--color-surface-container-high);
  stroke-width: 8;
}

.progress-ring__progress {
  fill: none;
  stroke: var(--color-primary);
  stroke-width: 8;
  stroke-linecap: round;
  stroke-dasharray: 339.29;
  transition: stroke-dashoffset 0.5s ease;
}

.progress-text {
  position: absolute;
  top: 50%;
  left: 50%;
  text-align: center;
  transform: translate(-50%, -50%);
}

.progress-percentage {
  margin-bottom: var(--space-1);
  font-size: var(--md-sys-typescale-display-small-size); /* 36px */
  font-weight: 700;
  line-height: 1;
}

.progress-label {
  font-size: var(--md-sys-typescale-label-medium-size); /* 12px */
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--color-text-secondary);
}

.sync-status {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-full);
  background: var(--color-surface-container);
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--color-success);
}

.status-dot--active {
  background: var(--color-primary);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-primary) 25%, transparent);
}

.status-message {
  font-size: var(--md-sys-typescale-body-medium-size); /* 14px */
  font-weight: 500;
  color: var(--color-text-secondary);
}

/* Filter Visual */
.visual-filter {
  width: 100%;
  padding: var(--space-8);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
  background: var(--color-surface-container);
}

.filter-box {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  margin-bottom: var(--space-6);
  padding: var(--space-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  box-shadow: 0 2px 8px var(--color-shadow-005);
}

.filter-placeholder {
  font-size: var(--md-sys-typescale-body-large-size); /* 16px */
  color: var(--color-text-secondary);
}

.filter-results {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.result-item {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-3);
  border-radius: var(--radius-base);
  background: var(--color-surface);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.result-item:hover {
  background: var(--color-surface-hover);
}

.result-icon {
  display: flex;
  flex-shrink: 0;
  justify-content: center;
  align-items: center;
  width: 40px;
  height: 40px;
  border-radius: var(--radius-base);
  font-weight: 700;
}

.result-content {
  display: flex;
  flex-direction: column;
  flex: 1;
  gap: var(--space-2);
}

.result-title {
  width: 40%;
  height: 12px;
  border-radius: var(--radius-sm);
  background: var(--color-text-primary);
}

.result-url {
  width: 60%;
  height: 8px;
  border-radius: var(--radius-sm);
  background: var(--color-text-tertiary);
}

/* Omnibox Visual */
.visual-omnibox {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  width: 100%;
  max-width: 520px;
}

.omnibox-bar {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  border: 2px solid var(--color-primary);
  border-radius: var(--radius-full);
  background: var(--color-surface);
  box-shadow: 0 8px 24px var(--color-primary-alpha-20);
}

.omnibox-icon {
  display: flex;
  align-items: center;
  color: var(--color-text-secondary);
}

.omnibox-input {
  display: flex;
  flex: 1;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--md-sys-typescale-body-large-size); /* 16px */
}

.omnibox-keyword {
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-sm);
  font-weight: var(--font-semibold);
  color: var(--color-primary);
  background: var(--color-primary-container);
}

.omnibox-query {
  color: var(--color-text-primary);
}

.omnibox-results {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-2);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  box-shadow: 0 8px 16px var(--color-shadow-md);
}

.omnibox-result {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3);
  border-radius: var(--radius-base);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.omnibox-result:hover {
  background: var(--color-surface-hover);
}

.omnibox-result--active {
  background: var(--color-primary-container);
}

.omnibox-result-text {
  flex: 1;
  min-width: 0;
}

.omnibox-result-title {
  font-size: var(--md-sys-typescale-body-medium-size); /* 14px */
  font-weight: 500;
  white-space: nowrap;
  color: var(--color-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
}

.omnibox-result-url {
  font-size: var(--md-sys-typescale-body-small-size); /* 12px */
  white-space: nowrap;
  color: var(--color-text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Complete Visual */
.visual-complete {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 120px;
  height: 120px;
  border-radius: 50%;
  color: var(--color-on-success);
  background: var(--color-success);
  box-shadow: 0 20px 60px var(--color-success-alpha-10);
}

/* Text Content */
.text-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-4);
}

.step-label {
  font-size: var(--md-sys-typescale-label-large-size); /* 14px */
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--color-primary);
}

.step-title {
  max-width: 600px;
  margin: 0;
  font-size: var(--md-sys-typescale-display-small-size); /* 36px */
  font-weight: 700;
  line-height: 1.2;
  letter-spacing: -0.02em;
}

.step-description {
  max-width: 500px;
  margin: 0;
  font-size: var(--md-sys-typescale-title-medium-size); /* 16px */
  line-height: 1.6;
  color: var(--color-text-secondary);
}

.action-area {
  margin-top: var(--space-4);
}

.action-button {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-4) var(--space-8);
  border: none;
  border-radius: var(--radius-full);
  font-size: var(--md-sys-typescale-label-large-size); /* 14px */
  font-weight: 600;
  color: var(--color-primary-foreground);
  background: var(--color-primary);
  cursor: pointer;
  transition:
    background-color var(--transition-fast),
    box-shadow var(--transition-fast);
  box-shadow: 0 4px 12px var(--color-primary-alpha-20);
}

.action-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.action-button:hover:not(:disabled) {
  background: var(--color-primary-hover);
  box-shadow: 0 6px 20px var(--color-primary-alpha-20);
}

.action-button:active:not(:disabled) {
  box-shadow: 0 2px 8px var(--color-primary-alpha-20);
}

/* Footer */
.onboarding-footer {
  position: relative;
  z-index: 10;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: var(--space-6) var(--space-8);
}

.progress-dots {
  display: flex;
  gap: var(--space-3);
}

.dot {
  width: 8px;
  height: 8px;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: var(--color-surface-container-high);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.dot--active {
  width: 32px;
  border-radius: var(--radius-full);
  background: var(--color-primary);
}

/* Container */
</style>
