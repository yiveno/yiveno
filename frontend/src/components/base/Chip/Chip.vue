<script setup lang="ts">
import { computed } from 'vue'
import type { ChipProps } from './Chip.d'

defineOptions({
  name: 'AcuityChip'
})

const props = withDefaults(defineProps<ChipProps>(), {
  type: 'assist',
  variant: 'filled',
  color: 'primary',
  size: 'md',
  selected: false,
  removable: false,
  elevated: false,
  removeOnly: false,
  avatar: false
})

const chipTag = computed(() => {
  switch (props.type) {
    case 'filter':
      return 'md-filter-chip'
    case 'input':
      return 'md-input-chip'
    case 'suggestion':
      return 'md-suggestion-chip'
    case 'assist':
    default:
      return 'md-assist-chip'
  }
})

const chipAttrs = computed(() => {
  const attrs: Record<string, unknown> = {}
  if (props.type === 'filter' || props.type === 'input') {
    attrs.selected = props.selected
    attrs.removable = props.removable
  }
  if (props.type === 'input') {
    attrs.avatar = props.avatar
    attrs.removeOnly = props.removeOnly
  }
  if (props.type === 'assist' || props.type === 'suggestion') {
    attrs.elevated = props.elevated
  }
  if (props.href) {
    attrs.href = props.href
    if (props.target) attrs.target = props.target
    if (props.download) attrs.download = props.download
  }
  return attrs
})

const chipClasses = computed(() => [
  'acuity-chip',
  `acuity-chip--${props.type}`,
  `acuity-chip--${props.variant}`,
  `acuity-chip--${props.color}`,
  `acuity-chip--${props.size}`
])
</script>

<template>
  <component :is="chipTag" v-bind="chipAttrs" :class="chipClasses">
    <slot />
  </component>
</template>

<style scoped>
.acuity-chip {
  --md-assist-chip-container-shape: var(--radius-full);
  --md-assist-chip-label-text-font: var(--font-family-base);
  --md-assist-chip-label-text-weight: var(--font-weight-medium);
  --md-assist-chip-label-text-tracking: var(--typescale-label-md-tracking);
}

.acuity-chip--sm {
  --md-assist-chip-label-text-size: var(--typescale-label-md-size);
  --md-assist-chip-label-text-line-height: var(--typescale-label-md-line);
}

.acuity-chip--md {
  --md-assist-chip-label-text-size: var(--typescale-label-lg-size);
  --md-assist-chip-label-text-line-height: var(--typescale-label-lg-line);
  --md-assist-chip-label-text-tracking: var(--typescale-label-lg-tracking);
}

.acuity-chip--lg {
  --md-assist-chip-label-text-size: var(--typescale-title-sm-size);
  --md-assist-chip-label-text-line-height: var(--typescale-title-sm-line);
  --md-assist-chip-label-text-tracking: var(--typescale-title-sm-tracking);
}

.acuity-chip--filled.acuity-chip--primary {
  --md-assist-chip-label-text-color: var(--color-primary-foreground);
  --md-assist-chip-container-color: var(--color-primary);
}

.acuity-chip--filled.acuity-chip--secondary {
  --md-assist-chip-label-text-color: var(--color-secondary-foreground);
  --md-assist-chip-container-color: var(--color-secondary);
}

.acuity-chip--filled.acuity-chip--success {
  --md-assist-chip-label-text-color: var(--color-success-container-foreground);
  --md-assist-chip-container-color: var(--color-success-container);
}

.acuity-chip--filled.acuity-chip--warning {
  --md-assist-chip-label-text-color: var(--color-warning-container-foreground);
  --md-assist-chip-container-color: var(--color-warning-container);
}

.acuity-chip--filled.acuity-chip--error {
  --md-assist-chip-label-text-color: var(--color-error-container-foreground);
  --md-assist-chip-container-color: var(--color-error-container);
}

.acuity-chip--filled.acuity-chip--info {
  --md-assist-chip-label-text-color: var(--color-info-container-foreground);
  --md-assist-chip-container-color: var(--color-info-container);
}

.acuity-chip--outlined.acuity-chip--primary {
  --md-assist-chip-label-text-color: var(--color-primary);
}

.acuity-chip--outlined.acuity-chip--secondary {
  --md-assist-chip-label-text-color: var(--color-secondary);
}

.acuity-chip--outlined.acuity-chip--success {
  --md-assist-chip-label-text-color: var(--color-success);
}

.acuity-chip--outlined.acuity-chip--warning {
  --md-assist-chip-label-text-color: var(--color-warning);
}

.acuity-chip--outlined.acuity-chip--error {
  --md-assist-chip-label-text-color: var(--color-error);
}

.acuity-chip--outlined.acuity-chip--info {
  --md-assist-chip-label-text-color: var(--color-info);
}

.acuity-chip--soft.acuity-chip--primary {
  --md-assist-chip-label-text-color: var(--color-primary);
  --md-assist-chip-container-color: var(--color-primary-alpha-10);
}

.acuity-chip--soft.acuity-chip--secondary {
  --md-assist-chip-label-text-color: var(--color-secondary);
  --md-assist-chip-container-color: var(--color-secondary-alpha-10);
}

.acuity-chip--soft.acuity-chip--success {
  --md-assist-chip-label-text-color: var(--color-success);
  --md-assist-chip-container-color: var(--color-success-alpha-10);
}

.acuity-chip--soft.acuity-chip--warning {
  --md-assist-chip-label-text-color: var(--color-warning);
  --md-assist-chip-container-color: var(--color-warning-alpha-10);
}

.acuity-chip--soft.acuity-chip--error {
  --md-assist-chip-label-text-color: var(--color-error);
  --md-assist-chip-container-color: var(--color-error-alpha-10);
}

.acuity-chip--soft.acuity-chip--info {
  --md-assist-chip-label-text-color: var(--color-info);
  --md-assist-chip-container-color: var(--color-info-alpha-10);
}
</style>
