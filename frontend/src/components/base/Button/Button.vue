<!--
  AcuityButton - 按钮组件
  高性能、可复用的按钮组件，支持多种变体和尺寸
-->
<template>
  <component
    :is="component"
    ref="buttonRef"
    :class="buttonClasses"
    :disabled="disabled || loading"
    :type="component === 'button' ? type : undefined"
    :href="component === 'a' ? href : undefined"
    :target="component === 'a' ? target : undefined"
    :style="{
      '--ripple-duration': `${ANIMATION_CONFIG.DURATION.RIPPLE}ms`,
      '--spinner-duration': `${ANIMATION_CONFIG.DURATION.SPINNER}ms`
    }"
    v-bind="$attrs"
    @click="handleClick"
  >
    <!-- ✨ Material Design Ripple 容器 -->
    <span class="btn__ripple-container" aria-hidden="true"></span>

    <!-- Loading State -->
    <div v-if="loading" class="btn__spinner">
      <div class="btn__spinner-icon"></div>
    </div>

    <!-- Icon (Left) -->
    <LucideIcon
      v-if="iconLeft && !loading"
      :name="iconLeft"
      :size="iconSize"
      class="btn__icon btn__icon--left"
    />

    <!-- Content -->
    <span v-if="$slots.default" class="btn__content">
      <slot />
    </span>

    <!-- Icon (Right) -->
    <LucideIcon
      v-if="iconRight"
      :name="iconRight"
      :size="iconSize"
      class="btn__icon btn__icon--right"
    />
  </component>
</template>

<script setup lang="ts">
import { computed, ref, useSlots } from 'vue'
import type { ButtonProps, ButtonEmits } from './Button.d'
import { LucideIcon } from '@/components/base/LucideIcon'
import { ANIMATION_CONFIG } from '@/config/constants'

/**
 * 按钮默认属性配置，保证未显式传值时仍具备一致的视觉与行为表现。
 */
const props = withDefaults(defineProps<ButtonProps>(), {
  variant: 'primary',
  size: 'md',
  component: 'button',
  type: 'button',
  borderless: false,
  ripple: true // ✨ 默认启用 Ripple 效果
})

const emit = defineEmits<ButtonEmits>()

// Computed Classes
const slots = useSlots()
const buttonRef = ref<HTMLElement | null>(null)

defineOptions({
  components: {
    LucideIcon
  }
})

/**
 * 根据按钮属性及插槽内容生成样式类名集合。
 */
const buttonClasses = computed(() => [
  'btn',
  `btn--${props.variant}`,
  `btn--${props.size}`,
  {
    'btn--block': props.block,
    'btn--loading': props.loading,
    'btn--disabled': props.disabled,
    'btn--icon-only': props.iconOnly || (!slots.default && (props.iconLeft || props.iconRight)),
    'btn--borderless': props.borderless
  }
])

// Icon size based on button size
const iconSize = computed((): 'sm' | 'md' | 'lg' => {
  const sizeMap: Record<string, 'sm' | 'md' | 'lg'> = {
    sm: 'sm',
    md: 'md',
    lg: 'lg'
  }
  return sizeMap[props.size] || 'md'
})

/**
 * ✨ 创建 Material Design Ripple 水波纹效果
 *
 * @param event - 鼠标点击事件
 *
 * 实现原理：
 * 1. 计算点击位置相对于按钮的坐标
 * 2. 动态创建 span 元素作为波纹
 * 3. 设置波纹的初始位置和尺寸
 * 4. 添加 CSS 动画类触发扩散效果
 * 5. 动画结束后自动移除元素
 */
const createRipple = (event: MouseEvent) => {
  if (!props.ripple || !buttonRef.value) return

  const button = buttonRef.value as HTMLElement
  const rippleContainer = button.querySelector(
    '.btn__ripple-container'
  ) as HTMLElement

  if (!rippleContainer) return

  // 计算波纹的直径（取按钮宽高中的较大值，确保完全覆盖）
  const diameter = Math.max(button.clientWidth, button.clientHeight)
  const radius = diameter / 2

  // 计算点击位置相对于按钮的坐标
  const rect = button.getBoundingClientRect()
  const x = event.clientX - rect.left - radius
  const y = event.clientY - rect.top - radius

  // 创建波纹元素
  const ripple = document.createElement('span')
  ripple.className = 'btn__ripple'
  ripple.style.width = ripple.style.height = `${diameter}px`
  ripple.style.left = `${x}px`
  ripple.style.top = `${y}px`

  // 移除旧的波纹（如果有）
  const existingRipple = rippleContainer.querySelector('.btn__ripple')
  if (existingRipple) {
    existingRipple.remove()
  }

  // 添加新波纹
  rippleContainer.appendChild(ripple)

  // 动画结束后移除元素
  ripple.addEventListener('animationend', () => {
    ripple.remove()
  })
}

