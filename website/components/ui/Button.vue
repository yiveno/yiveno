<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'link'
    size?: 'sm' | 'md' | 'lg'
    as?: string | object
    loading?: boolean
    disabled?: boolean
    block?: boolean
    className?: string
  }>(),
  {
    variant: 'primary',
    size: 'md',
    as: 'button',
    loading: false,
    disabled: false,
    block: false,
    className: ''
  }
)

const computedClass = computed(() => {
  const classes = [
    'btn',
    `btn-${props.variant}`,
    `btn-${props.size}`,
    props.block ? 'btn-block' : '',
    props.className
  ]
  return classes.filter(Boolean).join(' ')
})
</script>

<template>
  <component :is="as" :class="computedClass" v-bind="$attrs" :disabled="disabled || loading">
    <svg
      v-if="loading"
      class="animate-spin -ml-1 mr-2 h-4 w-4"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        class="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        stroke-width="4"
      ></circle>
      <path
        class="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      ></path>
    </svg>
    <slot />
  </component>
</template>

<style scoped>
/* Loading 图标动画 */
@keyframes spin {
  from {
    transform: rotate(0deg);
  }

  to {
    transform: rotate(360deg);
  }
}

.btn {
  display: inline-flex;
  justify-content: center;
  align-items: center;
  border: none;
  border-radius: var(--md-sys-shape-corner-extra-large);
  font-family: inherit;
  font-weight: 500;
  cursor: pointer;
  transition: all 200ms ease;
}

.btn:focus {
  outline: 2px solid transparent;
  outline-offset: 2px;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* 变体样式 */
.btn-primary {
  color: white;
  background: linear-gradient(to right, var(--md-sys-color-primary), var(--md-sys-color-secondary));
  box-shadow: 0 4px 12px color-mix(in srgb, var(--md-sys-color-primary) 20%, transparent);
}

.btn-primary:hover:not(:disabled) {
  background: linear-gradient(
    to right,
    color-mix(in srgb, var(--md-sys-color-primary) 90%, white),
    color-mix(in srgb, var(--md-sys-color-secondary) 90%, white)
  );
  transform: translateY(-1px);
  box-shadow: 0 6px 16px color-mix(in srgb, var(--md-sys-color-primary) 30%, transparent);
}

.btn-secondary {
  border: 1px solid rgb(255 255 255 / 10%);
  color: white;
  background-color: rgb(255 255 255 / 10%);
  backdrop-filter: blur(8px);
}

.btn-secondary:hover:not(:disabled) {
  background-color: rgb(255 255 255 / 15%);
}

.btn-outline {
  border: 1px solid color-mix(in srgb, var(--md-sys-color-primary) 30%, transparent);
  color: var(--md-sys-color-primary);
  background-color: transparent;
}

.btn-outline:hover:not(:disabled) {
  background-color: color-mix(in srgb, var(--md-sys-color-primary) 10%, transparent);
}

.btn-ghost {
  color: var(--md-sys-color-on-surface-variant);
  background-color: transparent;
}

.btn-ghost:hover:not(:disabled) {
  color: white;
  background-color: rgb(255 255 255 / 5%);
}

.btn-link {
  padding: 0;
  text-decoration: underline;
  color: var(--md-sys-color-primary);
  background-color: transparent;
  text-underline-offset: 4px;
}

.btn-link:hover:not(:disabled) {
  color: color-mix(in srgb, var(--md-sys-color-primary) 80%, white);
}

/* 尺寸样式 */
.btn-sm {
  padding: 6px 12px;
  font-size: 0.75rem;
  line-height: 1rem;
}

.btn-md {
  padding: 10px 24px;
  font-size: 0.875rem;
  line-height: 1.25rem;
}

.btn-lg {
  padding: 14px 32px;
  font-size: 1rem;
  line-height: 1.5rem;
}

.btn-block {
  width: 100%;
}

.animate-spin {
  animation: spin 1s linear infinite;
}

.btn svg {
  width: 16px;
  height: 16px;
  margin-right: 8px;
}

.opacity-25 {
  opacity: 0.25;
}

.opacity-75 {
  opacity: 0.75;
}

/* 按钮基础样式 */
</style>
