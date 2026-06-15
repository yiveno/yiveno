<script setup lang="ts">
import { computed } from 'vue'
import type { SliderProps, SliderEmits } from './Slider.d'

defineOptions({
  name: 'MdSlider'
})

const props = withDefaults(defineProps<SliderProps>(), {
  modelValue: 0,
  min: 0,
  max: 100,
  step: 1,
  disabled: false,
  ticks: false,
  labeled: false,
  withRangeLabel: false
})

const emit = defineEmits<SliderEmits>()

/**
 * 处理 input 事件（拖动中）
 */
const handleInput = (event: Event) => {
  const target = event.target as HTMLInputElement & { value: string }
  const value = Number(target.value)
  emit('update:modelValue', value)
  emit('input', event)
}

/**
 * 处理 change 事件（拖动完成）
 */
const handleChange = (event: Event) => {
  emit('change', event)
}

/**
 * 格式化值显示
 */
const formattedValue = computed(() => {
  if (props.formatValue !== undefined) {
    return props.formatValue(props.modelValue)
  }
  return String(props.modelValue)
})

/**
 * 计算 md-slider 的属性
 */
const sliderAttrs = computed(() => ({
  value: props.modelValue,
  min: props.min,
  max: props.max,
  step: props.step,
  disabled: props.disabled,
  ticks: props.ticks,
  labeled: props.labeled,
  ...(props.name !== undefined ? { name: props.name } : {}),
  ...(props.ariaLabel !== undefined ? { 'aria-label': props.ariaLabel } : {})
}))
</script>

<template>
  <div class="ottersage-slider-wrapper">
    <!-- 范围标签 -->
    <span v-if="withRangeLabel" class="ottersage-slider-range-label">
      {{ min }}
    </span>

    <md-slider
      v-bind="sliderAttrs"
      class="ottersage-slider"
      @input="handleInput"
      @change="handleChange"
    />

    <!-- 范围标签 -->
    <span v-if="withRangeLabel" class="ottersage-slider-range-label">
      {{ max }}
    </span>

    <!-- 当前值显示 -->
    <div v-if="$slots.value" class="ottersage-slider-value">
      <slot name="value" :value="modelValue" :formatted="formattedValue" />
    </div>
  </div>
</template>

<style scoped>
/**
 * Material Design 3 Slider Component
 * 基于 Material Web Slider 的封装组件
 * 
 * 特性：
 * - 统一滑块样式
 * - 支持刻度标记
 * - 支持范围标签
 * - 支持自定义值格式化
 * - 完全符合 Material Design 3 规范
 */

.ottersage-slider-wrapper {
  display: flex;
  align-items: center;
  gap: var(--spacing-3);
  width: 100%;
}

.ottersage-slider {
  flex: 1;
  min-width: 200px;
}

.ottersage-slider-range-label {
  flex-shrink: 0;
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
}

.ottersage-slider-value {
  flex-shrink: 0;
  min-width: 4rem;
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  text-align: right;
  color: var(--color-text-primary);
}
</style>