// Click handler
const handleClick = (event: Event) => {
  if (props.disabled || props.loading) {
    event.preventDefault()
    return
  }

  // ✨ 触发 Ripple 效果
  createRipple(event as MouseEvent)

  emit('click', event)
}
</script>

<style scoped>
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/**
 * ✨ Ripple 扩散 + 淡出动画
 *
 * 0%   - 开始：不透明度 0.3，缩放 0（点击位置）
 * 50%  - 中期：不透明度保持，缩放到 1（完全扩散）
 * 100% - 结束：淡出到不透明度 0
 */
@keyframes ripple-animation {
  0% {
    opacity: 0.3;
    transform: scale(0);
  }

  50% {
    opacity: 0.2;
  }

  100% {
    opacity: 0;
    transform: scale(1);
  }
}

/**
 * ♿ 可访问性：尊重用户的动画偏好
 * 如果用户设置了"减少动画"，则禁用 Ripple 效果
 */
@media (prefers-reduced-motion: reduce) {
  .btn__ripple {
    opacity: 0.2;
    transform: scale(1);
    transition: opacity 0.1s ease;
    animation: none;
  }

  .btn__ripple-container:active .btn__ripple {
    opacity: 0;
  }
}

@keyframes fade-in {
  from {
    opacity: 0;
  }

  to {
    opacity: 1;
  }
}

.btn {
  /* Base styles */
  position: relative;
  display: inline-flex;
  justify-content: center;
  align-items: center;
  gap: var(--space-2);
  border: 1px solid transparent;
  border-radius: var(--radius-base);
  font-family: var(--font-family-base);
  font-weight: 500;
  text-decoration: none;
  white-space: nowrap;
  cursor: pointer;
  user-select: none;

  /* ✨ 性能优化：提示浏览器优化变换和阴影 */
  will-change: transform, box-shadow;

  /* 过渡动画：颜色 + 阴影 + 变换 */
  transition:
    background-color var(--anim-duration-fast) var(--anim-ease-standard),
    border-color var(--anim-duration-fast) var(--anim-ease-standard),
    color var(--anim-duration-fast) var(--anim-ease-standard),
    box-shadow var(--anim-duration-normal) var(--anim-ease-emphasized),
    transform var(--anim-duration-fast) var(--anim-ease-spring),
    opacity var(--anim-duration-instant) var(--anim-ease-standard);

  /* Focus styles */
  &:focus-visible {
    outline: 2px solid var(--color-primary);
    outline-offset: 2px;
  }

  /* ✨ 悬停微交互：阴影加深 */
  &:hover:not(.btn--disabled, .btn--loading) {
    box-shadow: 0 4px 12px rgb(0 0 0 / 15%);
    opacity: 0.92;
  }

  /* ✨ 点击微交互：阴影减弱 */
  &:active:not(.btn--disabled, .btn--loading) {
    box-shadow: 0 1px 3px rgb(0 0 0 / 12%);
    opacity: 0.85;
  }
}

/* === Size Variants === */
.btn--sm {
  min-width: var(--button-height-sm);
  height: var(--button-height-sm);
  padding: 0 var(--space-3);
  font-size: var(--font-size-sm);
}

.btn--md {
  min-width: var(--button-height-md);
  height: var(--button-height-md);
  padding: 0 var(--space-4);
  font-size: var(--font-size-base);
}

.btn--lg {
  min-width: var(--button-height-lg);
  height: var(--button-height-lg);
  padding: 0 var(--space-6);
  font-size: var(--font-size-lg);
}

