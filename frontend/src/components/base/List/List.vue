<script setup lang="ts">
import { computed } from 'vue'
import type { ListProps, ListEmits } from './List.d'

defineOptions({
  name: 'MdList'
})

const props = withDefaults(defineProps<ListProps>(), {
  variant: 'default',
  divider: 'line'
})

defineEmits<ListEmits>()

/**
 * 计算 class
 */
const listClasses = computed(() => [
  'yiveno-list',
  `yiveno-list--${props.variant}`,
  `yiveno-list--divider-${props.divider}`
])
</script>

<template>
  <md-list :class="listClasses">
    <slot />
  </md-list>
</template>

<style scoped>
/**
 * Material Design 3 List Component
 * 基于 Material Web List 的封装组件
 * 
 * 特性：
 * - 统一列表样式
 * - 支持分割线配置（none/line/inset）
 * - 支持不同变体（default/menu）
 * - 完全符合 Material Design 3 规范
 */

.yiveno-list {
  width: 100%;
}

/* ========== 分割线样式 ========== */

/* 无分割线 */
.yiveno-list--divider-none :deep(md-list-item) {
  border-bottom: none;
}

/* 完整分割线 */
.yiveno-list--divider-line :deep(md-list-item) {
  border-bottom: 1px solid var(--color-border);
}

.yiveno-list--divider-line :deep(md-list-item:last-child) {
  border-bottom: none;
}

/* 内缩分割线 */
.yiveno-list--divider-inset :deep(md-list-item) {
  position: relative;
}

.yiveno-list--divider-inset :deep(md-list-item::after) {
  position: absolute;
  right: 0;
  bottom: 0;
  left: var(--spacing-4);
  height: 1px;
  background-color: var(--color-border);
  content: '';
}

.yiveno-list--divider-inset :deep(md-list-item:last-child::after) {
  display: none;
}

/* ========== 变体样式 ========== */

/* 菜单变体：更紧凑的样式 */
.yiveno-list--menu :deep(md-list-item) {
  --md-list-item-one-line-container-height: 40px;
  --md-list-item-top-space: var(--spacing-2);
  --md-list-item-bottom-space: var(--spacing-2);
}

/* 默认变体：标准样式 */
.yiveno-list--default :deep(md-list-item) {
  --md-list-item-one-line-container-height: 56px;
}
</style>
