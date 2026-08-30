<script setup lang="ts">
/**
 * 页内分区 Tab（侧栏 / 窄屏顶栏 chips）；WAI-ARIA Tabs 模式。
 * 跨页导航用 AppPageHeader nav，不用本组件。
 */
import { computed } from 'vue'

import { resolveAppSectionTabIndex } from '@/infrastructure/ui/app-section-tabs-keyboard'

defineOptions({ name: 'AppSectionTabs' })

const props = withDefaults(
  defineProps<{
    items: readonly AppSectionTabItem[]
    /** 当前选中分区 id */
    modelValue: string
    /** tablist 无障碍名称（经 t()） */
    ariaLabel: string
    /** 关联 tabpanel 的 DOM id */
    panelId: string
    /** tab 按钮 id 前缀（父组件 useId()，便于 tabpanel aria-labelledby） */
    idPrefix: string
    /** side=竖排；top=横排；responsive=宽屏竖排、≤640px 横排 */
    layout?: 'side' | 'top' | 'responsive'
  }>(),
  {
    layout: 'responsive'
  }
)

const emit = defineEmits<{
  'update:modelValue': [id: string]
}>()

/** Tab 项：id 与右侧面板切换值一致；label 由父组件经 t() 解析后传入。 */
export interface AppSectionTabItem {
  id: string
  label: string
}

const tabOrientation = computed<'horizontal' | 'vertical'>(() => {
  if (props.layout === 'top') {
    return 'horizontal'
  }
  if (props.layout === 'side') {
    return 'vertical'
  }
  return 'vertical'
})

function tabButtonId(itemId: string): string {
  return `${props.idPrefix}-tab-${itemId}`
}

function selectTab(id: string): void {
  if (id === props.modelValue) {
    return
  }
  emit('update:modelValue', id)
}

/** 方向键 / Home / End 在 tab 间移动焦点与选中态。 */
function onTabKeyDown(event: KeyboardEvent, index: number): void {
  const nextIndex = resolveAppSectionTabIndex({
    key: event.key,
    currentIndex: index,
    lastIndex: props.items.length - 1
  })
  if (nextIndex === null) {
    return
  }

  event.preventDefault()
  const nextItem = props.items[nextIndex]
  if (!nextItem) {
    return
  }
  selectTab(nextItem.id)
  document.getElementById(tabButtonId(nextItem.id))?.focus()
}
</script>

<template>
  <div
    class="app-section-tabs"
    :class="{
      'app-section-tabs--side': layout === 'side',
      'app-section-tabs--top': layout === 'top',
      'app-section-tabs--responsive': layout === 'responsive'
    }"
    role="tablist"
    :aria-label="ariaLabel"
    :aria-orientation="tabOrientation"
  >
    <button
      v-for="(item, index) in items"
      :id="tabButtonId(item.id)"
      :key="item.id"
      type="button"
      role="tab"
      class="app-section-tabs__tab"
      :class="{ 'app-section-tabs__tab--active': modelValue === item.id }"
      :aria-selected="modelValue === item.id"
      :aria-controls="panelId"
      :tabindex="modelValue === item.id ? 0 : -1"
      @click="selectTab(item.id)"
      @keydown="onTabKeyDown($event, index)"
    >
      {{ item.label }}
    </button>
  </div>
</template>

<style scoped>
.app-section-tabs {
  display: grid;
  gap: var(--space-xs);
  padding: var(--space-xs);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: var(--surface-raised);
}

.app-section-tabs--side,
.app-section-tabs--responsive {
  grid-auto-flow: row;
}

.app-section-tabs--top {
  grid-auto-flow: column;
  grid-auto-columns: 1fr;
}

.app-section-tabs__tab {
  margin: 0;
  padding: var(--space-sm);
  border: none;
  border-radius: var(--radius-sm);
  font: inherit;
  font-size: 14px;
  font-weight: 600;
  text-align: left;
  color: var(--on-surface-muted);
  background: transparent;
  cursor: pointer;
  transition:
    background-color var(--motion-duration-fast) var(--motion-easing-standard),
    color var(--motion-duration-fast) var(--motion-easing-standard);
}

.app-section-tabs--top .app-section-tabs__tab {
  text-align: center;
}

.app-section-tabs__tab:hover {
  background: color-mix(in srgb, var(--on-surface) 6%, transparent);
}

.app-section-tabs__tab:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 2px;
}

.app-section-tabs__tab--active {
  color: var(--on-surface);
  background: var(--surface-accent-soft);
}

.app-section-tabs__tab--active:hover {
  background: var(--surface-accent-soft);
}

@media (width <= 640px) {
  .app-section-tabs--responsive {
    grid-auto-flow: column;
    grid-auto-columns: 1fr;
  }

  .app-section-tabs--responsive .app-section-tabs__tab {
    text-align: center;
  }
}
</style>
