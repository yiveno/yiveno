<script setup lang="ts">
import { computed } from 'vue'
import type { SelectProps, SelectEmits } from './Select.d'

defineOptions({
  name: 'MdSelect'
})

const props = withDefaults(defineProps<SelectProps>(), {
  modelValue: undefined,
  label: '',
  placeholder: '',
  variant: 'outlined',
  disabled: false,
  required: false,
  error: false,
  errorMessage: '',
  hint: '',
  options: () => []
})

const emit = defineEmits<SelectEmits>()

/**
 * 处理 input 事件
 */
const handleInput = (event: Event) => {
  const target = event.target as HTMLSelectElement & { value: string }
  const value = target.value
  emit('update:modelValue', value)
  emit('input', event)
}

/**
 * 处理 change 事件
 */
const handleChange = (event: Event) => {
  emit('change', event)
}

/**
 * 计算 md-select 的属性
 */
const selectAttrs = computed(() => ({
  value: props.modelValue,
  label: props.label,
  disabled: props.disabled,
  required: props.required,
  error: props.error || !!props.errorMessage,
  'error-text': props.errorMessage,
  'supporting-text': props.errorMessage || props.hint,
  ...(props.name !== undefined ? { name: props.name } : {})
}))

/**
 * 计算组件类型
 */
const selectComponent = computed(() => {
  return props.variant === 'filled' ? 'md-filled-select' : 'md-outlined-select'
})
</script>

<template>
  <component
    :is="selectComponent"
    v-bind="selectAttrs"
    class="ottersage-select"
    @input="handleInput"
    @change="handleChange"
  >
    <!-- 使用 slot 优先 -->
    <slot>
      <!-- 回退到 options prop -->
      <md-select-option
        v-for="option in options"
        :key="option.value"
        :value="option.value"
        :disabled="option.disabled"
      >
        <div slot="headline">{{ option.label }}</div>
        <div v-if="option.description" slot="supporting-text">{{ option.description }}</div>
      </md-select-option>
    </slot>
  </component>
</template>

<style scoped>
/**
 * Material Design 3 Select Component
 * 基于 Material Web Select 的封装组件
 * 
 * 特性：
 * - 支持 outlined/filled 变体
 * - 统一错误状态和提示文本
 * - 支持选项列表 prop 或 slot
 * - 完全符合 Material Design 3 规范
 */

.ottersage-select {
  --md-outlined-select-text-field-container-shape: var(--radius-md);
  --md-filled-select-text-field-container-shape: var(--radius-md);

  width: 100%;
}
</style>
