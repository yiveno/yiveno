<script setup lang="ts">
import { inject, computed, ref, watch, nextTick } from 'vue'
import { LucideIcon } from '@/components'
import type { AccordionItemProps } from './Accordion.d'

defineOptions({
  name: 'AccordionItem'
})

const props = withDefaults(defineProps<AccordionItemProps>(), {
  iconSize: 16
})

// 从父组件注入
const accordion = inject<{
  toggleItem: (id: string) => void
  isItemExpanded: (id: string) => boolean
}>('accordion')

if (!accordion) {
  throw new Error('AccordionItem must be used within Accordion component')
}

// 计算是否展开
const isExpanded = computed(() => accordion.isItemExpanded(props.id))

// 内容区域引用
const contentRef = ref<HTMLDivElement | null>(null)

// 处理点击
const handleToggle = () => {
  accordion.toggleItem(props.id)
}

// ✅ 监听展开状态变化，确保 DOM 更新完成后滚动容器才能正常工作
watch(isExpanded, async newValue => {
  if (newValue && contentRef.value) {
    // 展开时：等待 DOM 完全渲染
    await nextTick()
    await nextTick() // 双重 nextTick 确保所有子组件也渲染完成

    // 强制触发滚动容器的重新计算
    const scrollContainer = contentRef.value.querySelector('.accordion-content') as HTMLElement
    if (scrollContainer) {
      // 触发浏览器重排，确保滚动高度正确计算
      void scrollContainer.offsetHeight
    }
  }
})
</script>

<template>
  <md-list-item
    class="accordion-item no-select"
    :class="{ 'accordion-item--expanded': isExpanded }"
    type="button"
    @click="handleToggle"
  >
    <span slot="start" class="accordion-header__start" aria-hidden="true">
      <LucideIcon v-if="icon" :name="icon" :size="iconSize" />
    </span>

    <div slot="headline" class="accordion-title">
      <span>{{ title }}</span>
      <slot name="badge" />
    </div>

    <span slot="end" class="accordion-header__end" aria-hidden="true">
      <LucideIcon
        :name="isExpanded ? 'chevron-down' : 'chevron-right'"
        :size="16"
        class="accordion-icon"
      />
    </span>
  </md-list-item>

  <!-- ✅ 使用 v-show 替代 v-if，避免 DOM 重新创建导致的滚动延迟 -->
  <div v-show="isExpanded" ref="contentRef" class="accordion-content" :data-accordion-id="id">
    <slot />
  </div>
</template>

<style scoped>
.accordion-item {
  --md-list-item-container-color: transparent;
  --md-list-item-label-text-font: var(--font-family-base);
  --md-list-item-label-text-size: var(--typescale-body-md-size);
  --md-list-item-label-text-weight: var(--font-weight-medium);
  --md-list-item-label-text-line-height: var(--typescale-body-md-line);
  --md-list-item-label-text-tracking: var(--typescale-body-md-tracking);
  --md-list-item-leading-space: var(--spacing-4);
  --md-list-item-trailing-space: var(--spacing-4);

  border-bottom: 1px solid var(--color-border);
}

.accordion-item:last-of-type {
  border-bottom: none;
}

.accordion-item--expanded {
  background: var(--color-surface-container);
}

.accordion-header__start,
.accordion-header__end {
  display: inline-flex;
  align-items: center;
}

.accordion-title {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-2);
  color: var(--color-text-primary);
}

.accordion-icon {
  color: var(--color-text-secondary);
  transition: transform var(--transition-fast);
}

.accordion-item--expanded .accordion-icon {
  transform: rotate(0deg);
}

.accordion-content {
  background: var(--color-surface);
}
</style>
