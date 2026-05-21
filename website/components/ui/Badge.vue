<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    variant?: 'default' | 'outline' | 'success' | 'warning' | 'danger'
    size?: 'sm' | 'md'
    className?: string
  }>(),
  {
    variant: 'default',
    size: 'sm',
    className: ''
  }
)

const computedClass = computed(() => {
  const classes = [
    'badge',
    `badge-${props.variant}`,
    `badge-${props.size}`,
    props.className
  ]
  return classes.filter(Boolean).join(' ')
})
</script>

<template>
  <span :class="computedClass">
    <slot />
  </span>
</template>

<style scoped>
/* 基础徽章样式 */
.badge {
  display: inline-flex;
  align-items: center;
  border-radius: var(--md-sys-shape-corner-full);
  font-weight: 500;
  transition: colors 0.2s ease;
}

/* 尺寸 */
.badge-sm {
  padding: 2px 10px;
  font-size: 12px;
}

.badge-md {
  padding: 4px 12px;
  font-size: 14px;
}

/* 变体 */
.badge-default {
  background-color: color-mix(in srgb, var(--md-sys-color-primary) 10%, transparent);
  color: var(--md-sys-color-primary);
  border: 1px solid color-mix(in srgb, var(--md-sys-color-primary) 20%, transparent);
}

.badge-outline {
  background-color: transparent;
  border: 1px solid color-mix(in srgb, white 10%, transparent);
  color: var(--md-sys-color-on-surface-variant);
}

.badge-success {
  background-color: color-mix(in srgb, var(--acuity-semantic-success) 10%, transparent);
  color: var(--acuity-semantic-success);
  border: 1px solid color-mix(in srgb, var(--acuity-semantic-success) 20%, transparent);
}

.badge-warning {
  background-color: color-mix(in srgb, var(--acuity-semantic-warning) 10%, transparent);
  color: var(--acuity-semantic-warning);
  border: 1px solid color-mix(in srgb, var(--acuity-semantic-warning) 20%, transparent);
}

.badge-danger {
  background-color: color-mix(in srgb, var(--md-sys-color-error) 10%, transparent);
  color: var(--md-sys-color-error);
  border: 1px solid color-mix(in srgb, var(--md-sys-color-error) 20%, transparent);
}
</style>
