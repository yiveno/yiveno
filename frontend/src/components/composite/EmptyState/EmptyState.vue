<!--
  空状态组件
  用于展示无数据、筛选无结果等空状态
-->
<script setup lang="ts">
import { LucideIcon } from '@/components/base/LucideIcon'
import type { EmptyStateProps } from './EmptyState.d'

defineOptions({ name: 'EmptyState' })

withDefaults(defineProps<EmptyStateProps>(), {
  icon: 'folder',
  iconSize: 48,
  iconColor: 'muted'
})
</script>

<template>
  <div class="empty-state">
    <div class="empty-state__icon">
      <LucideIcon :name="icon" :size="iconSize" :color="iconColor" />
    </div>
    <div v-if="title" class="empty-state__title">{{ title }}</div>
    <div v-if="description" class="empty-state__description">
      {{ description }}
    </div>
    <div v-if="$slots.default" class="empty-state__actions">
      <slot />
    </div>
  </div>
</template>

<style scoped>
/**
 * ♿ 尊重用户的动画偏好
 */
@media (prefers-reduced-motion: reduce) {
  .empty-state,
  .empty-state__icon,
  .empty-state__title,
  .empty-state__description,
  .empty-state__actions {
    animation: none !important;
  }
}

@keyframes fade-in-up {
  from {
    opacity: 0;
    transform: translateY(16px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.empty-state {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  min-height: 120px;
  padding: var(--spacing-4) var(--spacing-4);
  text-align: center;
  animation: fade-in-up var(--md-sys-motion-duration-medium2) var(--md-sys-motion-easing-emphasized);
}

.empty-state__icon {
  margin-bottom: var(--spacing-3);
  opacity: 0.5;
  animation: fade-in-up var(--md-sys-motion-duration-medium2) var(--md-sys-motion-easing-emphasized);
  will-change: opacity, transform;
}

.empty-state__title {
  margin-bottom: var(--spacing-2);
  font-size: var(--md-sys-typescale-title-medium-size);
  font-weight: var(--md-sys-typescale-title-medium-weight);
  color: var(--color-text-primary);
  animation: fade-in-up var(--md-sys-motion-duration-medium2) var(--md-sys-motion-easing-emphasized);
  animation-delay: 50ms;
  animation-fill-mode: backwards;
  will-change: opacity, transform;
}

.empty-state__description {
  max-width: 400px;
  margin-bottom: var(--spacing-4);
  font-size: var(--md-sys-typescale-body-medium-size);
  line-height: var(--md-sys-typescale-body-medium-line-height);
  color: var(--color-text-secondary);
  animation: fade-in-up var(--md-sys-motion-duration-medium2) var(--md-sys-motion-easing-emphasized);
  animation-delay: 100ms;
  animation-fill-mode: backwards;
  will-change: opacity, transform;
}

.empty-state__actions {
  margin-top: var(--spacing-4);
  animation: fade-in-up var(--md-sys-motion-duration-medium2) var(--md-sys-motion-easing-emphasized);
  animation-delay: 150ms;
  animation-fill-mode: backwards;
  will-change: opacity, transform;
}
</style>
