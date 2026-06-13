<!--
  OtterSageCard - 卡片组件
  通用卡片布局组件，支持标题、内容、操作区域
  集成 Material Design 3 md-elevation 组件
-->
<script setup lang="ts">
import { computed } from 'vue'
import { LucideIcon } from '@/components/base/LucideIcon'
import type { CardProps, CardEmits } from './Card.d'

/**
 * 卡片默认属性设置，保障视觉与交互一致性。
 */
const props = withDefaults(defineProps<CardProps>(), {
  variant: 'default',
  size: 'md',
  padding: true,
  borderless: false,
  footerTransition: ''
})

defineEmits<CardEmits>()

// Card classes
/**
 * 根据属性生成卡片的样式类集合。
 */
const cardClasses = computed(() => [
  'card',
  `card--${props.variant}`,
  `card--${props.size}`,
  {
    'card--no-padding': !props.padding,
    'card--hover': props.hover,
    'card--clickable': props.clickable,
    'card--borderless': props.borderless
  }
])

/**
 * Elevation 类名（用于控制 hover 状态）
 */
const elevationClass = computed(() => 'card__elevation')

const handleKeydown = (event: KeyboardEvent) => {
  if (!props.clickable) return
  if (event.key !== 'Enter' && event.key !== ' ') return
  event.preventDefault()
  const mouseEvent = new MouseEvent('click', { bubbles: true, cancelable: true })
  event.currentTarget?.dispatchEvent(mouseEvent)
}

// 类型已从 Card.types.ts 导入
</script>

<template>
  <div
    :class="cardClasses"
    :role="props.clickable ? 'button' : undefined"
    :tabindex="props.clickable ? 0 : undefined"
    @click="props.clickable ? $emit('click', $event) : undefined"
    @keydown="handleKeydown"
  >
    <!-- Material Design 3 Elevation -->
    <md-elevation :class="elevationClass"></md-elevation>

    <!-- Header -->
    <header v-if="$slots.header || title" class="card__header">
      <slot name="header">
        <div class="card__title-section">
          <LucideIcon v-if="icon" :name="icon" :color="iconColor" class="card__icon" />
          <h3 v-if="title" class="card__title">{{ title }}</h3>
          <p v-if="subtitle" class="card__subtitle">{{ subtitle }}</p>
        </div>

        <div v-if="$slots.actions" class="card__actions">
          <slot name="actions" />
        </div>
      </slot>
    </header>

    <!-- Body -->
    <div v-if="$slots.default" class="card__body">
      <slot />
    </div>

    <!-- Footer -->
    <Transition :name="props.footerTransition">
      <footer v-if="(props.footerVisible ?? !!$slots.footer) && $slots.footer" class="card__footer">
        <slot name="footer" />
      </footer>
    </Transition>
  </div>
</template>

<style scoped>
/**
 * ♿ 可访问性：尊重用户的动画偏好
 */
@media (prefers-reduced-motion: reduce) {
  .card,
  .card--hover,
  .card--clickable {
    transition: none !important;
    animation: none !important;
  }
}

/* === Responsive === */
@container (max-width: 400px) {
  .card__header {
    flex-direction: column;
    align-items: stretch;
  }

  .card__title-section {
    flex-direction: column;
    align-items: flex-start;
  }
}

.card {
  --ottersage-card-container-color: var(--md-sys-color-surface);
  --ottersage-card-outline-color: var(--md-sys-color-outline-variant);
  --ottersage-card-outline-width: 1px;
  --ottersage-card-shape: var(--radius-lg);

  position: relative;

  /* Base styles */
  display: flex;
  flex-direction: column;
  border: var(--ottersage-card-outline-width) solid var(--ottersage-card-outline-color);
  border-radius: var(--ottersage-card-shape);
  background-color: var(--ottersage-card-container-color);
  transition:
    border-color var(--motion-standard),
    opacity var(--md-sys-motion-duration-short2) var(--md-sys-motion-easing-standard);
  overflow: hidden;
}

/* === Material Design 3 Elevation === */
.card__elevation {
  position: absolute;
  inset: 0;
  z-index: 0;
}

/* === Variants === */
.card--default {
  --ottersage-card-container-color: var(--md-sys-color-surface-container-low);
  --ottersage-card-outline-color: var(--md-sys-color-outline-variant);
}

.card--default .card__elevation {
  --md-elevation-level: 1;
}

.card--outlined {
  --ottersage-card-container-color: var(--md-sys-color-surface);
  --ottersage-card-outline-color: var(--md-sys-color-outline);
  --ottersage-card-outline-width: 1px;
}

.card--outlined .card__elevation {
  --md-elevation-level: 1;
}

