<!--
  Skeleton 骨架屏组件
  
  基于 Material Design 3 设计规范
  用于在内容加载时显示占位符，提升用户体验和感知性能
  
  特性：
  - 符合 Material Design 3 规范
  - 使用项目 design tokens（颜色、间距、动画）
  - 支持多种变体（文本、圆形、矩形、圆角矩形）
  - 支持多种动画（脉冲、波浪、无动画）
  - 响应式设计，自适应容器宽度
-->
<script setup lang="ts">
import { computed } from 'vue'
import type { SkeletonProps } from './Skeleton.d'

defineOptions({ name: 'Skeleton' })

const props = withDefaults(defineProps<SkeletonProps>(), {
  variant: 'text',
  animation: 'none',
  borderRadius: 'md'
})

/**
 * 计算样式类
 */
const skeletonClasses = computed(() => [
  'skeleton',
  `skeleton--${props.variant}`,
  `skeleton--animation-${props.animation}`,
  props.variant === 'rounded' && `skeleton--radius-${props.borderRadius}`
])

/**
 * 计算内联样式
 */
const skeletonStyles = computed(() => {
  const styles: Record<string, string> = {}

  // 宽度
  if (props.width !== undefined) {
    styles.width = typeof props.width === 'number' ? `${props.width}px` : props.width
  }

  // 高度
  if (props.height !== undefined) {
    styles.height = typeof props.height === 'number' ? `${props.height}px` : props.height
  }

  return styles
})
</script>

<template>
  <div :class="skeletonClasses" :style="skeletonStyles" aria-busy="true" aria-live="polite" />
</template>

<style scoped>
.skeleton {
  /* 相对定位，用于波浪动画 */
  position: relative;

  /* 默认圆角 */
  border-radius: var(--radius-sm);

  /* 使用 Material Design 3 的 surface-variant 颜色 */
  background-color: var(--md-sys-color-surface-variant);

  /* 禁用用户选择 */
  user-select: none;

  /* 禁用指针事件 */
  pointer-events: none;

  /* 隐藏溢出内容（波浪动画需要） */
  overflow: hidden;
}

/* ========== 变体样式 ========== */

/* 文本行变体 */
.skeleton--text {
  /* 文本行默认宽度：100% */
  width: 100%;

  /* 文本行高度：1em（自适应字号） */
  height: 1em;

  /* 文本行底部间距（模拟行间距） */
  margin-bottom: var(--spacing-2);

  /* 文本行圆角：小圆角 */
  border-radius: var(--radius-sm);
}

/* 圆形变体（头像、图标） */
.skeleton--circular {
  /* 圆形默认尺寸：40px（头像标准尺寸） */
  width: 40px;
  height: 40px;

  /* 圆形：完全圆角 */
  border-radius: var(--radius-full);
}

/* 矩形变体（卡片、图片） */
.skeleton--rectangular {
  /* 矩形默认宽度：100% */
  width: 100%;

  /* 矩形默认高度：200px */
  height: 200px;

  /* 矩形：小圆角 */
  border-radius: var(--radius-sm);
}

/* 圆角矩形变体（按钮、标签） */
.skeleton--rounded {
  /* 圆角由 borderRadius prop 控制 */
  width: 100%;
  height: 36px; /* 按钮标准高度 */
}

/* 圆角尺寸变体 */
.skeleton--radius-sm {
  border-radius: var(--radius-sm);
}

.skeleton--radius-md {
  border-radius: var(--radius-md);
}

.skeleton--radius-lg {
  border-radius: var(--radius-lg);
}

.skeleton--radius-full {
  border-radius: var(--radius-full);
}

/* ========== 动画样式 ========== */

/* M3：占位块默认静态；pulse 仅用 opacity transition（非 keyframes） */
.skeleton--animation-pulse {
  transition: opacity var(--md-sys-motion-duration-long2) var(--md-sys-motion-easing-standard);
  animation: none;
}

.skeleton--animation-wave,
.skeleton--animation-none {
  animation: none;
}

/* ========== 可访问性 ========== */

/* 屏幕阅读器提示 */
.skeleton[aria-busy='true'] {
  /* 确保屏幕阅读器能识别加载状态 */
}

/* ========== 基础样式 ========== */
</style>
