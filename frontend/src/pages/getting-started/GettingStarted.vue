<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, useId } from 'vue'

import { openRecallSidePanelFromExtensionPage } from '@/infrastructure/browser/side-panel'
import { t } from '@/infrastructure/i18n/t'
import { logger } from '@/infrastructure/logging/logger'
import { fetchUserSettings } from '@/infrastructure/messaging/background-client'
import { readExcerptCaptureCount } from '@/infrastructure/storage/first-recall-onboarding-storage'
import { markInstallOnboardingDone } from '@/infrastructure/storage/install-onboarding-storage'
import AppButton from '@/infrastructure/ui/AppButton.vue'
import AppSectionTabs from '@/infrastructure/ui/AppSectionTabs.vue'
import type { AppSectionTabItem } from '@/infrastructure/ui/AppSectionTabs.vue'
import GettingStartedBookmarksPanel from '@/pages/getting-started/GettingStartedBookmarksPanel.vue'
import GettingStartedExcerptsPanel from '@/pages/getting-started/GettingStartedExcerptsPanel.vue'
import { shouldRefreshGettingStartedProgress } from '@/pages/getting-started/getting-started-progress'
import {
  DEFAULT_GETTING_STARTED_TAB,
  type GettingStartedTabId
} from '@/pages/getting-started/getting-started-tabs'

defineOptions({ name: 'GettingStartedPage' })

const activeTab = ref<GettingStartedTabId>(DEFAULT_GETTING_STARTED_TAB)
/** 已授权书签灌库或已有摘录 → 强出口文案；否则弱出口 */
const hasLibrarySeed = ref(false)
const continueBusy = ref(false)

const sectionTabsId = useId()
const panelId = `${sectionTabsId}-panel`
const activeTabButtonId = computed(() => `${sectionTabsId}-tab-${activeTab.value}`)

const tabItems = computed<AppSectionTabItem[]>(() => [
  { id: 'bookmarks', label: t('getting_started_tab_bookmarks') },
  { id: 'excerpts', label: t('getting_started_tab_excerpts') }
])

const continueLabel = computed(() =>
  hasLibrarySeed.value ? t('getting_started_continue') : t('getting_started_continue_without')
)

function onTabUpdate(id: string): void {
  if (id === 'bookmarks' || id === 'excerpts') {
    activeTab.value = id
  }
}

async function refreshContinueState(): Promise<void> {
  try {
    const [settingsRes, excerptCount] = await Promise.all([
      fetchUserSettings(),
      readExcerptCaptureCount()
    ])
    const bookmarksOn = settingsRes.ok ? settingsRes.settings.chromeBookmarkIngestEnabled : false
    hasLibrarySeed.value = bookmarksOn || excerptCount > 0
  } catch (error) {
    logger.warn('Onboarding', 'GS Continue 状态探测失败（保持上一帧）', { error })
  }
}

/** 软出口：结束引导并开 Side Panel（不挡未导入用户）。 */
async function handleContinue(): Promise<void> {
  if (continueBusy.value) {
    return
  }
  continueBusy.value = true
  try {
    await openRecallSidePanelFromExtensionPage()
    await markInstallOnboardingDone()
    logger.info('Onboarding', 'GS Continue 已开 Side Panel', {
      hasLibrarySeed: hasLibrarySeed.value
    })
    window.close()
  } catch (error) {
    logger.warn('Onboarding', 'GS Continue 开壳失败', { error })
  } finally {
    continueBusy.value = false
  }
}

function handleStorageChanged(
  changes: Record<string, chrome.storage.StorageChange>,
  areaName: string
): void {
  if (!shouldRefreshGettingStartedProgress(changes, areaName)) {
    return
  }
  void refreshContinueState()
}

onMounted(() => {
  void refreshContinueState()
  chrome.storage.onChanged.addListener(handleStorageChanged)
})

onUnmounted(() => {
  chrome.storage.onChanged.removeListener(handleStorageChanged)
})
</script>

<template>
  <main class="getting-started">
    <header class="getting-started__header">
      <p class="getting-started__eyebrow">{{ t('getting_started_eyebrow') }}</p>
      <h1 class="getting-started__title">{{ t('getting_started_hero_title') }}</h1>
      <p class="getting-started__lead">{{ t('getting_started_hero_body') }}</p>
    </header>

    <div class="getting-started__layout">
      <AppSectionTabs
        :model-value="activeTab"
        class="getting-started__tabs"
        layout="top"
        :items="tabItems"
        :ariaLabel="t('getting_started_tabs_aria')"
        :panel-id="panelId"
        :id-prefix="sectionTabsId"
        @update:model-value="onTabUpdate"
      />

      <section
        :id="panelId"
        class="getting-started__panel"
        role="tabpanel"
        :aria-labelledby="activeTabButtonId"
        tabindex="0"
      >
        <GettingStartedBookmarksPanel v-if="activeTab === 'bookmarks'" />
        <GettingStartedExcerptsPanel v-else />
      </section>
    </div>

    <footer class="getting-started__footer">
      <AppButton
        type="button"
        :variant="hasLibrarySeed ? 'tonal' : 'text'"
        class="getting-started__continue"
        :disabled="continueBusy"
        @click="handleContinue"
      >
        {{ continueLabel }}
      </AppButton>
    </footer>
  </main>
</template>

<style scoped>
.getting-started {
  box-sizing: border-box;
  max-width: 640px;
  margin: 0 auto;
  padding: var(--space-lg) var(--space-lg) var(--page-shell-padding-bottom);
  color: var(--on-surface);
  background: var(--surface);
}

.getting-started__header {
  display: grid;
  gap: var(--space-xs);
  margin-bottom: var(--space-md);
}

.getting-started__eyebrow {
  margin: 0;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: color-mix(in srgb, var(--on-surface-muted) 85%, transparent);
}

.getting-started__title {
  margin: 0;
  font-size: clamp(28px, 4.5vw, 36px);
  font-weight: 700;
  line-height: 1.15;
  letter-spacing: -0.02em;
}

.getting-started__lead {
  max-width: 42ch;
  margin: 0;
  font-size: 16px;
  line-height: 1.55;
  color: var(--on-surface-muted);
}

.getting-started__layout {
  display: grid;
  gap: var(--space-md);
}

/* GS 页内减弱 Tab 选中重量：上下文切换，不是大按钮 */
.getting-started__tabs {
  width: 100%;
}

.getting-started__tabs :deep(.app-section-tabs) {
  padding: var(--space-2xs);
  background: color-mix(in srgb, var(--surface-raised) 70%, transparent);
}

.getting-started__tabs :deep(.app-section-tabs__tab) {
  padding: var(--space-2xs) var(--space-sm);
  font-size: 13px;
  font-weight: 500;
}

.getting-started__tabs :deep(.app-section-tabs__tab--active) {
  font-weight: 600;
  background: color-mix(in srgb, var(--on-surface) 8%, transparent);
}

.getting-started__tabs :deep(.app-section-tabs__tab--active:hover) {
  background: color-mix(in srgb, var(--on-surface) 10%, transparent);
}

.getting-started__panel {
  min-width: 0;
}

.getting-started__panel:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 2px;
}

.getting-started__footer {
  display: flex;
  justify-content: center;
  margin-top: var(--space-xl);
  padding-top: var(--space-md);
}

.getting-started__continue {
  min-width: 12rem;
}
</style>
