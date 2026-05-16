<template>
  <div
    class="md-tooltip-wrapper"
    @mouseenter="handleMouseEnter"
    @mouseleave="handleMouseLeave"
    @focus="handleFocus"
    @blur="handleBlur"
  >
    <slot :show="show" />

    <Transition name="md-tooltip">
      <div
        v-if="show"
        ref="tooltipRef"
        :class="tooltipClasses"
        role="tooltip"
        :aria-hidden="!show"
      >
        <div class="md-tooltip__surface">
          <!-- 支持富文本内容 (Rich Tooltip) -->
          <slot name="content">{{ text }}</slot>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useTimeoutFn } from '@vueuse/core'
import type { TooltipProps } from './Tooltip.d'

defineOptions({ name: 'Tooltip' })

const props = withDefaults(defineProps<TooltipProps>(), {
  placement: 'top',
  delay: 500, // MD3 推荐 500ms 延迟
  disabled: false,
  offset: 'sm' // MD3 推荐较小的偏移
})

const show = ref(false)
const tooltipRef = ref<HTMLElement>()

// 延迟显示
const { start: startShowTimer, stop: stopShowTimer } = useTimeoutFn(
  () => {
    if (!props.disabled) {
      show.value = true
    }
  },
  props.delay,
  { immediate: false }
)

// 延迟隐藏（更短的延迟）
const { start: startHideTimer, stop: stopHideTimer } = useTimeoutFn(
  () => {
    show.value = false
  },
  150, // MD3 推荐快速隐藏
  { immediate: false }
)

const tooltipClasses = computed(() => [
  'md-tooltip',
  `md-tooltip--${props.placement}`,
  `md-tooltip--offset-${props.offset}`,
  {
    'md-tooltip--disabled': props.disabled
  }
])

function handleMouseEnter() {
  stopHideTimer()
  startShowTimer()
}

function handleMouseLeave() {
  stopShowTimer()
  startHideTimer()
}

function handleFocus() {
  stopHideTimer()
  startShowTimer()
}

function handleBlur() {
  stopShowTimer()
  startHideTimer()
}
</script>

<style scoped>
/* ===== Material Design 3 Tooltip ===== */

.md-tooltip-wrapper {
  position: relative;
  display: inline-block;
}

.md-tooltip {
  position: absolute;
  z-index: var(--z-tooltip, 1000);
  width:max-content;
  
  /* 
   * 宽度设置：
   * - Plain Tooltip (纯文本): 自动宽度，最大 200px
   * - Rich Tooltip (富文本): 自动宽度，最大 800px
   * 实际项目中需要更宽的宽度以容纳多行文本和列表
   */
  max-width: 500px;
  pointer-events: none;
}

/* ===== Tooltip Surface (MD3 标准) ===== */
.md-tooltip__surface {
  /* MD3 Spacing: 4dp padding for plain, 8-16dp for rich */
  padding: var(--spacing-2) var(--spacing-3);
  
  /* MD3 Shape: Small (4dp) */
  border-radius: var(--radius-sm);
  
  /* MD3 Typography: Body Small (12sp) */
  font-size: var(--md-sys-typescale-body-small-size);
  font-weight: var(--md-sys-typescale-body-small-weight);
  line-height: var(--md-sys-typescale-body-small-line-height);
  letter-spacing: var(--md-sys-typescale-body-small-tracking);
  white-space: normal;
  
  /* MD3 Color: Inverse Surface */
  color: var(--md-sys-color-inverse-on-surface);
  background-color: var(--md-sys-color-inverse-surface);
  overflow-wrap: break-word;
  
  /* MD3 Elevation: Level 2 */
  box-shadow: var(--md-sys-elevation-2);
}

/* ===== Rich Tooltip 样式 (支持标题、列表等) ===== */
.md-tooltip__surface :deep(h3),
.md-tooltip__surface :deep(strong) {
  margin: 0 0 var(--spacing-1) 0;
  font-size: var(--md-sys-typescale-body-medium-size);
  font-weight: var(--md-sys-typescale-body-medium-weight);
  color: var(--md-sys-color-inverse-on-surface);
}

.md-tooltip__surface :deep(p) {
  margin: var(--spacing-1) 0;
}

.md-tooltip__surface :deep(p:first-child) {
  margin-top: 0;
}

.md-tooltip__surface :deep(p:last-child) {
  margin-bottom: 0;
}

.md-tooltip__surface :deep(ul) {
  margin: var(--spacing-1) 0;
  padding-left: var(--spacing-4);
}

.md-tooltip__surface :deep(li) {
  margin: var(--spacing-1) 0;
}

.md-tooltip__surface :deep(br) {
  display: block;
  margin-top: var(--spacing-1);
  content: '';
}

/* ===== Positioning (基于 placement) ===== */

/* Top */
.md-tooltip--top {
  left: 50%;
  
  /* 防止超出视口 */
  max-width: min(800px, calc(100vw - 32px));
  transform: translateX(-50%);
}

