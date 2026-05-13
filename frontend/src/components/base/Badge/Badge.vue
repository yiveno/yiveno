<template>
  <span :class="badgeClasses">
    <slot />
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { BadgeProps } from './Badge.d'

const props = withDefaults(defineProps<BadgeProps>(), {
  variant: 'filled',
  color: 'primary',
  size: 'md'
})

const badgeClasses = computed(() => [
  'acuity-badge',
  `acuity-badge--${props.variant}`,
  `acuity-badge--${props.color}`,
  `acuity-badge--${props.size}`
])
</script>

<style scoped>
.acuity-badge {
  display: inline-flex;
  justify-content: center;
  align-items: center;
  border-radius: var(--radius-full);
  font-weight: var(--font-medium);
  white-space: nowrap;
  vertical-align: baseline;
  transition: all var(--md-sys-motion-duration-short2)
    var(--md-sys-motion-easing-standard);
}

/* Sizes - 使用固定高度和 min-width，单位数时为圆形 */
.acuity-badge--sm {
  min-width: 20px;
  height: 20px;
  padding: 0 6px;
  font-size: var(--text-xs);
}

.acuity-badge--md {
  min-width: 24px;
  height: 24px;
  padding: 0 8px;
  font-size: var(--text-sm);
}

.acuity-badge--lg {
  min-width: 32px;
  height: 32px;
  padding: 0 10px;
  font-size: var(--text-base);
}

/* Filled variant */
.acuity-badge--filled.acuity-badge--primary {
  color: var(--color-primary-foreground);
  background: var(--color-primary);
  box-shadow:
    0 1px 2px var(--color-shadow-010),
    0 0 8px color-mix(in srgb, var(--color-primary) 20%, transparent);
}

.acuity-badge--filled.acuity-badge--secondary {
  color: var(--color-secondary-foreground);
  background: var(--color-secondary);
  box-shadow:
    0 1px 2px var(--color-shadow-010),
    0 0 8px color-mix(in srgb, var(--color-secondary) 20%, transparent);
}

.acuity-badge--filled.acuity-badge--success {
  color: var(--color-success-foreground);
  background: var(--color-success);
  box-shadow:
    0 1px 2px var(--color-shadow-010),
    0 0 8px color-mix(in srgb, var(--color-success) 20%, transparent);
}

.acuity-badge--filled.acuity-badge--warning {
  color: var(--color-warning-foreground);
  background: var(--color-warning);
  box-shadow:
    0 1px 2px var(--color-shadow-010),
    0 0 8px color-mix(in srgb, var(--color-warning) 20%, transparent);
}

.acuity-badge--filled.acuity-badge--error {
  color: var(--color-error-foreground);
  background: var(--color-error);
  box-shadow:
    0 1px 2px var(--color-shadow-010),
    0 0 8px color-mix(in srgb, var(--color-error) 20%, transparent);
}

.acuity-badge--filled.acuity-badge--info {
  color: var(--color-info-foreground);
  background: var(--color-info);
  box-shadow:
    0 1px 2px var(--color-shadow-010),
    0 0 8px color-mix(in srgb, var(--color-info) 20%, transparent);
}

/* Outlined variant */
.acuity-badge--outlined {
  border: 1px solid currentColor;
  background: transparent;
}

.acuity-badge--outlined.acuity-badge--primary {
  color: var(--color-primary);
}

.acuity-badge--outlined.acuity-badge--secondary {
  color: var(--color-secondary);
}

.acuity-badge--outlined.acuity-badge--success {
  color: var(--color-success);
}

.acuity-badge--outlined.acuity-badge--warning {
  color: var(--color-warning);
}

.acuity-badge--outlined.acuity-badge--error {
  color: var(--color-error);
}

.acuity-badge--outlined.acuity-badge--info {
  color: var(--color-info);
}

/* Soft variant */
.acuity-badge--soft.acuity-badge--primary {
  color: var(--color-primary);
  background: var(--color-primary-alpha-10);
  box-shadow: var(--shadow-sm);
}

.acuity-badge--soft.acuity-badge--secondary {
  color: var(--color-secondary);
  background: var(--color-secondary-alpha-10);
  box-shadow: var(--shadow-sm);
}

.acuity-badge--soft.acuity-badge--success {
  color: var(--color-success);
  background: var(--color-success-alpha-10);
  box-shadow: var(--shadow-sm);
}

.acuity-badge--soft.acuity-badge--warning {
  color: var(--color-warning);
  background: var(--color-warning-alpha-10);
  box-shadow: var(--shadow-sm);
}

.acuity-badge--soft.acuity-badge--error {
  color: var(--color-error);
  background: var(--color-error-alpha-10);
  box-shadow: var(--shadow-sm);
}

.acuity-badge--soft.acuity-badge--info {
  color: var(--color-info);
  background: var(--color-info-alpha-10);
  box-shadow: var(--shadow-sm);
}
</style>
