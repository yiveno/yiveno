<script setup lang="ts">
import { t } from '@/utils/i18n-helpers'
import { computed } from 'vue'

defineOptions({
  name: 'GeneralSettings'
})

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

<template>
  <div class="grid">
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
          <p class="language-info__hint">如需更改，请在 Chrome 设置 > 语言 中修改浏览器语言。</p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
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
