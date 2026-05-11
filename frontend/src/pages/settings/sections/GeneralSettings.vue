<template>
  <div class="settings-section">
    <h3 class="section-subtitle">
      <LucideIcon name="settings" :size="20" />
      <span>{{ t('settings_title_general') }}</span>
    </h3>
    <div class="grid">
      <!-- AI 自动归纳书签 -->
      <div class="row">
        <div class="label">
          <LucideIcon name="sparkles" :size="16" />
          AI 自动归纳书签
        </div>
        <div class="field">
          <md-switch
            :selected="aiAutoEnabled"
            @change="handleAIAutoToggle"
          ></md-switch>
          <div class="field-description">
            <p class="field-description__text">
              开启后,添加书签时自动推荐最佳文件夹并直接保存,无需手动选择。
            </p>
            <p class="field-description__hint">
              关闭后,每次添加书签都会弹出对话框让你手动选择文件夹。
            </p>
          </div>
        </div>
      </div>

      <!-- 语义搜索 -->
      <div class="row">
        <div class="label">
          <LucideIcon name="brain" :size="16" />
          {{ t('settings_general_semantic_search') }}
        </div>
        <div class="field">
          <md-switch
            :selected="semanticSearchEnabled"
            :disabled="!isPro"
            @change="handleSemanticSearchToggle"
          ></md-switch>
          <div class="field-description">
            <p class="field-description__text">
              {{ t('settings_general_semantic_search_description') }}
            </p>
            <p class="field-description__hint">
              后台自动生成语义向量，完全本地化，无需联网。
            </p>
            <p v-if="!isPro" class="field-description__hint field-description__hint--warning">
              <LucideIcon name="crown" :size="12" />
              {{ t('settings_general_semantic_search_pro_only') }}
            </p>
          </div>
        </div>
      </div>

      <!-- 语言说明 -->
      <div class="row">
        <div class="label">
          {{ t('settings_general_language') }}
        </div>
        <div class="field">
          <div class="language-info">
            <p class="language-info__text">
              扩展语言由浏览器语言设置决定。当前语言：<strong>{{ currentLanguageName }}</strong>
            </p>
            <p class="language-info__hint">
              如需更改，请在 Chrome 设置 > 语言 中修改浏览器语言。
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { LucideIcon } from '@/components'
import { t } from '@/utils/i18n-helpers'
import { computed, onMounted, ref } from 'vue'
import { logger } from '@/infrastructure/logging/logger'
import { useSubscription } from '@/composables'

defineOptions({
  name: 'GeneralSettings'
})

// 会员状态
const { isPro } = useSubscription()

// AI 自动归纳开关状态
const aiAutoEnabled = ref(true) // 默认开启

// 语义搜索开关状态
const semanticSearchEnabled = ref(false) // 默认关闭

// 加载设置
onMounted(async () => {
  try {
    const result = await chrome.storage.local.get(['aiAutoBookmark', 'semanticSearchEnabled'])
    aiAutoEnabled.value = result.aiAutoBookmark !== false // 默认 true
    semanticSearchEnabled.value = result.semanticSearchEnabled === true // 默认 false
    logger.info('GeneralSettings', '设置已加载', {
      aiAuto: aiAutoEnabled.value,
      semanticSearch: semanticSearchEnabled.value,
      isPro: isPro.value
    })
  } catch (error) {
    logger.error('GeneralSettings', '加载设置失败', error)
  }
})

// 处理 AI 自动归纳开关切换
async function handleAIAutoToggle(event: Event) {
  const target = event.target as unknown as { selected: boolean }
  aiAutoEnabled.value = target.selected
  try {
    await chrome.storage.local.set({ aiAutoBookmark: aiAutoEnabled.value })
    logger.info('GeneralSettings', 'AI 自动归纳设置已更新', { enabled: aiAutoEnabled.value })
  } catch (error) {
    logger.error('GeneralSettings', '保存 AI 自动归纳设置失败', error)
  }
}

// 处理语义搜索开关切换
async function handleSemanticSearchToggle(event: Event) {
  const target = event.target as unknown as { selected: boolean }
  semanticSearchEnabled.value = target.selected
  try {
    await chrome.storage.local.set({ semanticSearchEnabled: semanticSearchEnabled.value })
    logger.info('GeneralSettings', '语义搜索设置已更新', {
      enabled: semanticSearchEnabled.value,
      isPro: isPro.value
    })
  } catch (error) {
    logger.error('GeneralSettings', '保存语义搜索设置失败', error)
  }
}

// 语言显示名称映射
// 支持多种语言代码格式（连字符和下划线）
const languageNames: Record<string, string> = {
  'zh-CN': '简体中文',
  zh_CN: '简体中文',
  'zh-TW': '繁體中文',
  zh_TW: '繁體中文',
  en: 'English',
  'en-US': 'English',
  en_US: 'English',
  ja: '日本語',
  ko: '한국어',
  de: 'Deutsch',
  es: 'Español'
}

// 获取当前语言名称
const currentLanguageName = computed(() => {
  if (typeof chrome !== 'undefined' && chrome.i18n) {
    const uiLanguage = chrome.i18n.getUILanguage()
    return languageNames[uiLanguage] || uiLanguage
  }
  return 'English'
})
</script>

<style scoped>
.settings-section {
  margin-bottom: var(--spacing-6);
}

.section-subtitle {
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
  margin: 0 0 var(--spacing-4) 0;
  padding-bottom: var(--spacing-2);
  border-bottom: 1px solid var(--color-border-subtle);
  font-size: var(--text-base);
  font-weight: var(--font-semibold);
  color: var(--color-text-secondary);
}

.grid {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-4);
}

.label {
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
  min-width: 100px;
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: var(--color-text-secondary);
}

.row {
  display: flex;
  align-items: flex-start;
  gap: var(--spacing-5);
}

.field {
  display: flex;
  flex: 1;
  align-items: flex-start;
  gap: var(--spacing-4);
}

/* Material Web Components Switch 样式覆盖 */
md-switch {
  --md-switch-selected-track-color: var(--color-primary);
  --md-switch-selected-handle-color: var(--md-sys-color-on-primary);
  --md-switch-selected-hover-track-color: var(--color-primary-hover);
  --md-switch-selected-pressed-track-color: var(--color-primary-active);

  flex-shrink: 0;
}
/* Field Description */
.field-description {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-1);
}

.field-description__text {
  margin: 0;
  font-size: var(--text-sm);
  color: var(--color-text-primary);
}

.field-description__hint {
  display: flex;
  align-items: center;
  gap: var(--spacing-1);
  margin: 0;
  font-size: var(--text-xs);
  color: var(--color-text-secondary);
}

.field-description__hint--warning {
  color: var(--color-semantic-warning);
}

/* 语言信息 */
.language-info {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-2);
}

.language-info__text {
  margin: 0;
  font-size: var(--text-sm);
  color: var(--color-text-primary);
}

.language-info__hint {
  margin: 0;
  font-size: var(--text-xs);
  color: var(--color-text-secondary);
}
</style>
