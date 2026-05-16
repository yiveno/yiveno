<template>
  <div class="md-input-wrapper" :class="wrapperClasses">
    <div class="md-input-container" :class="containerClasses">
      <!-- Prepend slot -->
      <div v-if="$slots.prepend" class="md-input-prepend">
        <slot name="prepend"></slot>
      </div>
      
      <!-- Material Web Text Field -->
      <md-outlined-text-field
        v-if="variant === 'outlined'"
        ref="textFieldRef"
        :value="modelValue"
        :type="type"
        :name="name"
        :label="label"
        :placeholder="placeholder"
        :disabled="disabled"
        :readonly="readonly"
        :autocomplete="autocomplete"
        :supporting-text="errorMessage || hint"
        :error="!!errorMessage"
        :error-text="errorMessage"
        class="md-text-field"
        v-bind="$attrs"
        @input="handleInput"
        @focus="handleFocus"
        @blur="handleBlur"
        @keydown="handleKeydown"
      >
        <!-- Trailing icon: Loading or Clear button -->
        <div v-if="loading || (clearable && modelValue)" slot="trailing-icon" class="md-input-actions">
          <md-circular-progress v-if="loading" indeterminate class="md-input-spinner" />
          <md-icon-button
            v-else-if="clearable && modelValue"
            type="button"
            class="md-input-clear-btn"
            :aria-label="'清除'"
            @click="clearInput"
          >
            <LucideIcon name="x" :size="16" />
          </md-icon-button>
        </div>
      </md-outlined-text-field>

      <md-filled-text-field
        v-else
        ref="textFieldRef"
        :value="modelValue"
        :type="type"
        :name="name"
        :label="label"
        :placeholder="placeholder"
        :disabled="disabled"
        :readonly="readonly"
        :autocomplete="autocomplete"
        :supporting-text="errorMessage || hint"
        :error="!!errorMessage"
        :error-text="errorMessage"
        class="md-text-field"
        v-bind="$attrs"
        @input="handleInput"
        @focus="handleFocus"
        @blur="handleBlur"
        @keydown="handleKeydown"
      >
        <!-- Trailing icon: Loading or Clear button -->
        <div v-if="loading || (clearable && modelValue)" slot="trailing-icon" class="md-input-actions">
          <md-circular-progress v-if="loading" indeterminate class="md-input-spinner" />
          <md-icon-button
            v-else-if="clearable && modelValue"
            type="button"
            class="md-input-clear-btn"
            :aria-label="'清除'"
            @click="clearInput"
          >
            <LucideIcon name="x" :size="16" />
          </md-icon-button>
        </div>
      </md-filled-text-field>

      <!-- Append slot -->
      <div v-if="$slots.append" class="md-input-append">
        <slot name="append"></slot>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { LucideIcon } from '@/components/base/LucideIcon'
import type { InputProps, InputEmits } from './Input.d'
import '@material/web/textfield/outlined-text-field.js'
import '@material/web/textfield/filled-text-field.js'
import '@material/web/iconbutton/icon-button.js'
import '@material/web/progress/circular-progress.js'

defineOptions({ 
  name: 'MdInput'
})

const props = withDefaults(defineProps<InputProps>(), {
  label: '',
  variant: 'outlined',
  density: 'default',
  autocomplete: 'off',
  name: undefined,
  placeholder: '',
  disabled: false,
  readonly: false,
  clearable: false,
  clearValue: undefined,
  maxlength: undefined,
  hint: '',
  error: false,
  errorMessage: '',
  size: 'md',
  type: 'text'
})

const emit = defineEmits<InputEmits>()

const textFieldRef = ref<HTMLElement>()
const isFocused = ref(false)

/**
 * Wrapper 类名
 */
const wrapperClasses = computed(() => [
  `md-input-wrapper--${props.size}`,
  `md-input-wrapper--${props.density}`,
  {
    'md-input-wrapper--disabled': props.disabled,
    'md-input-wrapper--error': props.error || props.errorMessage
  }
])

/**
 * Container 类名
 */
const containerClasses = computed(() => [
  `md-input-container--${props.size}`,
  `md-input-container--${props.density}`,
  {
    'md-input-container--focused': isFocused.value,
    'md-input-container--disabled': props.disabled,
    'md-input-container--error': props.error || props.errorMessage,
    'md-input-container--loading': props.loading
  }
])

