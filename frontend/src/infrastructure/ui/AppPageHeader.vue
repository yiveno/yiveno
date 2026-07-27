<script setup lang="ts">
import { computed } from 'vue'

import { openExtensionLibraryPage } from '@/infrastructure/browser/library-page'
import { openExtensionOptionsPage } from '@/infrastructure/browser/options-page'
import { t } from '@/infrastructure/i18n/t'
import MaterialSymbolIcon from '@/infrastructure/ui/icons/MaterialSymbolIcon.vue'

defineOptions({ name: 'AppPageHeader' })

const props = withDefaults(
  defineProps<{
    /** 当前页面对应导航项；该入口不展示，避免自跳。 */
    current?: 'library' | 'settings' | 'none'
  }>(),
  {
    current: 'none'
  }
)

const emit = defineEmits<{
  /** 打开记忆库或设置失败时通知父级。 */
  navigateError: [message: string]
}>()

const showLibrary = computed(() => props.current !== 'library')
const showSettings = computed(() => props.current !== 'settings')

function handleOpenLibrary() {
  try {
    openExtensionLibraryPage()
  } catch {
    emit('navigateError', t('error_open_library'))
  }
}

async function handleOpenSettings() {
  try {
    await openExtensionOptionsPage()
  } catch {
    emit('navigateError', t('error_open_settings'))
  }
}
</script>

<template>
  <div class="app-page-header">
    <p class="app-page-header__brand">{{ t('app_name') }}</p>
    <nav
      v-if="showLibrary || showSettings"
      class="app-page-header__nav"
      :aria-label="t('nav_aria_label')"
    >
      <md-icon-button
        v-if="showLibrary"
        type="button"
        :title="t('nav_library')"
        :aria-label="t('nav_library')"
        @click="handleOpenLibrary"
      >
        <MaterialSymbolIcon name="library_books" size="22px" />
      </md-icon-button>
      <md-icon-button
        v-if="showSettings"
        type="button"
        :title="t('nav_settings')"
        :aria-label="t('nav_settings')"
        @click="handleOpenSettings"
      >
        <MaterialSymbolIcon name="settings" size="22px" />
      </md-icon-button>
    </nav>
  </div>
</template>

<style scoped>
.app-page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-width: 0;
  max-width: 100%;
}

.app-page-header__brand {
  margin: 0;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--md-sys-color-on-surface-variant);
}

.app-page-header__nav {
  display: flex;
  flex-wrap: wrap;
  gap: 0;
  align-items: center;
}
</style>
