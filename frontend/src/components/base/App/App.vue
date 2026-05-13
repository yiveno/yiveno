<template>
  <div :class="appClasses">
    <slot />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { AppProps } from './App.d'

const props = withDefaults(defineProps<AppProps>(), {
  theme: 'light',
  fullHeight: true,
  showSkeleton: false
})

const appClasses = computed(() => [
  'acuity-app',
  `acuity-app--theme-${props.theme}`,
  {
    'acuity-app--full-height': props.fullHeight
  }
])
</script>

<style scoped>
.acuity-app {
  display: flex;
  flex-direction: column;
  font-family: var(--font-family-base);
  line-height: var(--line-height-normal);
  color: var(--color-text-primary);
  background: var(--color-background);
}

.acuity-app--full-height {
  height: 100vh;
  min-height: 100vh;
}

.acuity-app--theme-light {
  /* Light theme variables are set in tokens.css */
}

.acuity-app--theme-dark {
  /* Dark theme implementation would go here */
  filter: invert(1) hue-rotate(180deg);
}

/* Global app styles */
.acuity-app * {
  box-sizing: border-box;
}

/* 正文里的图片/插图自适应；排除 Lucide 图标（否则在 flex/菜单里易被压扁或触发异常换行） */
.acuity-app img,
.acuity-app svg:not(.acuity-lucide-icon) {
  max-width: 100%;
  height: auto;
}
</style>
