<script setup lang="ts">
import { computed } from 'vue'
import type { LinearProgressProps, LinearProgressEmits } from './LinearProgress.d'

defineOptions({
  name: 'MdLinearProgress'
})

const props = withDefaults(defineProps<LinearProgressProps>(), {
  value: undefined,
  size: 'md',
  variant: 'primary',
  indeterminate: false,
  showPercentage: false,
  roundPrecision: 0
})

const _emit = defineEmits<LinearProgressEmits>()

/**
 * 计算实际进度值（0-1）
 */
const normalizedValue = computed(() => {
  if (props.indeterminate || props.value === undefined) {
    return undefined
  }
  return Math.max(0, Math.min(1, props.value))
})

/**
 * 计算百分比显示值
 */
const percentageValue = computed(() => {
  if (normalizedValue.value === undefined) {
    return 0
  }
  const percentage = normalizedValue.value * 100
  return Number(percentage.toFixed(props.roundPrecision))
})

/**
 * 格式化百分比文本
 */
const formattedPercentage = computed(() => {
  if (props.formatPercentage !== undefined) {
    return props.formatPercentage(percentageValue.value)
  }
  return `${percentageValue.value}%`
})

/**
 * 计算 md-linear-progress 的属性
 */
const progressAttrs = computed(() => {
  const attrs: Record<string, unknown> = {
    indeterminate: props.indeterminate
  }

  if (normalizedValue.value !== undefined) {
    attrs.value = normalizedValue.value
  }

  if (props.ariaLabel !== undefined) {
    attrs['aria-label'] = props.ariaLabel
  }

  return attrs
})

/**
 * 计算 class
 */
const progressClasses = computed(() => [
  'yiveno-linear-progress',
  `yiveno-linear-progress--${props.size}`,
  `yiveno-linear-progress--${props.variant}`,
  {
    'yiveno-linear-progress--with-percentage': props.showPercentage
  }
])
</script>

<template>
  <div class="yiveno-linear-progress-wrapper">
    <md-linear-progress v-bind="progressAttrs" :class="progressClasses" />

    <!-- 百分比显示 -->
    <div v-if="showPercentage && !indeterminate" class="yiveno-linear-progress-percentage">
      <slot name="percentage" :value="percentageValue" :formatted="formattedPercentage">
        {{ formattedPercentage }}
      </slot>
    </div>
  </div>
</template>

<style scoped>
/**
 * Material Design 3 Linear Progress Component
 * 基于 Material Web Linear Progress 的封装组件
 * 
 * 特性：
 * - 支持确定和不确定状态
 * - 支持四种颜色变体（primary/success/warning/error）
 * - 支持四种尺寸（xs/sm/md/lg）
 * - 可选百分比显示
 * - 完全符合 Material Design 3 规范
 */

/* ========== Wrapper 样式 ========== */

.yiveno-linear-progress-wrapper {
  position: relative;
  display: flex;
  align-items: center;
  gap: var(--spacing-3);
  width: 100%;
}

.yiveno-linear-progress {
  --md-linear-progress-track-color: var(--md-sys-color-surface-container-highest);

  flex: 1;
}

/* ========== 尺寸变体 ========== */

.yiveno-linear-progress--xs {
  --md-linear-progress-track-height: 2px;
  --md-linear-progress-active-indicator-height: 2px;
}

.yiveno-linear-progress--sm {
  --md-linear-progress-track-height: 4px;
  --md-linear-progress-active-indicator-height: 4px;
}

.yiveno-linear-progress--md {
  --md-linear-progress-track-height: 6px;
  --md-linear-progress-active-indicator-height: 6px;
}

.yiveno-linear-progress--lg {
  --md-linear-progress-track-height: 8px;
  --md-linear-progress-active-indicator-height: 8px;
}

/* ========== 颜色变体 ========== */

.yiveno-linear-progress--primary {
  --md-linear-progress-active-indicator-color: var(--md-sys-color-primary);
}

.yiveno-linear-progress--success {
  --md-linear-progress-active-indicator-color: var(--color-semantic-success);
}

.yiveno-linear-progress--warning {
  --md-linear-progress-active-indicator-color: var(--color-semantic-warning);
}

.yiveno-linear-progress--error {
  --md-linear-progress-active-indicator-color: var(--md-sys-color-error);
}

/* ========== 百分比显示 ========== */

.yiveno-linear-progress-percentage {
  flex-shrink: 0;
  min-width: 3rem;
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  text-align: right;
  color: var(--color-text-secondary);
}

/* 带百分比时的进度条样式调整 */
.yiveno-linear-progress--with-percentage {
  flex: 1;
}
</style>
