<script setup lang="ts">
import { computed } from 'vue'
import type { ChipProps } from './Chip.d'

defineOptions({
  name: 'YivenoChip'
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
  'yiveno-chip',
  `yiveno-chip--${props.type}`,
  `yiveno-chip--${props.variant}`,
  `yiveno-chip--${props.color}`,
  `yiveno-chip--${props.size}`
])
</script>

<template>
  <component :is="chipTag" v-bind="chipAttrs" :class="chipClasses">
    <slot />
  </component>
</template>

<style scoped>
.yiveno-chip {
  --md-assist-chip-container-shape: var(--radius-full);
  --md-assist-chip-label-text-font: var(--font-family-base);
  --md-assist-chip-label-text-weight: var(--font-weight-medium);
  --md-assist-chip-label-text-tracking: var(--typescale-label-md-tracking);
}

.yiveno-chip--sm {
  --md-assist-chip-label-text-size: var(--typescale-label-md-size);
  --md-assist-chip-label-text-line-height: var(--typescale-label-md-line);
}

.yiveno-chip--md {
  --md-assist-chip-label-text-size: var(--typescale-label-lg-size);
  --md-assist-chip-label-text-line-height: var(--typescale-label-lg-line);
  --md-assist-chip-label-text-tracking: var(--typescale-label-lg-tracking);
}

.yiveno-chip--lg {
  --md-assist-chip-label-text-size: var(--typescale-title-sm-size);
  --md-assist-chip-label-text-line-height: var(--typescale-title-sm-line);
  --md-assist-chip-label-text-tracking: var(--typescale-title-sm-tracking);
}

.yiveno-chip--filled.yiveno-chip--primary {
  --md-assist-chip-label-text-color: var(--color-primary-foreground);
  --md-assist-chip-container-color: var(--color-primary);
}

.yiveno-chip--filled.yiveno-chip--secondary {
  --md-assist-chip-label-text-color: var(--color-secondary-foreground);
  --md-assist-chip-container-color: var(--color-secondary);
}

.yiveno-chip--filled.yiveno-chip--success {
  --md-assist-chip-label-text-color: var(--color-success-container-foreground);
  --md-assist-chip-container-color: var(--color-success-container);
}

.yiveno-chip--filled.yiveno-chip--warning {
  --md-assist-chip-label-text-color: var(--color-warning-container-foreground);
  --md-assist-chip-container-color: var(--color-warning-container);
}

.yiveno-chip--filled.yiveno-chip--error {
  --md-assist-chip-label-text-color: var(--color-error-container-foreground);
  --md-assist-chip-container-color: var(--color-error-container);
}

.yiveno-chip--filled.yiveno-chip--info {
  --md-assist-chip-label-text-color: var(--color-info-container-foreground);
  --md-assist-chip-container-color: var(--color-info-container);
}

.yiveno-chip--outlined.yiveno-chip--primary {
  --md-assist-chip-label-text-color: var(--color-primary);
}

.yiveno-chip--outlined.yiveno-chip--secondary {
  --md-assist-chip-label-text-color: var(--color-secondary);
}

.yiveno-chip--outlined.yiveno-chip--success {
  --md-assist-chip-label-text-color: var(--color-success);
}

.yiveno-chip--outlined.yiveno-chip--warning {
  --md-assist-chip-label-text-color: var(--color-warning);
}

.yiveno-chip--outlined.yiveno-chip--error {
  --md-assist-chip-label-text-color: var(--color-error);
}

.yiveno-chip--outlined.yiveno-chip--info {
  --md-assist-chip-label-text-color: var(--color-info);
}

.yiveno-chip--soft.yiveno-chip--primary {
  --md-assist-chip-label-text-color: var(--color-primary);
  --md-assist-chip-container-color: var(--color-primary-alpha-10);
}

.yiveno-chip--soft.yiveno-chip--secondary {
  --md-assist-chip-label-text-color: var(--color-secondary);
  --md-assist-chip-container-color: var(--color-secondary-alpha-10);
}

.yiveno-chip--soft.yiveno-chip--success {
  --md-assist-chip-label-text-color: var(--color-success);
  --md-assist-chip-container-color: var(--color-success-alpha-10);
}

.yiveno-chip--soft.yiveno-chip--warning {
  --md-assist-chip-label-text-color: var(--color-warning);
  --md-assist-chip-container-color: var(--color-warning-alpha-10);
}

.yiveno-chip--soft.yiveno-chip--error {
  --md-assist-chip-label-text-color: var(--color-error);
  --md-assist-chip-container-color: var(--color-error-alpha-10);
}

.yiveno-chip--soft.yiveno-chip--info {
  --md-assist-chip-label-text-color: var(--color-info);
  --md-assist-chip-container-color: var(--color-info-alpha-10);
}
</style>
