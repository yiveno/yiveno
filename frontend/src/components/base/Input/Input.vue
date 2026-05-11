<template>
  <div class="acuity-input-wrapper">
    <label v-if="label" :for="inputId" class="acuity-input-label">
      {{ label }}
    </label>
    <div class="acuity-input-container" :class="inputContainerClasses">
      <div v-if="$slots.prepend" class="acuity-input-prepend">
        <slot name="prepend"></slot>
      </div>
      <input
        :id="inputId"
        :value="modelValue"
        :type="type"
        :name="name"
        :placeholder="placeholder"
        :disabled="disabled"
        :readonly="readonly"
        :autocomplete="autocomplete"
        :class="inputClasses"
        class="acuity-input"
        v-bind="$attrs"
        @input="handleInput"
        @focus="handleFocus"
        @blur="handleBlur"
        @keydown="handleKeydown"
      />
      <div v-if="loading" class="acuity-input-loading">
        <div class="acuity-spinner-small"></div>
      </div>
      <div
        v-if="clearable && modelValue"
        class="acuity-input-clear"
        @click="clearInput"
      >
        <LucideIcon name="x" :size="16" />
      </div>
      <div v-if="$slots.append" class="acuity-input-append">
        <slot name="append"></slot>
      </div>
    </div>
    <!-- ✅ 始终渲染提示区域，预留空间避免布局跳动 -->
    <div
      class="acuity-input-hint"
      :class="{
        error: !!errorMessage,
        'has-content': !!(errorMessage || hint)
      }"
    >
      {{ errorMessage || hint || '\u00A0' }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { LucideIcon } from '@/components/base/LucideIcon'
import type { InputProps, InputEmits } from './Input.d'

defineOptions({ 
  name: 'AcuityInput',
  components: {
    LucideIcon
  }
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
  borderless: false
})

declare const __ACUITY_INPUT_INTERNAL__: unique symbol

const emit = defineEmits<InputEmits>()

const isFocused = ref(false)
const inputId = `acuity-input-${Math.random().toString(36).substr(2, 9)}`

const inputContainerClasses = computed(() => [
  `acuity-input-container--${props.variant}`,
  `acuity-input-container--${props.size}`,
  `acuity-input-container--${props.density}`,
  {
    'acuity-input-container--focused': isFocused.value,
    'acuity-input-container--disabled': props.disabled,
    'acuity-input-container--error': props.error || props.errorMessage,
    'acuity-input-container--loading': props.loading,
    'acuity-input-container--borderless': props.borderless
  }
])

const inputClasses = computed(() => [
  `acuity-input--${props.size}`,
  {
    'acuity-input--disabled': props.disabled,
    'acuity-input--readonly': props.readonly
  }
])

const handleInput = (event: Event) => {
  const target = event.target as HTMLInputElement
  const raw = target.value
  const value = props.modelModifiers?.number ? Number(raw) : raw
  emit('update:modelValue', value)
  emit('input', value)
}

const handleFocus = (event: FocusEvent) => {
  isFocused.value = true
  emit('focus', event)
}

const handleBlur = (event: FocusEvent) => {
  isFocused.value = false
  emit('blur', event)
}

const handleKeydown = (event: KeyboardEvent) => {
  emit('keydown', event)
}

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
@keyframes spin {
  0% {
    transform: rotate(0deg);
  }

  100% {
    transform: rotate(360deg);
  }
}

/**
 * ✨ 淡入动画 - 用于 loading spinner 和 clear 按钮
 */
@keyframes fade-in {
  from {
    opacity: 0;
    transform: scale(0.8);
  }

  to {
    opacity: 1;
    transform: scale(1);
  }
}

/**
 * ✨ 缩放弹跳动画 - 用于 clear 按钮点击
 */
@keyframes scale-bounce {
  0% {
    transform: scale(1);
  }

  50% {
    transform: scale(0.9);
  }

  100% {
    transform: scale(1);
  }
}

/**
 * ♿ 可访问性：尊重用户的动画偏好
 */
@media (prefers-reduced-motion: reduce) {
  .acuity-input-container,
  .acuity-input-clear,
  .acuity-input-loading {
    transition: none !important;
    animation: none !important;
  }
}

.acuity-input-wrapper {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
  width: 100%; /* 确保 wrapper 占据全部宽度 */
}

.acuity-input-label {
  margin-bottom: var(--spacing-xs);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: var(--color-text-primary);
  
  /* ✨ 平滑过渡 */
  transition: color var(--anim-duration-fast) var(--anim-ease-standard);
}

.acuity-input-container {
  position: relative;
  display: flex;
  align-items: center;
  padding: 0 var(--spacing-md);
  border-radius: var(--radius-md);
  
  /* ✨ 优化背景：微妙的渐变 */
  background: linear-gradient(
    135deg,
    var(--color-surface) 0%,
    color-mix(in srgb, var(--color-surface) 98%, var(--color-primary) 2%) 100%
  );
  
  /* ✨ 性能优化：提示浏览器优化变换和阴影 */
  will-change: border-color, box-shadow;
  
  /* ✨ 平滑过渡：边框 + 阴影 + 背景 */
  transition:
    border-color var(--anim-duration-fast) var(--anim-ease-standard),
    box-shadow var(--anim-duration-normal) var(--anim-ease-emphasized),
    background var(--anim-duration-fast) var(--anim-ease-standard);
}

/* Variant styles */
.acuity-input-container--outlined {
  border: 1px solid var(--color-border);
  
  /* ✨ 初始阴影 */
  box-shadow: 0 1px 2px rgb(0 0 0 / 3%);
}

.acuity-input-container--outlined:hover {
  border-color: var(--color-border-hover);
  
  /* ✨ 悬停时阴影加深 */
  box-shadow: 0 2px 4px rgb(0 0 0 / 6%);
}

.acuity-input-container--outlined.acuity-input-container--focused {
  border-color: var(--color-primary);
  
  /* ✨ 聚焦时的发光效果：多层阴影 + 彩色光晕 */
  box-shadow: 
    0 0 0 3px color-mix(in srgb, var(--color-primary) 15%, transparent),
    0 2px 8px rgb(0 0 0 / 8%),
    0 0 20px color-mix(in srgb, var(--color-primary) 20%, transparent);
  
  /* ✨ 聚焦时背景更亮 */
  background: linear-gradient(
    135deg,
    var(--color-surface) 0%,
    color-mix(in srgb, var(--color-surface) 95%, var(--color-primary) 5%) 100%
  );
}

.acuity-input-container--filled {
  border: 1px solid transparent;
  border-bottom: 2px solid var(--color-border);
  background: var(--color-surface-variant);
  
  /* ✨ 轻微阴影 */
  box-shadow: 0 1px 2px rgb(0 0 0 / 3%);
}

.acuity-input-container--filled.acuity-input-container--focused {
  border-bottom-color: var(--color-primary);
  
  /* ✨ 聚焦时底部发光 */
  box-shadow: 
    0 2px 0 0 color-mix(in srgb, var(--color-primary) 30%, transparent),
    0 2px 8px rgb(0 0 0 / 8%);
}

/* Size styles */
.acuity-input-container--sm {
  min-height: 32px;
}

.acuity-input-container--md {
  min-height: 40px;
}

.acuity-input-container--lg {
  min-height: 48px;
}

/* Density styles */
.acuity-input-container--comfortable {
  padding-top: var(--spacing-sm);
  padding-bottom: var(--spacing-sm);
}

.acuity-input-container--compact {
  padding-top: var(--spacing-xs);
  padding-bottom: var(--spacing-xs);
}

/* State styles - 错误状态优先级高于 hover */
.acuity-input-container--error,
.acuity-input-container--error:hover,
.acuity-input-container--error.acuity-input-container--focused {
  border-color: var(--color-error);
  
  /* ✨ 错误状态的红色光晕 */
  box-shadow: 
    0 0 0 3px color-mix(in srgb, var(--color-error) 15%, transparent),
    0 2px 8px rgb(0 0 0 / 8%),
    0 0 20px color-mix(in srgb, var(--color-error) 20%, transparent);
}

.acuity-input-container--disabled {
  border-color: var(--color-border-disabled);
  background: var(--color-surface-disabled);
  opacity: 0.6;
  cursor: not-allowed;
  
  /* ✨ 禁用状态无阴影 */
  box-shadow: none;
}

/* Borderless style - 使用高特异性选择器覆盖所有变体 */
.acuity-input-container.acuity-input-container--borderless {
  padding: 0;
  border: none;
  background: transparent;
  box-shadow: none;
  opacity: 1;
}

.acuity-input-container.acuity-input-container--borderless:hover,
.acuity-input-container.acuity-input-container--borderless.acuity-input-container--focused {
  background: transparent;
  box-shadow: none;
  opacity: 1;
}

.acuity-input {
  flex: 1;
  padding: 0;
  border: none;
  outline: none;
  font-size: var(--text-base);
  color: var(--color-text-primary);
  background: transparent;
  
  /* ✨ 平滑过渡 */
  transition: color var(--anim-duration-fast) var(--anim-ease-standard);
}

.acuity-input::placeholder {
  color: var(--color-text-tertiary);
  
  /* ✨ placeholder 淡入淡出 */
  transition: 
    color var(--anim-duration-fast) var(--anim-ease-standard),
    opacity var(--anim-duration-fast) var(--anim-ease-standard);
}

/* ✨ 聚焦时 placeholder 更淡 */
.acuity-input-container--focused .acuity-input::placeholder {
  opacity: 0.5;
}

.acuity-input--disabled {
  color: var(--color-text-disabled);
  cursor: not-allowed;
}

.acuity-input--readonly {
  cursor: default;
  user-select: none;
}

.acuity-input-prepend,
.acuity-input-append {
  display: flex;
  align-items: center;
  color: var(--color-text-secondary);
  
  /* ✨ 平滑过渡 */
  transition: color var(--anim-duration-fast) var(--anim-ease-standard);
}

.acuity-input-prepend {
  margin-right: var(--spacing-1-5);
}

.acuity-input-append {
  margin-left: var(--spacing-sm);
}

.acuity-input-loading {
  margin-left: var(--spacing-sm);
  
  /* ✨ 淡入动画 */
  animation: fade-in var(--anim-duration-fast) var(--anim-ease-standard);
}

.acuity-input-clear {
  display: flex;
  justify-content: center;
  align-items: center;
  margin-left: var(--spacing-sm);
  padding: var(--spacing-xs);
  border-radius: var(--radius-sm);
  color: var(--color-text-tertiary);
  cursor: pointer;
  
  /* ✨ 平滑过渡 */
  transition:
    color var(--anim-duration-fast) var(--anim-ease-standard),
    background-color var(--anim-duration-fast) var(--anim-ease-standard),
    transform var(--anim-duration-fast) var(--anim-ease-spring);
  
  /* ✨ 淡入动画 */
  animation: fade-in var(--anim-duration-fast) var(--anim-ease-standard);
  
  /* ✨ 性能优化 */
  will-change: transform, background-color;
}

.acuity-input-clear:hover {
  color: var(--color-text-secondary);
  background-color: var(--color-surface-hover);
  opacity: 0.8;
}

.acuity-input-clear:active {
  opacity: 0.6;
  animation: scale-bounce var(--anim-duration-fast) var(--anim-ease-bounce);
}

/* ✅ 始终预留提示区域空间，避免布局跳动 */
.acuity-input-hint {
  min-height: 1.5em; /* 预留一行文本的高度 */
  font-size: var(--text-sm);
  line-height: 1.5;
  color: transparent; /* 默认透明，无内容时不可见 */
  
  /* ✨ 平滑过渡 */
  transition: 
    color var(--anim-duration-fast) var(--anim-ease-standard),
    opacity var(--anim-duration-fast) var(--anim-ease-standard);
}

/* 有内容时显示颜色 */
.acuity-input-hint.has-content {
  color: var(--color-text-tertiary);
}

/* 错误状态 - 特异性高于 .has-content */
.acuity-input-hint.error,
.acuity-input-hint.error.has-content {
  font-weight: var(--font-medium);
  color: var(--color-error);
  
  /* ✨ 错误提示淡入 */
  animation: fade-in var(--anim-duration-fast) var(--anim-ease-standard);
}

.acuity-spinner-small {
  width: 18px;
  height: 18px;
  border: 2.5px solid transparent;
  border-top: 2.5px solid var(--color-primary);
  border-right: 2.5px solid var(--color-primary);
  border-radius: 50%;

  /* ✅ 性能优化：提示浏览器优化动画性能 */
  will-change: transform;
  
  /* ✨ 更流畅的旋转动画 - 使用弹性缓动 */
  animation: spin 0.8s cubic-bezier(0.68, -0.55, 0.27, 1.55) infinite;
}
</style>