/* === Color Variants === */
.btn--primary {
  border-color: var(--color-primary);
  color: var(--color-text-on-primary);
  
  /* ✨ 渐变背景：从主色到稍深的主色 */
  background: linear-gradient(
    135deg,
    var(--color-primary) 0%,
    var(--color-primary-hover) 100%
  );
  
  /* ✨ 初始阴影：带有主色调的彩色阴影 */
  box-shadow: 
    0 2px 4px rgb(0 0 0 / 10%),
    0 0 0 0 color-mix(in srgb, var(--color-primary) 30%, transparent);

  &:hover:not(.btn--disabled, .btn--loading) {
    border-color: var(--color-primary-hover);
    
    /* ✨ 悬停时渐变更深 */
    background: linear-gradient(
      135deg,
      var(--color-primary-hover) 0%,
      var(--color-primary-active) 100%
    );
    
    /* ✨ 悬停时阴影更明显，带有彩色光晕 */
    box-shadow: 
      0 6px 16px rgb(0 0 0 / 15%),
      0 0 20px color-mix(in srgb, var(--color-primary) 40%, transparent);
  }

  &:active:not(.btn--disabled, .btn--loading) {
    border-color: var(--color-primary-active);
    background: var(--color-primary-active);
    
    /* ✨ 点击时阴影减弱 */
    box-shadow: 
      0 1px 3px rgb(0 0 0 / 12%),
      0 0 8px color-mix(in srgb, var(--color-primary) 20%, transparent);
  }
}

.btn--secondary {
  border-color: var(--color-secondary);
  color: var(--color-text-on-primary);
  
  /* ✨ 渐变背景 */
  background: linear-gradient(
    135deg,
    var(--color-secondary) 0%,
    var(--color-secondary-hover) 100%
  );
  
  /* ✨ 彩色阴影 */
  box-shadow: 
    0 2px 4px rgb(0 0 0 / 10%),
    0 0 0 0 color-mix(in srgb, var(--color-secondary) 30%, transparent);

  &:hover:not(.btn--disabled, .btn--loading) {
    border-color: var(--color-secondary-hover);
    color: var(--color-text-on-primary);
    background: linear-gradient(
      135deg,
      var(--color-secondary-hover) 0%,
      var(--color-secondary-active) 100%
    );
    box-shadow: 
      0 6px 16px rgb(0 0 0 / 15%),
      0 0 20px color-mix(in srgb, var(--color-secondary) 40%, transparent);
  }

  &:active:not(.btn--disabled, .btn--loading) {
    border-color: var(--color-secondary-active);
    color: var(--color-text-on-primary);
    background: var(--color-secondary-active);
    box-shadow: 
      0 1px 3px rgb(0 0 0 / 12%),
      0 0 8px color-mix(in srgb, var(--color-secondary) 20%, transparent);
  }
}

.btn--outline {
  border-color: var(--color-primary);
  color: var(--color-primary);
  background-color: transparent;
  
  /* ✨ 轻微的阴影 */
  box-shadow: 0 1px 2px rgb(0 0 0 / 5%);

  &:hover:not(.btn--disabled, .btn--loading) {
    color: var(--color-text-on-primary);
    background-color: var(--color-primary);
    
    /* ✨ 悬停时显示彩色阴影 */
    box-shadow: 
      0 4px 12px rgb(0 0 0 / 12%),
      0 0 16px color-mix(in srgb, var(--color-primary) 30%, transparent);
  }
  
  &:active:not(.btn--disabled, .btn--loading) {
    box-shadow: 
      0 1px 3px rgb(0 0 0 / 10%),
      0 0 8px color-mix(in srgb, var(--color-primary) 20%, transparent);
  }
}

.btn--ghost {
  border-color: transparent;
  color: var(--color-primary);
  background-color: transparent;

  &:hover:not(.btn--disabled, .btn--loading) {
    background-color: var(--color-surface-hover);
    
    /* ✨ 轻微阴影 */
    box-shadow: 0 2px 6px rgb(0 0 0 / 8%);
  }
  
  &:active:not(.btn--disabled, .btn--loading) {
    box-shadow: 0 1px 2px rgb(0 0 0 / 6%);
  }
}

/* Borderless 使用高特异性确保覆盖其他变体 */
.btn.btn--borderless {
  gap: 0;
  width: auto;
  min-width: auto;
  height: auto;
  padding: 0;
  border-color: transparent;
  color: var(--color-text-secondary);
  background-color: transparent;
}

.btn--borderless:hover:not(.btn--disabled, .btn--loading) {
  color: var(--color-primary);
  background-color: transparent;
}

.btn--text {
  border-color: transparent;
  color: var(--color-primary);
  background-color: transparent;

  &:hover:not(.btn--disabled, .btn--loading) {
    text-decoration: none;
    color: var(--color-primary-dark);
  }
}

