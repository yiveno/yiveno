<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    variant?: 'default' | 'glass' | 'outline'
    hover?: boolean
    className?: string
  }>(),
  {
    variant: 'glass',
    hover: false,
    className: ''
  }
)

const computedClass = computed(() => {
  const classes = [
    'card',
    `card-${props.variant}`,
    props.hover ? 'card-hover' : '',
    props.className
  ]
  return classes.filter(Boolean).join(' ')
})
</script>

<template>
  <div :class="computedClass">
    <slot />
  </div>
</template>

<style scoped>
/* 基础卡片样式 */
.card {
  border-radius: var(--md-sys-shape-corner-extra-large);
  overflow: hidden;
  transition: all 0.3s ease;
}

/* 卡片变体 */
.card-default {
  background-color: var(--md-sys-color-surface);
  border: 1px solid color-mix(in srgb, white 10%, transparent);
}

.card-glass {
  background-color: rgb(255 255 255 / 2%);
  border: 1px solid rgb(255 255 255 / 5%);
  backdrop-filter: blur(12px);
}

.card-outline {
  background-color: transparent;
  border: 1px solid color-mix(in srgb, white 10%, transparent);
}

/* Hover 效果 */
.card-hover:hover {
  border-color: color-mix(in srgb, var(--md-sys-color-primary) 30%, transparent);
  background-color: rgb(255 255 255 / 4%);
  box-shadow:
    0 20px 25px -5px rgb(0 0 0 / 10%),
    0 10px 10px -5px color-mix(in srgb, var(--md-sys-color-primary) 5%, transparent);
}
</style>
