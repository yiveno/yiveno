<script setup lang="ts">
/**
 * 悬停 / 键盘焦点时在触发器上方弹出的说明。
 * 无 title 时不渲染气泡（例如控件禁用、不需要提示）。
 */
defineOptions({ name: 'AppHoverTip' })

withDefaults(
  defineProps<{
    /** 气泡标题；空字符串则不显示 */
    title?: string
    /** 标题下的补充说明 */
    hint?: string
    /**
     * 气泡水平对齐。
     * - start：贴触发器左侧
     * - center：相对触发器水平居中
     * - end：贴触发器右侧
     */
    align?: 'start' | 'center' | 'end'
    /** 在 flex 行里吃满一格，子按钮可拉满 */
    fill?: boolean
  }>(),
  {
    title: '',
    hint: '',
    align: 'center',
    fill: false
  }
)
</script>

<template>
  <span class="app-hover-tip" :class="{ 'app-hover-tip--fill': fill }">
    <slot />
    <span
      v-if="title"
      class="app-hover-tip__bubble"
      :class="{
        'app-hover-tip__bubble--start': align === 'start',
        'app-hover-tip__bubble--end': align === 'end'
      }"
      role="tooltip"
    >
      <span class="app-hover-tip__title">{{ title }}</span>
      <span v-if="hint" class="app-hover-tip__hint">{{ hint }}</span>
    </span>
  </span>
</template>

<style scoped>
.app-hover-tip {
  position: relative;
  display: inline-flex;
}

.app-hover-tip--fill {
  display: flex;
  flex: 1 1 0;
  min-width: 0;
}

.app-hover-tip__bubble {
  position: absolute;
  bottom: calc(100% + var(--space-2xs));
  left: 50%;
  z-index: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
  width: max-content;
  max-width: 14rem;
  padding: var(--space-2xs) var(--space-xs);
  border-radius: var(--radius-sm);
  font-size: 12px;
  font-weight: 500;
  line-height: 1.3;
  text-align: left;
  color: var(--surface-white);
  background: var(--on-surface);
  opacity: 0;
  pointer-events: none;
  transform: translateX(-50%);
}

.app-hover-tip__bubble--start {
  left: 0;
  transform: none;
}

.app-hover-tip__bubble--end {
  right: 0;
  left: auto;
  transform: none;
}

.app-hover-tip__title {
  font-weight: 600;
}

.app-hover-tip__hint {
  font-weight: 400;
  color: color-mix(in srgb, var(--surface-white) 78%, transparent);
}

.app-hover-tip:hover .app-hover-tip__bubble,
.app-hover-tip:focus-within .app-hover-tip__bubble {
  opacity: 1;
}
</style>
