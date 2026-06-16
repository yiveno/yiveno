<script setup lang="ts">
import { t } from '@/infrastructure'
import {
  COLOR_PRESET_DEFINITIONS,
  type ColorPresetDefinition,
  type ColorPresetId
} from '@ottersage/design-tokens/color-presets'
import { computed, onMounted, ref } from 'vue'
import { logger } from '@/infrastructure/logging/logger'
import { globalStateManager } from '@/infrastructure/global-state/global-state-manager'

defineOptions({
  name: 'ColorPresetSettings'
})

const presets = COLOR_PRESET_DEFINITIONS

const currentPreset = ref<ColorPresetId>('default')
const busy = ref(false)

/**
 * 中文界面展示 `vibeZh` 辅助说明；其他语言仅展示英文名避免硬编码中文副文案。
 */
const showVibeZh = computed(() => {
  if (typeof chrome === 'undefined' || !chrome.i18n) return false
  const lang = chrome.i18n.getUILanguage()
  return lang === 'zh-CN' || lang === 'zh_TW' || lang.startsWith('zh')
})

/**
 * 根据浏览器 UI 语言在中文名与英文名之间切换展示标题。
 */
function presetDisplayName(def: ColorPresetDefinition): string {
  if (typeof chrome !== 'undefined' && chrome.i18n) {
    const lang = chrome.i18n.getUILanguage()
    if (lang === 'zh-CN' || lang === 'zh_TW' || lang.startsWith('zh')) {
      return def.nameZh
    }
  }
  return def.nameEn
}

onMounted(async () => {
  try {
    await globalStateManager.initialize()
    currentPreset.value = globalStateManager.getColorPreset()
  } catch (error) {
    logger.error('ColorPresetSettings', '加载配色预设失败', error)
  }
})

/**
 * 用户选择配色预设：写入 chrome.storage 并由全局状态广播 DOM 更新。
 */
function selectPreset(id: ColorPresetId) {
  if (id === currentPreset.value || busy.value) return
  busy.value = true
  void globalStateManager
    .setColorPreset(id)
    .then(() => {
      currentPreset.value = globalStateManager.getColorPreset()
      logger.info('ColorPresetSettings', '配色预设已切换', { preset: id })
    })
    .catch(error => {
      logger.error('ColorPresetSettings', '保存配色预设失败', error)
    })
    .finally(() => {
      busy.value = false
    })
}
</script>

<template>
  <div>
    <p class="intro">{{ t('settings_color_presets_intro') }}</p>

    <div class="preset-grid" role="radiogroup" :aria-label="t('settings_color_presets_title')">
      <button
        v-for="def in presets"
        :key="def.id"
        type="button"
        class="preset-card"
        role="radio"
        :aria-checked="currentPreset === def.id"
        :disabled="busy"
        :class="{ 'preset-card--selected': currentPreset === def.id }"
        @click="selectPreset(def.id)"
      >
        <span
          class="preset-card__swatch"
          :style="{ backgroundColor: def.seedHex }"
          aria-hidden="true"
        />
        <span class="preset-card__name">{{ presetDisplayName(def) }}</span>
        <span v-if="showVibeZh" class="preset-card__vibe">{{ def.vibeZh }}</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.intro {
  max-width: 42rem;
  margin: 0 0 var(--spacing-5) 0;
  font-size: var(--text-sm);
  line-height: 1.5;
  color: var(--color-text-secondary);
}

.preset-grid {
  display: grid;
  gap: var(--spacing-3);
  grid-template-columns: repeat(auto-fill, minmax(9.5rem, 1fr));
}

.preset-card {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--spacing-2);
  padding: var(--spacing-3);
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-md);
  text-align: left;
  color: var(--color-text-primary);
  background: var(--color-surface-container-low);
  cursor: pointer;
  transition:
    border-color var(--transition-fast),
    box-shadow var(--transition-fast),
    background-color var(--transition-fast);
}

.preset-card:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

.preset-card:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}

.preset-card:hover:not(:disabled) {
  border-color: var(--color-outline);
  box-shadow: var(--shadow-sm);
}

.preset-card--selected {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 1px var(--color-primary);
  background: var(--color-surface-container);
}

.preset-card__swatch {
  display: block;
  width: 2rem;
  height: 2rem;
  border-radius: var(--radius-full);
  box-shadow: inset 0 0 0 1px var(--color-surface-edge-010);
}

.preset-card__name {
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  line-height: 1.25;
}

.preset-card__vibe {
  font-size: var(--text-xs);
  line-height: 1.35;
  color: var(--color-text-secondary);
}
</style>