/* === States === */
.btn--disabled {
  opacity: 0.6;
  cursor: not-allowed;
  pointer-events: none;
}

.btn--loading {
  cursor: wait;
  pointer-events: none;
}

.btn--block {
  width: 100%;
}

.btn--icon-only {
  padding: 0;
  aspect-ratio: 1;
  
  /* ✨ icon-only 按钮的特殊样式 */
  border-radius: var(--radius-lg);
  
  /* ✨ 悬停时加深阴影 */
  &:hover:not(.btn--disabled, .btn--loading) {
    box-shadow: 0 2px 8px rgb(0 0 0 / 15%);
    opacity: 0.9;
  }
  
  &:active:not(.btn--disabled, .btn--loading) {
    box-shadow: none;
    opacity: 0.8;
  }
}

/* === Icons === */
.btn__icon {
  flex-shrink: 0;
}

.btn--borderless .btn__icon {
  margin: 0;
}

.btn__icon--left {
  margin-left: calc(var(--space-1) * -1);
}

.btn__icon--right {
  margin-right: calc(var(--space-1) * -1);
}

/* === Loading Spinner === */
.btn__spinner {
  position: absolute;
  inset: 0;
  display: flex;
  justify-content: center;
  align-items: center;
  
  /* ✨ 淡入动画 */
  animation: fade-in var(--anim-duration-fast) var(--anim-ease-standard);
}

.btn__spinner-icon {
  width: 1.2rem;
  height: 1.2rem;
  border: 2.5px solid transparent;
  border-top: 2.5px solid currentColor;
  border-right: 2.5px solid currentColor;
  border-radius: 50%;

  /* ✅ 性能优化：提示浏览器优化动画性能 */
  will-change: transform;

  /* ✨ 更流畅的旋转动画 */
  animation: spin var(--spinner-duration) cubic-bezier(0.68, -0.55, 0.27, 1.55) infinite;
}

/* === Content === */
.btn__content {
  display: flex;
  align-items: center;
  gap: inherit;
}

/* === Loading state content visibility === */
.btn--loading .btn__content,
.btn--loading .btn__icon {
  opacity: 0;
}

/* ===============================================
   ✨ Material Design Ripple 水波纹效果
   =============================================== */

/**
 * Ripple 容器：用于裁剪波纹区域
 * - 必须与按钮尺寸一致
 * - overflow: hidden 裁剪超出范围的波纹
 * - pointer-events: none 避免阻挡点击事件
 */
.btn__ripple-container {
  position: absolute;
  inset: 0;

  /* 确保 ripple 在内容之下 */
  z-index: 0;
  border-radius: inherit;
  pointer-events: none;
  overflow: hidden;
}

/**
 * 单个 Ripple 波纹
 * - 圆形（border-radius: 50%）
 * - 从点击位置开始扩散
 * - 使用 transform: scale() 实现缩放
 * - 淡入淡出动画
 */
.btn__ripple {
  position: absolute;
  border-radius: 50%;
  background-color: currentColor;

  /* ✨ 关键：使用半透明白色作为波纹颜色 */
  opacity: 0;

  /* 确保不阻挡内容交互 */
  pointer-events: none;

  /* 从 0.3 倍缩放到完整尺寸 */
  transform: scale(0);

  /* ✅ Material Design 标准动画时长 - 使用统一配置 */
  animation: ripple-animation var(--ripple-duration) ease-out;

  /* ✅ 性能优化：提示浏览器优化动画性能 */
  will-change: transform, opacity;
}

/**
 * 🎨 不同按钮变体的 Ripple 颜色适配
 *
 * - primary/secondary: 白色波纹（因为按钮背景是深色）
 * - outline/ghost/text: 使用主题色波纹
 * - 禁用/加载状态：禁用 Ripple
 */
.btn--primary .btn__ripple,
.btn--secondary .btn__ripple {
  background-color: rgb(255 255 255 / 40%);
}

.btn--outline .btn__ripple,
.btn--ghost .btn__ripple,
.btn--text .btn__ripple {
  background-color: var(--color-primary);
}

.btn--borderless .btn__ripple {
  background-color: var(--color-primary);
  opacity: 0.15;
}

/* 🚫 禁用/加载状态下不显示 Ripple */
.btn--disabled .btn__ripple-container,
.btn--loading .btn__ripple-container {
  display: none;
}
</style>
