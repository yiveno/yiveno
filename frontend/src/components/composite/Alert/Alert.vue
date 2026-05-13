<template>
  <div :class="alertClasses" role="alert">
    <LucideIcon v-if="icon" :name="icon" class="acuity-alert-icon" />
    <div class="acuity-alert-content">
      <slot>{{ message }}</slot>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { LucideIcon } from '@/components'
import type { AlertProps } from './Alert.d'

const props = withDefaults(defineProps<AlertProps>(), {
  variant: 'filled',
  color: 'info',
  size: 'md'
})

const alertClasses = computed(() => [
  'acuity-alert',
  `acuity-alert--${props.variant}`,
  `acuity-alert--${props.color}`,
  `acuity-alert--${props.size}`
])

const icon = computed(() => {
  if (props.icon) return props.icon
  switch (props.color) {
    case 'success':
      return 'check-circle'
    case 'warning':
      return 'alert-triangle'
    case 'error':
      return 'x-circle'
    default:
      return 'info'
  }
})
</script>

<style scoped>
.acuity-alert {
  display: flex;
  align-items: flex-start;
  gap: var(--spacing-sm);
  width: 100%;
  padding: var(--spacing-md);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  line-height: 1.5;
  transition: all var(--md-sys-motion-duration-short2)
    var(--md-sys-motion-easing-standard);
}

/* Variants */
.acuity-alert--filled {
  border: none;
}

.acuity-alert--outlined {
  border: 1px solid currentColor;
  background: transparent;
}

.acuity-alert--soft {
  border: none;
  background: color-mix(in srgb, currentColor 10%, transparent);
}

/* Colors - Filled */
.acuity-alert--filled.acuity-alert--info {
  color: var(--color-on-info-container);
  background: var(--color-info-container);
  box-shadow: 0 1px 3px var(--color-shadow-008);
}

.acuity-alert--filled.acuity-alert--success {
  color: var(--color-on-success-container);
  background: var(--color-success-container);
  box-shadow: 0 1px 3px var(--color-shadow-008);
}

.acuity-alert--filled.acuity-alert--warning {
  color: var(--color-on-warning-container);
  background: var(--color-warning-container);
  box-shadow: 0 1px 3px var(--color-shadow-008);
}

.acuity-alert--filled.acuity-alert--error {
  color: var(--color-on-error-container);
  background: var(--color-error-container);
  box-shadow: 0 1px 3px var(--color-shadow-008);
}

/* Colors - Outlined */
.acuity-alert--outlined.acuity-alert--info {
  border-color: var(--color-info);
  color: var(--color-info);
}

.acuity-alert--outlined.acuity-alert--success {
  border-color: var(--color-success);
  color: var(--color-success);
}

.acuity-alert--outlined.acuity-alert--warning {
  border-color: var(--color-warning);
  color: var(--color-warning);
}

.acuity-alert--outlined.acuity-alert--error {
  border-color: var(--color-error);
  color: var(--color-error);
}

/* Colors - Soft */
.acuity-alert--soft.acuity-alert--info {
  color: var(--color-info);
  background: var(--color-info-alpha-10);
}

.acuity-alert--soft.acuity-alert--success {
  color: var(--color-success);
  background: var(--color-success-alpha-10);
}

.acuity-alert--soft.acuity-alert--warning {
  color: var(--color-warning);
  background: var(--color-warning-alpha-10);
}

.acuity-alert--soft.acuity-alert--error {
  color: var(--color-error);
  background: var(--color-error-alpha-10);
}

/* Sizes */
.acuity-alert--sm {
  padding: var(--spacing-sm);
  font-size: var(--text-xs);
}

.acuity-alert--md {
  padding: var(--spacing-md);
  font-size: var(--text-sm);
}

.acuity-alert--lg {
  padding: var(--spacing-lg);
  font-size: var(--text-base);
}

.acuity-alert-icon {
  flex-shrink: 0;
  margin-top: var(--spacing-0-5); /* 2px */
}

.acuity-alert-content {
  flex: 1;
  min-width: 0;
}
</style>
