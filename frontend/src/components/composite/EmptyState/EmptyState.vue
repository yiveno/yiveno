<!--
  空状态组件
  用于展示无数据、筛选无结果等空状态
-->
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

<style scoped>
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
  min-height: 200px;
  padding: var(--space-8) var(--space-4);
  text-align: center;
  
  /* ✅ 优化：添加淡入动画 */
  animation: fade-in-up var(--md-sys-motion-duration-medium2) var(--md-sys-motion-easing-emphasized);
}

.empty-state__icon {
  margin-bottom: var(--space-4);
  opacity: 0.5;
  
  /* ✅ 优化：图标淡入动画 */
  animation: fade-in-up var(--md-sys-motion-duration-medium2) var(--md-sys-motion-easing-emphasized);
}

.empty-state__title {
  margin-bottom: var(--space-2);
  font-size: var(--md-sys-typescale-title-medium-size); /* 16px */
  font-weight: var(--md-sys-typescale-title-medium-weight); /* 500 */
  color: var(--color-text-primary);
  
  /* ✅ 优化：标题延迟淡入 */
  animation: fade-in-up var(--md-sys-motion-duration-medium2) var(--md-sys-motion-easing-emphasized);
  animation-delay: 50ms;
  animation-fill-mode: backwards;
}

.empty-state__description {
  max-width: 400px;
  margin-bottom: var(--space-4);
  font-size: var(--font-size-sm);
  line-height: 1.5;
  color: var(--color-text-secondary);
  
  /* ✅ 优化：描述延迟淡入 */
  animation: fade-in-up var(--md-sys-motion-duration-medium2) var(--md-sys-motion-easing-emphasized);
  animation-delay: 100ms;
  animation-fill-mode: backwards;
}

.empty-state__actions {
  margin-top: var(--space-4);
  
  /* ✅ 优化：操作按钮延迟淡入 */
  animation: fade-in-up var(--md-sys-motion-duration-medium2) var(--md-sys-motion-easing-emphasized);
  animation-delay: 150ms;
  animation-fill-mode: backwards;
}
</style>