/**
 * 处理输入事件
 */
const handleInput = (event: Event) => {
  const target = event.target as HTMLInputElement
  const raw = target.value
  const value = props.modelModifiers?.number ? Number(raw) : raw
  emit('update:modelValue', value)
  emit('input', value)
}

/**
 * 处理聚焦事件
 */
const handleFocus = (event: FocusEvent) => {
  isFocused.value = true
  emit('focus', event)
}

/**
 * 处理失焦事件
 */
const handleBlur = (event: FocusEvent) => {
  isFocused.value = false
  emit('blur', event)
}

/**
 * 处理键盘事件
 */
const handleKeydown = (event: KeyboardEvent) => {
  emit('keydown', event)
}

/**
 * 清空输入
 */
const clearInput = () => {
  let clearedValue: string | number | undefined = props.clearValue

  if (clearedValue === undefined) {
    clearedValue = props.modelModifiers?.number ? undefined : ''
  }

  emit('update:modelValue', clearedValue as string | number)
  emit('clear')
}
</script>

<style scoped>


/* ========== 可访问性：尊重用户的动画偏好 ========== */

@media (prefers-reduced-motion: reduce) {
  .md-input-container,
  .md-input-prepend,
  .md-input-append,
  .md-input-spinner {
    transition: none !important;
    animation: none !important;
  }
}

/* ========== Wrapper 样式 ========== */

.md-input-wrapper {
  display: flex;
  flex-direction: column;
  width: 100%;
}

/* 尺寸变体 */
.md-input-wrapper--sm {
  --md-outlined-text-field-container-shape: var(--radius-sm);
  --md-filled-text-field-container-shape: var(--radius-sm);
}

.md-input-wrapper--md {
  --md-outlined-text-field-container-shape: var(--radius-md);
  --md-filled-text-field-container-shape: var(--radius-md);
}

.md-input-wrapper--lg {
  --md-outlined-text-field-container-shape: var(--radius-lg);
  --md-filled-text-field-container-shape: var(--radius-lg);
}

/* 密度变体 */
.md-input-wrapper--compact {
  --md-outlined-text-field-top-space: var(--spacing-xs);
  --md-outlined-text-field-bottom-space: var(--spacing-xs);
  --md-filled-text-field-top-space: var(--spacing-xs);
  --md-filled-text-field-bottom-space: var(--spacing-xs);
}

.md-input-wrapper--comfortable {
  --md-outlined-text-field-top-space: var(--spacing-sm);
  --md-outlined-text-field-bottom-space: var(--spacing-sm);
  --md-filled-text-field-top-space: var(--spacing-sm);
  --md-filled-text-field-bottom-space: var(--spacing-sm);
}

/* ========== Container 样式 ========== */

.md-input-container {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  width: 100%;
}

.md-text-field {
  flex: 1;
  width: 100%;
  min-height: 56px; /* Material Design 3 标准高度 */
}

/* Prepend/Append slots */
.md-input-prepend,
.md-input-append {
  display: flex;
  align-items: center;
  color: var(--md-sys-color-on-surface-variant);
  transition: color var(--md-sys-motion-duration-short2) var(--md-sys-motion-easing-standard);
}

.md-input-container--focused .md-input-prepend,
.md-input-container--focused .md-input-append {
  color: var(--md-sys-color-primary);
}

/* Loading & Clear 按钮容器 */
.md-input-actions {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
}

.md-input-spinner {
  --md-circular-progress-size: 18px;
  --md-circular-progress-active-indicator-color: var(--md-sys-color-primary);
}

.md-input-clear-btn {
  --md-icon-button-icon-size: 16px;
  --md-icon-button-state-layer-shape: var(--radius-full);
}

/**
 * Material Design 3 Input Component
 * 基于 Material Web Text Field 的封装组件
 * 
 * 特性：
 * - 完全使用 Material Web Text Field
 * - 支持 outlined/filled 变体
 * - 支持 clearable 按钮
 * - 支持 loading 状态
 * - 支持 prepend/append slots
 * - 完全符合 Material Design 3 规范
 */
</style>