.card--elevated {
  --ottersage-card-container-color: var(--md-sys-color-surface-container-low);
  --ottersage-card-outline-color: transparent;
}

.card--elevated .card__elevation {
  --md-elevation-level: 2;
}

.card--warning {
  border: 1px solid var(--color-border-subtle);
  border-left-width: 3px;
  border-left-color: var(--color-warning);
  background: color-mix(in srgb, var(--color-warning) 8%, var(--color-surface));
}

.card--warning .card__elevation {
  --md-elevation-level: 0;
}

.card--danger {
  border: 1px solid var(--color-border-subtle);
  border-left-width: 3px;
  border-left-color: var(--color-error);
  background: color-mix(in srgb, var(--color-error) 6%, var(--color-surface));
}

.card--danger .card__elevation {
  --md-elevation-level: 0;
}

.card--success {
  border: 1px solid var(--color-border-subtle);
  border-left-width: 3px;
  border-left-color: var(--color-success);
  background: color-mix(in srgb, var(--color-success) 8%, var(--color-surface));
}

.card--success .card__elevation {
  --md-elevation-level: 0;
}

/* === Borderless - 高特异性覆盖 outlined/elevated === */
.card.card--borderless {
  border: none;
}

/* === Sizes === */
.card--sm {
  --card-padding: var(--space-3);
  --card-gap: var(--space-2);
}

.card--md {
  --card-padding: var(--space-4);
  --card-gap: var(--space-3);
}

.card--lg {
  --card-padding: var(--space-6);
  --card-gap: var(--space-4);
}

/* === States === */
.card--hover:hover .card__elevation {
  --md-elevation-level: 3;
}

.card--clickable {
  cursor: pointer;

  &:hover {
    border-color: var(--color-border-hover);
  }

  &:hover .card__elevation {
    --md-elevation-level: 2;
  }

  &:active {
    opacity: 0.95;
  }

  &:active .card__elevation {
    --md-elevation-level: 1;
  }
}

/* Warning variant hover */
.card--warning.card--clickable:hover {
  background: color-mix(in srgb, var(--color-warning) 12%, var(--color-surface));
}

.card--warning.card--clickable:hover .card__elevation {
  --md-elevation-level: 1;
}

/* Danger variant hover */
.card--danger.card--clickable:hover {
  background: color-mix(in srgb, var(--color-error) 10%, var(--color-surface));
}

.card--danger.card--clickable:hover .card__elevation {
  --md-elevation-level: 1;
}

/* Success variant hover */
.card--success.card--clickable:hover {
  background: color-mix(in srgb, var(--color-success) 12%, var(--color-surface));
}

.card--success.card--clickable:hover .card__elevation {
  --md-elevation-level: 1;
}

.card--no-padding {
  --card-padding: 0;
}

/* === Header === */
.card__header {
  position: relative;
  z-index: 1;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--card-gap);
  box-sizing: border-box;
  width: 100%;
  height: 65px;
  min-height: 0; /* Allow flex shrinking */
  padding: 0 var(--card-padding);
  border-bottom: 1px solid var(--color-border);
}

.card__title-section {
  display: flex;
  flex: 1;
  align-items: center;
  gap: var(--space-2);
  min-width: 0; /* Allow flex shrinking */
}

.card__icon {
  flex-shrink: 0;
}

.card__title {
  min-width: 0; /* Allow text truncation */
  margin: 0;
  font-size: var(--md-sys-typescale-title-medium-size); /* 16px */
  font-weight: var(--md-sys-typescale-title-medium-weight); /* 500 */
  color: var(--color-text-primary);
}

.card__subtitle {
  margin: 0;
  margin-top: var(--space-1);
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.card__actions {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: var(--space-2);
}

/* === Body === */
.card__body {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0; /* Allow flex shrinking */
  overflow-y: auto;
}

/* When there's a header, reduce top padding of body */
.card:has(.card__header) .card__body {
  padding: var(--card-gap);
}

/* === Footer === */
.card__footer {
  position: relative;
  z-index: 1;

  /* padding: var(--card-padding); */
  border-top: 1px solid var(--color-border);

  /* margin-top: var(--card-gap); */
}

/* When body is empty, remove bottom padding */
.card:not(:has(.card__body)) .card__footer {
  margin-top: 0;
  padding-top: var(--card-gap);
  border-top: none;
}

/* === Focus Styles === */
.card--clickable:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

/* === Loading State === */
.card--loading {
  opacity: 0.7;
  pointer-events: none;
}

.card--loading::after {
  position: absolute;
  inset: 0;
  z-index: 2;
  background: color-mix(in srgb, var(--md-sys-color-on-surface) 4%, transparent);
  pointer-events: none;
  content: '';
}
</style>
