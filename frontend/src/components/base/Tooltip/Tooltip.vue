<template>
  <div
    class="acuity-tooltip-wrapper"
    @mouseenter="show = true"
    @mouseleave="show = false"
    @focus="show = true"
    @blur="show = false"
  >
    <slot :show="show" />

    <Transition name="tooltip">
      <div v-if="show" ref="tooltipRef" :class="tooltipClasses">
        <div class="acuity-tooltip-content">
          <slot name="content">{{ text }}</slot>
        </div>
        <div class="acuity-tooltip-arrow"></div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import type { TooltipProps } from './Tooltip.d'

const props = withDefaults(defineProps<TooltipProps>(), {
  placement: 'top',
  delay: 300,
  disabled: false,
  offset: 'xs'
})

const show = ref(false)
const tooltipRef = ref<HTMLElement>()

const tooltipClasses = computed(() => [
  'acuity-tooltip',
  `acuity-tooltip--${props.placement}`,
  `offset-${props.offset}`,
  {
    'acuity-tooltip--disabled': props.disabled
  }
])

// 使用相对定位与类控制偏移，无需内联样式
</script>

<style scoped>
.acuity-tooltip-wrapper {
  position: relative;
  display: inline-block;
}

.acuity-tooltip {
  position: absolute;
  z-index: var(--z-tooltip);
  min-width: 500px;
  max-width: 1000px;
  pointer-events: none;
}

.acuity-tooltip-content {
  padding: var(--spacing-3);
  border-radius: var(--radius-sm);
  font-size: var(--text-sm);
  line-height: 1.6;
  white-space: normal;
  color: var(--color-on-surface-inverse);
  background: var(--color-surface-inverse);
  overflow-wrap: break-word;
  box-shadow:
    0 4px 12px var(--color-shadow-015),
    0 2px 6px var(--color-shadow-010),
    0 0 1px var(--color-shadow-020);
}

.acuity-tooltip-content h3 {
  margin: 0 0 var(--spacing-2) 0;
  font-size: var(--text-base);
  font-weight: var(--font-semibold);
}

.acuity-tooltip-content p {
  margin: var(--spacing-2) 0;
}

.acuity-tooltip-content p:last-child {
  margin-bottom: 0;
}

.acuity-tooltip-content ul {
  margin: var(--spacing-2) 0;
  padding-left: var(--spacing-4);
}

.acuity-tooltip-content li {
  margin: var(--spacing-1) 0;
}

.acuity-tooltip-arrow {
  position: absolute;
  width: 0;
  height: 0;
  border: var(--spacing-1-5) solid transparent;
}

.acuity-tooltip--top .acuity-tooltip-arrow {
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  border-top-color: var(--color-surface-inverse);
}

.acuity-tooltip--bottom .acuity-tooltip-arrow {
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%);
  border-bottom-color: var(--color-surface-inverse);
}

.acuity-tooltip--left .acuity-tooltip-arrow {
  top: 50%;
  left: 100%;
  transform: translateY(-50%);
  border-left-color: var(--color-surface-inverse);
}

.acuity-tooltip--right .acuity-tooltip-arrow {
  top: 50%;
  right: 100%;
  transform: translateY(-50%);
  border-right-color: var(--color-surface-inverse);
}

/* 触发器与内容的偏移（基于设计系统 spacing token） */
.acuity-tooltip.offset-xs.acuity-tooltip--top {
  bottom: calc(100% + var(--spacing-xs));
}

.acuity-tooltip.offset-sm.acuity-tooltip--top {
  bottom: calc(100% + var(--spacing-sm));
}

.acuity-tooltip.offset-md.acuity-tooltip--top {
  bottom: calc(100% + var(--spacing-md));
}

.acuity-tooltip.offset-lg.acuity-tooltip--top {
  bottom: calc(100% + var(--spacing-lg));
}

.acuity-tooltip.offset-xl.acuity-tooltip--top {
  bottom: calc(100% + var(--spacing-xl));
}

.acuity-tooltip.offset-xs.acuity-tooltip--bottom {
  top: calc(100% + var(--spacing-xs));
}

.acuity-tooltip.offset-sm.acuity-tooltip--bottom {
  top: calc(100% + var(--spacing-sm));
}

.acuity-tooltip.offset-md.acuity-tooltip--bottom {
  top: calc(100% + var(--spacing-md));
}

.acuity-tooltip.offset-lg.acuity-tooltip--bottom {
  top: calc(100% + var(--spacing-lg));
}

.acuity-tooltip.offset-xl.acuity-tooltip--bottom {
  top: calc(100% + var(--spacing-xl));
}

.acuity-tooltip.offset-xs.acuity-tooltip--left {
  right: calc(100% + var(--spacing-xs));
}

.acuity-tooltip.offset-sm.acuity-tooltip--left {
  right: calc(100% + var(--spacing-sm));
}

.acuity-tooltip.offset-md.acuity-tooltip--left {
  right: calc(100% + var(--spacing-md));
}

.acuity-tooltip.offset-lg.acuity-tooltip--left {
  right: calc(100% + var(--spacing-lg));
}

.acuity-tooltip.offset-xl.acuity-tooltip--left {
  right: calc(100% + var(--spacing-xl));
}

.acuity-tooltip.offset-xs.acuity-tooltip--right {
  left: calc(100% + var(--spacing-xs));
}

.acuity-tooltip.offset-sm.acuity-tooltip--right {
  left: calc(100% + var(--spacing-sm));
}

.acuity-tooltip.offset-md.acuity-tooltip--right {
  left: calc(100% + var(--spacing-md));
}

.acuity-tooltip.offset-lg.acuity-tooltip--right {
  left: calc(100% + var(--spacing-lg));
}

.acuity-tooltip.offset-xl.acuity-tooltip--right {
  left: calc(100% + var(--spacing-xl));
}

/* Transitions */
.tooltip-enter-active,
.tooltip-leave-active {
  transition: all var(--md-sys-motion-duration-short4)
    var(--md-sys-motion-easing-emphasized);
}

.tooltip-enter-from {
  opacity: 0;
  transform: scale(0.92) translateY(-4px);
}

.tooltip-leave-to {
  opacity: 0;
  transform: scale(0.92) translateY(-4px);
}
</style>
