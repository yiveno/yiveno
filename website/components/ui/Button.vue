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
/* 按钮基础样式 */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--md-sys-shape-corner-extra-large);
  font-weight: 500;
  transition: all 200ms ease;
  border: none;
  cursor: pointer;
  font-family: inherit;
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
  background: linear-gradient(to right, var(--md-sys-color-primary), var(--md-sys-color-secondary));
  color: white;
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
  background-color: rgb(255 255 255 / 10%);
  color: white;
  border: 1px solid rgb(255 255 255 / 10%);
  backdrop-filter: blur(8px);
}

.btn-secondary:hover:not(:disabled) {
  background-color: rgb(255 255 255 / 15%);
}

.btn-outline {
  background-color: transparent;
  color: var(--md-sys-color-primary);
  border: 1px solid color-mix(in srgb, var(--md-sys-color-primary) 30%, transparent);
}

.btn-outline:hover:not(:disabled) {
  background-color: color-mix(in srgb, var(--md-sys-color-primary) 10%, transparent);
}

.btn-ghost {
  background-color: transparent;
  color: var(--md-sys-color-on-surface-variant);
}

.btn-ghost:hover:not(:disabled) {
  color: white;
  background-color: rgb(255 255 255 / 5%);
}

.btn-link {
  background-color: transparent;
  color: var(--md-sys-color-primary);
  padding: 0;
  text-decoration: underline;
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

/* Loading 图标动画 */
@keyframes spin {
  from {
    transform: rotate(0deg);
  }

  to {
    transform: rotate(360deg);
  }
}

.animate-spin {
  animation: spin 1s linear infinite;
}

.btn svg {
  margin-right: 8px;
  width: 16px;
  height: 16px;
}

.opacity-25 {
  opacity: 0.25;
}

.opacity-75 {
  opacity: 0.75;
}
</style>
