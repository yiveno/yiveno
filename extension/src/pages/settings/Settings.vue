<script setup lang="ts">
import { provide } from 'vue'
import AppPageHeader from '@/infrastructure/ui/AppPageHeader.vue'
import AppSectionTabs from '@/infrastructure/ui/AppSectionTabs.vue'
import AppToastHost from '@/infrastructure/ui/AppToastHost.vue'
import SettingsPageDialogs from '@/pages/settings/SettingsPageDialogs.vue'
import SettingsSectionPanels from '@/pages/settings/SettingsSectionPanels.vue'
import { useSettingsPage } from '@/pages/settings/use-settings-page'
import { t } from '@/infrastructure/i18n/t'

defineOptions({ name: 'SettingsPage' })

const page = useSettingsPage()
provide('settingsPage', page)

const {
  activeSection,
  settingsSectionTabItems,
  settingsPanelId,
  settingsSectionTabsId,
  settingsActiveTabId,
  activeSectionLabel
} = page
</script>

<template>
  <AppToastHost />
  <main class="settings-shell">
    <header class="settings-header">
      <AppPageHeader current="settings" class="settings-header-top" />
      <h1 class="settings-title">{{ t('settings_title') }}</h1>
      <p class="settings-subtitle">{{ t('settings_subtitle') }}</p>
    </header>

    <div class="settings-layout">
      <AppSectionTabs
        v-model="activeSection"
        class="settings-section-tabs"
        :items="settingsSectionTabItems"
        :ariaLabel="t('settings_tabs_aria')"
        :panel-id="settingsPanelId"
        :id-prefix="settingsSectionTabsId"
      />

      <section
        :id="settingsPanelId"
        class="settings-panel surface-panel-white"
        role="tabpanel"
        :aria-labelledby="settingsActiveTabId"
        :aria-label="activeSectionLabel"
        tabindex="0"
      >
        <SettingsSectionPanels />
      </section>
    </div>

    <SettingsPageDialogs />
  </main>
</template>

<style scoped>
.settings-shell {
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  max-width: 960px;
  height: 100%;
  margin: 0 auto;
  padding: var(--page-shell-padding-top) var(--page-shell-padding-x)
    var(--page-shell-padding-bottom-compact);
  color: var(--on-surface);
  overflow: hidden;
}

.settings-header {
  flex-shrink: 0;
  margin-bottom: var(--space-lg);
}

.settings-header-top {
  margin-bottom: var(--space-2xs);
}

.settings-title {
  margin: 0 0 var(--space-xs);
  font-size: 28px;
  line-height: 1.2;
}

.settings-subtitle {
  margin: 0;
  font-size: 14px;
  line-height: 1.5;
  color: var(--on-surface-muted);
}

.settings-layout {
  display: grid;
  flex: 1;
  align-items: stretch;
  gap: var(--space-lg);
  grid-template-columns: 160px minmax(0, 1fr);
  min-height: 0;
}

.settings-section-tabs {
  align-self: start;
}

.settings-panel {
  min-width: 0;
  min-height: 0;
  overflow: hidden auto;
}

@media (width <= 640px) {
  .settings-layout {
    grid-template-columns: 1fr;
    grid-template-rows: auto minmax(0, 1fr);
  }
}
</style>

<style>
/* 本页独立入口：锁死视口，避免整页滚动条；仅右侧面板滚动 */
html,
body,
#app {
  height: 100%;
  overflow: hidden;
}
</style>
