<script setup lang="ts">
import { provide, ref } from 'vue'
import type { AccordionProps } from './Accordion.d'

defineOptions({
  name: 'Accordion'
})

const props = withDefaults(defineProps<AccordionProps>(), {
  exclusive: true
})

// 当前展开的项目 ID
const expandedItems = ref<Set<string>>(new Set())

// 初始化默认展开项
if (props.defaultExpanded) {
  const initialExpanded = new Set<string>()
  if (Array.isArray(props.defaultExpanded)) {
    props.defaultExpanded.forEach(id => initialExpanded.add(id))
  } else {
    initialExpanded.add(props.defaultExpanded)
  }
  expandedItems.value = initialExpanded
}

/**
 * 切换项目展开状态
 */
const toggleItem = (itemId: string) => {
  const currentExpanded = expandedItems.value
  const isExpanded = currentExpanded.has(itemId)

  if (props.exclusive) {
    // 独占模式：展开一个会关闭其他
    expandedItems.value = new Set(isExpanded ? [] : [itemId])
  } else {
    // 多选模式：可以同时展开多个
    const newExpanded = new Set(currentExpanded)
    if (isExpanded) {
      newExpanded.delete(itemId)
    } else {
      newExpanded.add(itemId)
    }
    expandedItems.value = newExpanded
  }
}

/**
 * 检查项目是否展开
 */
const isItemExpanded = (itemId: string) => {
  return expandedItems.value.has(itemId)
}

// 提供给子组件使用
provide('accordion', {
  toggleItem,
  isItemExpanded
})
</script>

<template>
  <md-list class="accordion" role="presentation">
    <slot />
  </md-list>
</template>

<style scoped>
.accordion {
  display: block;
  padding: 0;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface-container-low);
  overflow: hidden;
}
</style>
