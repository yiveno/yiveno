<script setup lang="ts">
import { computed } from 'vue'

import { openExtensionLibraryPage } from '@/infrastructure/browser/library-page'
import { openExtensionOptionsPage } from '@/infrastructure/browser/options-page'

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
    emit('navigateError', '无法打开记忆库')
  }
}

async function handleOpenSettings() {
  try {
    await openExtensionOptionsPage()
  } catch {
    emit('navigateError', '无法打开设置页')
  }
}
</script>

<template>
  <div class="app-page-header">
    <p class="app-page-header__brand">Yiveno</p>
    <nav v-if="showLibrary || showSettings" class="app-page-header__nav" aria-label="页面导航">
      <md-text-button v-if="showLibrary" type="button" @click="handleOpenLibrary">
        记忆库
      </md-text-button>
      <md-text-button v-if="showSettings" type="button" @click="handleOpenSettings">
        设置
      </md-text-button>
    </nav>
  </div>
</template>

<style scoped>
.app-page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
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
  gap: 2px;
  align-items: center;
}
</style>
