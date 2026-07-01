<script setup lang="ts">
import { computed } from 'vue'
import type { MenuProps, MenuEmits } from './Menu.d'

defineOptions({
  name: 'MdMenu'
})

const props = withDefaults(defineProps<MenuProps>(), {
  open: false,
  anchorCorner: 'end-start',
  menuCorner: 'start-start',
  size: 'md',
  fixed: false,
  quick: false,
  hasOverflow: false,
  stayOpenOnOutsideClick: false,
  stayOpenOnFocusout: false,
  skipRestoreFocus: false
})

const emit = defineEmits<MenuEmits>()

/**
 * 计算 md-menu 的属性
 */
const menuAttrs = computed(() => ({
  open: props.open,
  ...(props.anchor !== undefined ? { anchor: props.anchor } : {}),
  anchorCorner: props.anchorCorner,
  menuCorner: props.menuCorner,
  fixed: props.fixed,
  quick: props.quick,
  hasOverflow: props.hasOverflow,
  stayOpenOnOutsideClick: props.stayOpenOnOutsideClick,
  stayOpenOnFocusout: props.stayOpenOnFocusout,
  skipRestoreFocus: props.skipRestoreFocus
}))

/**
 * 计算 class
 */
const menuClasses = computed(() => ['yiveno-menu', `yiveno-menu--${props.size}`])

/**
 * 事件处理
 */
const handleOpened = () => emit('opened')
const handleClosed = () => emit('closed')
const handleOpening = () => emit('opening')
const handleClosing = () => emit('closing')
</script>

<template>
  <md-menu
    v-bind="menuAttrs"
    :class="menuClasses"
    @opened="handleOpened"
    @closed="handleClosed"
    @opening="handleOpening"
    @closing="handleClosing"
  >
    <slot />
  </md-menu>
</template>

<style scoped>
/**
 * Material Design 3 Menu Component
 * 基于 Material Web Menu 的封装组件
 * 
 * 特性：
 * - 统一菜单样式
 * - 支持三种尺寸（sm/md/lg）
 * - 统一圆角和阴影
 * - 统一菜单项高度和间距
 * - 完全符合 Material Design 3 规范
 */

.yiveno-menu {
  --md-menu-container-shape: var(--radius-lg);
  --md-menu-container-color: var(--md-sys-color-surface-container);

  min-width: 180px;
}

/* ========== 尺寸变体 ========== */

/* 小尺寸：用于紧凑场景（popup、工具栏） */
.yiveno-menu--sm {
  --md-menu-container-shape: var(--radius-md);
  --md-menu-top-space: 4px;
  --md-menu-bottom-space: 4px;

  min-width: 148px;
}

.yiveno-menu--sm :deep(md-menu-item) {
  --md-menu-item-one-line-container-height: 34px;
  --md-menu-item-top-space: 4px;
  --md-menu-item-bottom-space: 4px;
  --md-menu-item-leading-space: 10px;
  --md-menu-item-trailing-space: 10px;
  --md-menu-item-label-text-line-height: 1.125rem;
}

/* 中等尺寸：标准场景 */
.yiveno-menu--md {
  --md-menu-top-space: 8px;
  --md-menu-bottom-space: 8px;

  min-width: 180px;
}

.yiveno-menu--md :deep(md-menu-item) {
  --md-menu-item-one-line-container-height: 40px;
  --md-menu-item-top-space: 6px;
  --md-menu-item-bottom-space: 6px;
}

/* 大尺寸：宽松场景 */
.yiveno-menu--lg {
  --md-menu-top-space: 8px;
  --md-menu-bottom-space: 8px;

  min-width: 220px;
}

.yiveno-menu--lg :deep(md-menu-item) {
  --md-menu-item-one-line-container-height: 48px;
  --md-menu-item-top-space: 8px;
  --md-menu-item-bottom-space: 8px;
}

/* ========== 菜单项通用样式 ========== */

.yiveno-menu :deep(md-menu-item) {
  margin: 0;
}

/* hover 状态 */
.yiveno-menu :deep(md-menu-item:hover) {
  --md-menu-item-container-color: var(--md-sys-color-surface-variant);
}

/* 选中状态 */
.yiveno-menu :deep(md-menu-item.selected) {
  --md-menu-item-selected-container-color: var(--md-sys-color-primary-container);
  --md-menu-item-label-text-color: var(--md-sys-color-on-primary-container);
}

/* 危险操作（红色） */
.yiveno-menu :deep(md-menu-item.danger) {
  --md-menu-item-label-text-color: var(--md-sys-color-error);
}

.yiveno-menu :deep(md-menu-item.danger:hover) {
  --md-menu-item-container-color: color-mix(in srgb, var(--md-sys-color-error) 12%, transparent);
}
</style>
