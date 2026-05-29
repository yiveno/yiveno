<script setup lang="ts">
import '@material/web/progress/circular-progress.js'
import type { LoadingProps } from './Loading.d'

defineOptions({ name: 'Loading' })

withDefaults(defineProps<LoadingProps>(), {
  size: 'md',
  indeterminate: true
})
</script>

<template>
  <div
    class="loading-container"
    :class="[`loading-container--${size}`, { 'loading-container--with-text': text }]"
  >
    <md-circular-progress :indeterminate="indeterminate" class="loading-spinner" />
    <span v-if="text" class="loading-text">{{ text }}</span>
  </div>
</template>

<style scoped>
.loading-container {
  display: inline-flex;
  justify-content: center;
  align-items: center;
}

/* 带文案时使用列布局 */
.loading-container--with-text {
  flex-direction: column;
  gap: var(--spacing-2);
}

/* 基础样式 */
.loading-spinner {
  --md-circular-progress-active-indicator-color: var(--md-sys-color-primary);
}

/* 尺寸变体 */
.loading-container--xs .loading-spinner {
  --md-circular-progress-size: 16px;
  --md-circular-progress-active-indicator-width: 2px;
}

.loading-container--sm .loading-spinner {
  --md-circular-progress-size: 20px;
  --md-circular-progress-active-indicator-width: 2.5px;
}

.loading-container--md .loading-spinner {
  --md-circular-progress-size: 32px;
  --md-circular-progress-active-indicator-width: 3px;
}

.loading-container--lg .loading-spinner {
  --md-circular-progress-size: 48px;
  --md-circular-progress-active-indicator-width: 4px;
}

.loading-container--xl .loading-spinner {
  --md-circular-progress-size: 64px;
  --md-circular-progress-active-indicator-width: 5px;
}

/* 加载文案 */
.loading-text {
  font-size: var(--text-sm);
  text-align: center;
  color: var(--color-text-secondary);
}
</style>