.md-tooltip--top.md-tooltip--offset-xs {
  bottom: calc(100% + var(--spacing-1));
}

.md-tooltip--top.md-tooltip--offset-sm {
  bottom: calc(100% + var(--spacing-2));
}

.md-tooltip--top.md-tooltip--offset-md {
  bottom: calc(100% + var(--spacing-3));
}

.md-tooltip--top.md-tooltip--offset-lg {
  bottom: calc(100% + var(--spacing-4));
}

.md-tooltip--top.md-tooltip--offset-xl {
  bottom: calc(100% + var(--spacing-6));
}

/* Bottom */
.md-tooltip--bottom {
  left: 50%;
  
  /* 防止超出视口 */
  max-width: min(800px, calc(100vw - 32px));
  transform: translateX(-50%);
}

.md-tooltip--bottom.md-tooltip--offset-xs {
  top: calc(100% + var(--spacing-1));
}

.md-tooltip--bottom.md-tooltip--offset-sm {
  top: calc(100% + var(--spacing-2));
}

.md-tooltip--bottom.md-tooltip--offset-md {
  top: calc(100% + var(--spacing-3));
}

.md-tooltip--bottom.md-tooltip--offset-lg {
  top: calc(100% + var(--spacing-4));
}

.md-tooltip--bottom.md-tooltip--offset-xl {
  top: calc(100% + var(--spacing-6));
}

/* Left */
.md-tooltip--left {
  top: 50%;
  
  /* 防止超出视口 */
  max-width: min(800px, calc(100vw - 32px));
  transform: translateY(-50%);
}

.md-tooltip--left.md-tooltip--offset-xs {
  right: calc(100% + var(--spacing-1));
}

.md-tooltip--left.md-tooltip--offset-sm {
  right: calc(100% + var(--spacing-2));
}

.md-tooltip--left.md-tooltip--offset-md {
  right: calc(100% + var(--spacing-3));
}

.md-tooltip--left.md-tooltip--offset-lg {
  right: calc(100% + var(--spacing-4));
}

.md-tooltip--left.md-tooltip--offset-xl {
  right: calc(100% + var(--spacing-6));
}

/* Right */
.md-tooltip--right {
  top: 50%;
  
  /* 防止超出视口 */
  max-width: min(800px, calc(100vw - 32px));
  transform: translateY(-50%);
}

.md-tooltip--right.md-tooltip--offset-xs {
  left: calc(100% + var(--spacing-1));
}

.md-tooltip--right.md-tooltip--offset-sm {
  left: calc(100% + var(--spacing-2));
}

.md-tooltip--right.md-tooltip--offset-md {
  left: calc(100% + var(--spacing-3));
}

.md-tooltip--right.md-tooltip--offset-lg {
  left: calc(100% + var(--spacing-4));
}

.md-tooltip--right.md-tooltip--offset-xl {
  left: calc(100% + var(--spacing-6));
}

/* ===== MD3 Transitions (Emphasized Easing) ===== */
.md-tooltip-enter-active {
  transition:
    opacity var(--md-sys-motion-duration-short2) var(--md-sys-motion-easing-emphasized),
    transform var(--md-sys-motion-duration-short2) var(--md-sys-motion-easing-emphasized);
}

.md-tooltip-leave-active {
  transition:
    opacity var(--md-sys-motion-duration-short1) var(--md-sys-motion-easing-emphasized),
    transform var(--md-sys-motion-duration-short1) var(--md-sys-motion-easing-emphasized);
}

.md-tooltip-enter-from {
  opacity: 0;
  transform: scale(0.8);
}

.md-tooltip-leave-to {
  opacity: 0;
  transform: scale(0.8);
}

/* Top placement 特殊动画 */
.md-tooltip--top.md-tooltip-enter-from {
  transform: translateX(-50%) scale(0.8) translateY(4px);
}

.md-tooltip--top.md-tooltip-leave-to {
  transform: translateX(-50%) scale(0.8) translateY(4px);
}

/* Bottom placement 特殊动画 */
.md-tooltip--bottom.md-tooltip-enter-from {
  transform: translateX(-50%) scale(0.8) translateY(-4px);
}

.md-tooltip--bottom.md-tooltip-leave-to {
  transform: translateX(-50%) scale(0.8) translateY(-4px);
}

/* Left placement 特殊动画 */
.md-tooltip--left.md-tooltip-enter-from {
  transform: translateY(-50%) scale(0.8) translateX(4px);
}

.md-tooltip--left.md-tooltip-leave-to {
  transform: translateY(-50%) scale(0.8) translateX(4px);
}

/* Right placement 特殊动画 */
.md-tooltip--right.md-tooltip-enter-from {
  transform: translateY(-50%) scale(0.8) translateX(-4px);
}

.md-tooltip--right.md-tooltip-leave-to {
  transform: translateY(-50%) scale(0.8) translateX(-4px);
}

/* ===== Disabled State ===== */
.md-tooltip--disabled {
  display: none;
}
</style>
