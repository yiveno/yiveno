<!--
  LucideIcon - Lucide 图标组件
  基于 lucide-vue-next 的现代图标组件
-->
<script setup lang="ts">
import { computed, type Component } from 'vue'
import type { LucideIconProps } from './LucideIcon.d'
import { lucideIcons, materialToLucideMap } from './icons'

defineOptions({
  name: 'LucideIcon'
})

const props = withDefaults(defineProps<LucideIconProps>(), {
  size: 'md',
  strokeWidth: 2,
  spin: false
})

/**
 * 计算图标尺寸
 */
const computedSize = computed(() => {
  if (typeof props.size === 'number') return props.size
  const sizeMap: Record<string, number> = {
    xs: 12,
    sm: 16,
    md: 20,
    lg: 24,
    xl: 32
  }
  return sizeMap[props.size] ?? 20
})

/**
 * 计算图标颜色
 */
const computedColor = computed(() => {
  if (!props.color) return 'currentColor'

  // 语义化颜色映射到 CSS 变量
  const semanticColors: Record<string, string> = {
    primary: 'var(--md-sys-color-primary)',
    secondary: 'var(--md-sys-color-secondary)',
    error: 'var(--md-sys-color-error)',
    warning: 'var(--color-semantic-warning)',
    success: 'var(--color-semantic-success)',
    info: 'var(--color-semantic-info)',
    muted: 'var(--md-sys-color-outline)'
  }

  if (semanticColors[props.color]) {
    return semanticColors[props.color]
  }

  // CSS 变量
  if (props.color.startsWith('--')) {
    return `var(${props.color})`
  }

  // 直接颜色值
  return props.color
})

/**
 * 获取图标组件
 * 支持 Material Icons 到 Lucide Icons 的自动映射
 */
const iconComponent = computed<Component | null>(() => {
  let iconName = props.name

  // 如果是 icon- 前缀的 Material Icons，尝试映射到 Lucide Icons
  if (iconName.startsWith('icon-')) {
    const mappedName = materialToLucideMap[iconName]
    if (mappedName) {
      iconName = mappedName
    } else if (import.meta.env.DEV) {
      console.warn(`[LucideIcon] Material Icon 映射未找到: ${iconName}`)
    }
  }

  const icon = lucideIcons[iconName]
  if (!icon && import.meta.env.DEV) {
    console.warn(`[LucideIcon] 图标未找到: ${iconName} (原始名称: ${props.name})`)
  }
  return icon || null
})

/**
 * 变换样式（flip / rotate）
 */
const transformStyle = computed(() => {
  const transforms: string[] = []
  if (props.flipH) transforms.push('scaleX(-1)')
  if (props.flipV) transforms.push('scaleY(-1)')
  if (props.rotate) transforms.push(`rotate(${props.rotate}deg)`)
  return transforms.length ? { transform: transforms.join(' ') } : undefined
})

/** M3 加载态：由 md-circular-progress 内置动效驱动，不用 CSS keyframes */
const progressStyle = computed(() => ({
  '--md-circular-progress-size': `${computedSize.value}px`,
  '--md-circular-progress-active-indicator-width': `${Math.max(2, Math.round(computedSize.value / 8))}px`,
  '--md-circular-progress-active-indicator-color': computedColor.value
}))
</script>

<template>
  <md-circular-progress
    v-if="spin && iconComponent"
    indeterminate
    class="ottersage-lucide-icon ottersage-lucide-icon--progress"
    :style="progressStyle"
    v-bind="$attrs"
  />
  <component
    :is="iconComponent"
    v-else-if="iconComponent"
    :size="computedSize"
    :color="computedColor"
    :stroke-width="strokeWidth"
    class="ottersage-lucide-icon"
    :style="transformStyle"
    v-bind="$attrs"
  />
  <span v-else class="ottersage-lucide-icon ottersage-lucide-icon--missing">?</span>
</template>

<style scoped>
.ottersage-lucide-icon {
  display: inline-flex;
  flex-shrink: 0;
  justify-content: center;
  align-items: center;

  /* GPU 加速 */
  transform: translateZ(0);
  vertical-align: middle;

  /* 优化图标渲染 */
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  will-change: transform;
}

.ottersage-lucide-icon--missing {
  display: inline-flex;
  justify-content: center;
  align-items: center;
  width: 1em;
  height: 1em;
  border-radius: var(--radius-sm, 4px);
  font-size: inherit;
  color: var(--md-sys-color-error);
  background: color-mix(in srgb, var(--md-sys-color-error) 10%, transparent);
}

.ottersage-lucide-icon--progress {
  display: inline-flex;
  flex-shrink: 0;
  vertical-align: middle;
}
</style>
