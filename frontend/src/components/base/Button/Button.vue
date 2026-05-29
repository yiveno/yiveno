<script setup lang="ts">
import { computed } from 'vue'
import { LucideIcon } from '@/components/base/LucideIcon'
import { Loading } from '@/components/base/Loading'
import type { ButtonProps, ButtonEmits } from './Button.d'

defineOptions({
  name: 'MdButton'
})

const props = withDefaults(defineProps<ButtonProps>(), {
  variant: 'filled',
  disabled: false,
  iconSize: 20,
  type: 'button',
  loading: false
})

const emit = defineEmits<ButtonEmits>()

const handleClick = (event: MouseEvent) => {
  if (props.loading) return
  emit('click', event)
}

/**
 * 根据变体决定是否使用 loading
 */
const showLoading = computed(() => props.loading && props.variant !== 'icon')

/**
 * icon 按钮的 aria-label
 */
const computedAriaLabel = computed(() => {
  return props.ariaLabel || props.title || ''
})

/**
 * icon 按钮变体时，将 iconSize 映射到 MWC CSS 变量
 */
const iconStyleComputed = computed(() => {
  if (props.variant !== 'icon') return {} as Record<string, string>
  return { '--md-icon-button-icon-size': `${props.iconSize}px` }
})
</script>

<template>
  <!-- Filled Button -->
  <md-filled-button
    v-if="variant === 'filled'"
    :disabled="disabled || loading"
    :type="type"
    v-bind="$attrs"
    :style="iconStyleComputed"
    @click="handleClick"
  >
    <LucideIcon v-if="icon" slot="icon" :name="icon" :size="iconSize" />
    <slot slot="icon" name="icon"></slot>
    <Loading v-if="showLoading" slot="icon" size="xs" />
    <slot></slot>
    <LucideIcon v-if="trailingIcon" slot="trailing-icon" :name="trailingIcon" :size="iconSize" />
  </md-filled-button>

  <!-- Text Button -->
  <md-text-button
    v-else-if="variant === 'text'"
    :disabled="disabled || loading"
    :type="type"
    v-bind="$attrs"
    :style="iconStyleComputed"
    @click="handleClick"
  >
    <LucideIcon v-if="icon" slot="icon" :name="icon" :size="iconSize" />
    <slot slot="icon" name="icon"></slot>
    <Loading v-if="showLoading" slot="icon" size="xs" />
    <slot></slot>
    <LucideIcon v-if="trailingIcon" slot="trailing-icon" :name="trailingIcon" :size="iconSize" />
  </md-text-button>

  <!-- Outlined Button -->
  <md-outlined-button
    v-else-if="variant === 'outlined'"
    :disabled="disabled || loading"
    :type="type"
    v-bind="$attrs"
    :style="iconStyleComputed"
    @click="handleClick"
  >
    <LucideIcon v-if="icon" slot="icon" :name="icon" :size="iconSize" />
    <slot slot="icon" name="icon"></slot>
    <Loading v-if="showLoading" slot="icon" size="xs" />
    <slot></slot>
    <LucideIcon v-if="trailingIcon" slot="trailing-icon" :name="trailingIcon" :size="iconSize" />
  </md-outlined-button>

  <!-- Icon Button -->
  <md-icon-button
    v-else-if="variant === 'icon'"
    :disabled="disabled"
    :type="type"
    :aria-label="computedAriaLabel"
    :title="title"
    v-bind="$attrs"
    :style="iconStyleComputed"
    @click="handleClick"
  >
    <LucideIcon v-if="icon" :name="icon" :size="iconSize" />
    <slot></slot>
  </md-icon-button>
</template>

<style scoped>
/**
 * Button 组件
 *
 * 对 Material Web Components 按钮的统一封装，提供四种变体：
 * - filled: 实心按钮 (md-filled-button)
 * - text: 文字按钮 (md-text-button)
 * - outlined: 轮廓按钮 (md-outlined-button)
 * - icon: 图标按钮 (md-icon-button)
 *
 * 特性：
 * - 支持 LucideIcon 图标 (icon prop 或 icon slot)
 * - 支持 loading 状态
 * - 支持 trailing icon
 * - 完整的 type 安全
 */
</style>
