<!--
  AcuityCard - 卡片组件
  通用卡片布局组件，支持标题、内容、操作区域
-->
<template>
  <div
    :class="cardClasses"
    @click="props.clickable ? $emit('click', $event) : undefined"
  >
    <!-- Header -->
    <header v-if="$slots.header || title" class="card__header">
      <slot name="header">
        <div class="card__title-section">
          <LucideIcon
            v-if="icon"
            :name="icon"
            :color="iconColor"
            class="card__icon"
          />
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
      <footer
        v-if="(props.footerVisible ?? !!$slots.footer) && $slots.footer"
        class="card__footer"
      >
        <slot name="footer" />
      </footer>
    </Transition>
  </div>
</template>

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

// 类型已从 Card.types.ts 导入
</script>

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

@keyframes card-loading {
  0% {
    transform: translateX(-100%);
  }

  100% {
    transform: translateX(100%);
  }
}

.card {
  position: relative;

  /* Base styles */
  display: flex;
  flex-direction: column;
  border-radius: var(--radius-lg);
  background-color: var(--color-surface);

  /* ✨ 性能优化 */
  will-change: box-shadow, border-color;

  /* ✨ 优化过渡动画：阴影 + 边框 + 变换 */
  transition:
    box-shadow var(--anim-duration-normal) var(--anim-ease-emphasized),
    border-color var(--anim-duration-fast) var(--anim-ease-standard),
    transform var(--anim-duration-fast) var(--anim-ease-spring),
    opacity var(--anim-duration-instant) var(--anim-ease-standard);
  overflow: hidden;
}

/* === Variants === */
.card--default {
  border: 1px solid var(--color-border);
  
  /* ✨ 添加轻微阴影 */
  box-shadow: 0 1px 2px rgb(0 0 0 / 3%);
}

.card--outlined {
  border: 2px solid var(--color-border);
  
  /* ✨ 添加轻微阴影 */
  box-shadow: 0 1px 2px rgb(0 0 0 / 3%);
}

.card--elevated {
  border: 1px solid var(--color-border);
  
  /* ✨ 优化阴影：多层次阴影 */
  box-shadow: 
    0 2px 8px rgb(0 0 0 / 6%),
    0 1px 4px rgb(0 0 0 / 4%),
    0 0 0 1px rgb(255 255 255 / 3%);
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
.card--hover:hover {
  /* ✨ 悬停效果：阴影加深 */
  box-shadow: 
    0 8px 24px rgb(0 0 0 / 10%),
    0 4px 12px rgb(0 0 0 / 8%),
    0 0 0 1px rgb(255 255 255 / 5%);
}

.card--clickable {
  cursor: pointer;

  &:hover {
    border-color: var(--color-border-hover);
    
    /* ✨ 悬停效果：阴影加深 */
    box-shadow: 
      0 4px 12px rgb(0 0 0 / 8%),
      0 2px 6px rgb(0 0 0 / 6%);
  }

  &:active {
    opacity: 0.95;

    /* ✨ 点击效果：阴影减弱 */
    box-shadow: 
      0 1px 3px rgb(0 0 0 / 6%),
      0 1px 2px rgb(0 0 0 / 4%);
  }
}

.card--no-padding {
  --card-padding: 0;
}

/* === Header === */
.card__header {
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
  background: linear-gradient(
    90deg,
    transparent,
    rgb(255 255 255 / 40%),
    transparent
  );
  animation: card-loading 1.5s infinite;
  content: '';

  /* ✅ 性能优化：提示浏览器优化动画性能 */
  will-change: transform;
}

/* === Footer slide transition (可按需启用) === */
.card-footer-slide-enter-active,
.card-footer-slide-leave-active {
  transition:
    transform var(--anim-duration-fast) var(--anim-ease-standard),
    opacity var(--anim-duration-fast) var(--anim-ease-standard);
  will-change: transform, opacity;
}

.card-footer-slide-enter-from {
  opacity: 0;
  transform: translateY(12px);
}

.card-footer-slide-leave-to {
  opacity: 0;
  transform: translateY(12px);
}
</style>
