<script setup lang="ts">
import { computed } from 'vue'
import type { CheckboxProps, CheckboxEmits } from './Checkbox.d'

defineOptions({
  name: 'MdCheckbox'
})

const props = withDefaults(defineProps<CheckboxProps>(), {
  modelValue: false,
  indeterminate: false,
  disabled: false,
  variant: 'default',
  size: 'md',
  required: false
})

const emit = defineEmits<CheckboxEmits>()

/**
 * 处理 change 事件
 */
const handleChange = (event: Event) => {
  const target = event.target as HTMLInputElement
  emit('update:modelValue', target.checked)
  emit('change', event)
}

/**
 * 处理 input 事件
 */
const handleInput = (event: InputEvent) => {
  emit('input', event)
}

/**
 * 计算 md-checkbox 的属性
 */
const checkboxAttrs = computed(() => ({
  checked: props.modelValue,
  indeterminate: props.indeterminate,
  disabled: props.disabled,
  required: props.required,
  ...(props.name !== undefined ? { name: props.name } : {}),
  ...(props.value !== undefined ? { value: props.value } : {}),
  ...(props.ariaLabel !== undefined ? { 'aria-label': props.ariaLabel } : {})
}))

/**
 * 计算 class
 */
const checkboxClasses = computed(() => [
  'yiveno-checkbox',
  `yiveno-checkbox--${props.variant}`,
  `yiveno-checkbox--${props.size}`
])
</script>

<template>
  <md-checkbox
    v-bind="checkboxAttrs"
    :class="checkboxClasses"
    @change="handleChange"
    @input="handleInput"
  />
</template>

<style scoped>
/**
 * Material Design 3 Checkbox Component
 * 基于 Material Web Checkbox 的封装组件
 * 
 * 特性：
 * - 统一选中/未选中样式
 * - 支持 indeterminate 状态（全选/部分选中）
 * - 支持三种颜色变体（default/folder/bookmark）
 * - 支持三种尺寸（sm/md/lg）
 * - 完全符合 Material Design 3 规范
 */

.yiveno-checkbox {
  --md-checkbox-state-layer-size: 40px;
}

/* ========== 尺寸变体 ========== */

.yiveno-checkbox--sm {
  --md-checkbox-container-size: 16px;
  --md-checkbox-state-layer-size: 32px;
  --md-checkbox-icon-size: 14px;
}

.yiveno-checkbox--md {
  --md-checkbox-container-size: 18px;
  --md-checkbox-state-layer-size: 40px;
  --md-checkbox-icon-size: 16px;
}

.yiveno-checkbox--lg {
  --md-checkbox-container-size: 20px;
  --md-checkbox-state-layer-size: 48px;
  --md-checkbox-icon-size: 18px;
}

/* ========== 颜色变体 ========== */

/* 文件夹变体：hover 时使用黄色系 */
.yiveno-checkbox--folder:hover {
  --md-checkbox-unselected-hover-state-layer-color: var(--color-folder-hover);
}

/* 书签变体：hover 时使用蓝色系 */
.yiveno-checkbox--bookmark:hover {
  --md-checkbox-unselected-hover-state-layer-color: var(--color-bookmark-hover);
}

/* 默认变体：使用 Material Design 3 默认颜色 */
.yiveno-checkbox--default {
  /* 使用 MD3 默认颜色，无需额外配置 */
}
</style>
