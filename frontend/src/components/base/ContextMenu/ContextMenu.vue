<!--
  📋 上下文菜单组件
  
  功能：
  1. 显示右键菜单
  2. 自动计算位置（防止超出视口）
  3. 点击外部自动关闭
  4. 支持图标、快捷键提示、分隔线
  5. 支持禁用状态和颜色主题
  6. 键盘导航（上下箭头、Enter、ESC）
  
  说明：使用 MWC `md-list` / `md-list-item`。图标必须放在带 `slot="start"` 的
  原生元素（如 span）内，便于浏览器将 light DOM 正确分配到 Shadow 的 start 槽。
-->

<template>
  <Teleport to="body">
    <Transition name="context-menu">
      <md-list
        v-if="show"
        ref="menuRef"
        role="menu"
        class="context-menu"
        :style="menuStyle"
        tabindex="-1"
        @keydown="handleKeyDown"
      >
        <md-list-item
          v-for="(item, index) in visibleItems"
          :key="item.id"
          :ref="el => setItemRef(el as HTMLElement, index)"
          type="button"
          :disabled="item.disabled"
          :class="{
            'context-menu-item--focused': focusedIndex === index,
            [`context-menu-item--${item.color}`]: item.color && item.color !== 'default'
          }"
          @click="handleItemClick(item)"
          @mouseenter="focusedIndex = index"
        >
          <span v-if="item.icon" slot="start" class="context-menu-item__start" aria-hidden="true">
            <LucideIcon :name="item.icon" :size="16" />
          </span>
          <div slot="headline" class="context-menu-item__headline">{{ item.label }}</div>
          <div v-if="item.shortcut" slot="trailing-supporting-text" class="item-shortcut">
            {{ item.shortcut }}
          </div>
        </md-list-item>
      </md-list>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, nextTick, onUnmounted, ref, watch } from 'vue'
import { LucideIcon } from '@/components/base/LucideIcon'
import type { MenuItemConfig } from '@/core/bookmark/context-menu-config'

defineOptions({ name: 'ContextMenu' })

interface Props {
  /** 是否显示菜单 */
  show: boolean
  /** 菜单项配置 */
  items: MenuItemConfig[]
  /** 菜单显示的 X 坐标 */
  x: number
  /** 菜单显示的 Y 坐标 */
  y: number
}

const props = defineProps<Props>()

const emit = defineEmits<{
  /** 菜单项被点击 */
  'item-click': [item: MenuItemConfig]
  /** 关闭菜单 */
  close: []
}>()

const menuRef = ref<HTMLElement | null>(null)
const focusedIndex = ref(0)
const itemRefs = ref<Array<HTMLElement | null>>([])

// 设置菜单项引用
const setItemRef = (el: HTMLElement | null, index: number) => {
  if (el) {
    itemRefs.value[index] = el
  }
}

// 过滤出可见的菜单项
const visibleItems = computed(() => {
  return props.items.filter(item => item.visible !== false)
})

// 计算菜单位置（防止超出视口）
const menuStyle = computed(() => {
  const style: Record<string, string> = {}

  // 初始位置
  if (!menuRef.value) {
    style.left = `${props.x}px`
    style.top = `${props.y}px`
    return style
  }

  const menuRect = menuRef.value.getBoundingClientRect()
  const viewportWidth = window.innerWidth
  const viewportHeight = window.innerHeight

  // 水平方向：优先右侧，超出则左侧
  if (props.x + menuRect.width > viewportWidth) {
    style.right = `${viewportWidth - props.x}px`
  } else {
    style.left = `${props.x}px`
  }

  // 垂直方向：优先下方，超出则上方
  if (props.y + menuRect.height > viewportHeight) {
    style.bottom = `${viewportHeight - props.y}px`
  } else {
    style.top = `${props.y}px`
  }

  return style
})

/**
 * 处理键盘导航
 */
const handleKeyDown = (event: KeyboardEvent) => {
  const items = visibleItems.value

  switch (event.key) {
    case 'ArrowDown': {
      event.preventDefault()
      // 向下移动，跳过禁用项
      let nextIndex = focusedIndex.value + 1
      while (nextIndex < items.length && items[nextIndex].disabled) {
        nextIndex++
      }
      // 循环到第一项
      if (nextIndex >= items.length) {
        nextIndex = 0
        while (nextIndex < items.length && items[nextIndex].disabled) {
          nextIndex++
        }
      }
      if (nextIndex < items.length) {
        focusedIndex.value = nextIndex
      }
      break
    }

    case 'ArrowUp': {
      event.preventDefault()
      // 向上移动，跳过禁用项
      let prevIndex = focusedIndex.value - 1
      while (prevIndex >= 0 && items[prevIndex].disabled) {
        prevIndex--
      }
      // 循环到最后一项
      if (prevIndex < 0) {
        prevIndex = items.length - 1
        while (prevIndex >= 0 && items[prevIndex].disabled) {
          prevIndex--
        }
      }
      if (prevIndex >= 0) {
        focusedIndex.value = prevIndex
      }
      break
    }

    case 'ArrowLeft': {
      // 左箭头键：关闭菜单
      event.preventDefault()
      emit('close')
      break
    }

    case 'Enter':
    case ' ': {
      event.preventDefault()
      const item = items[focusedIndex.value]
      if (item && !item.disabled) {
        handleItemClick(item)
      }
      break
    }

    case 'Escape': {
      event.preventDefault()
      emit('close')
      break
    }
  }
}

/**
 * 处理菜单项点击
 */
const handleItemClick = (item: MenuItemConfig) => {
  if (item.disabled) return
  emit('item-click', item)
  emit('close')
}

/**
 * 处理点击外部关闭
 */
const handleClickOutside = (event: MouseEvent) => {
  if (menuRef.value && !menuRef.value.contains(event.target as Node)) {
    emit('close')
  }
}

// 监听显示状态，添加/移除事件监听器
watch(
  () => props.show,
  async (newShow) => {
    if (newShow) {
      // 重置焦点到第一个可用项
      focusedIndex.value = 0
      const items = visibleItems.value
      while (focusedIndex.value < items.length && items[focusedIndex.value].disabled) {
        focusedIndex.value++
      }

      // 等待 DOM 更新后聚焦
      await nextTick()

      // 聚焦到菜单容器，启用键盘导航
      if (menuRef.value) {
        menuRef.value.focus()
      }

      // 添加点击外部关闭的监听器
      setTimeout(() => {
        document.addEventListener('click', handleClickOutside)
      }, 0)
    } else {
      document.removeEventListener('click', handleClickOutside)
      itemRefs.value = []
    }
  }
)

// 组件卸载时清理事件监听器
onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<style scoped>
.context-menu {
  position: fixed;
  z-index: 9999;
  min-width: 180px;
  max-width: 280px;
  padding: 0;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  outline: none;
  background: var(--color-surface);
  user-select: none;
  overflow: hidden;
  box-shadow: var(--shadow-lg);
}

.item-shortcut {
  font-size: var(--text-xs);
  color: var(--color-text-secondary);
}

.context-menu-item__start {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
}

.context-menu-item__headline {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Material Web Components 样式 */
md-list {
  --md-list-container-color: transparent;
}

md-list-item {
  --md-list-item-label-text-color: var(--md-sys-color-on-surface);
  --md-list-item-trailing-supporting-text-color: var(--md-sys-color-on-surface-variant);
  --md-list-item-container-shape: 0;
  --md-list-item-label-text-font: var(--font-family-base);
  --md-list-item-label-text-size: var(--md-sys-typescale-body-medium-size);
  --md-list-item-one-line-container-height: 48px;
  --md-list-item-hover-state-layer-color: var(--md-sys-color-on-surface);
  --md-list-item-hover-state-layer-opacity: 0.08;
  --md-list-item-disabled-label-text-color: var(--color-text-disabled);
  --md-list-item-disabled-label-text-opacity: 0.5;

  border-bottom: 1px solid var(--color-border);
}

md-list-item:last-child {
  border-bottom: none;
}

/* 焦点状态 */
.context-menu-item--focused {
  background: var(--color-surface-variant);
}

/* 颜色主题 */
.context-menu-item--error {
  --md-list-item-label-text-color: var(--color-error);
}

.context-menu-item--error:hover,
.context-menu-item--error.context-menu-item--focused {
  --md-list-item-label-text-color: var(--color-on-error, var(--color-surface));
  --md-list-item-hover-state-layer-color: var(--color-error);
  --md-list-item-hover-state-layer-opacity: 1;
}

.context-menu-item--warning {
  --md-list-item-label-text-color: var(--color-warning);
}

.context-menu-item--warning:hover,
.context-menu-item--warning.context-menu-item--focused {
  --md-list-item-hover-state-layer-color: var(--color-warning-subtle);
  --md-list-item-hover-state-layer-opacity: 1;
}

.context-menu-item--success {
  --md-list-item-label-text-color: var(--color-success);
}

.context-menu-item--success:hover,
.context-menu-item--success.context-menu-item--focused {
  --md-list-item-hover-state-layer-color: var(--color-success-subtle);
  --md-list-item-hover-state-layer-opacity: 1;
}

.context-menu-item--primary {
  --md-list-item-label-text-color: var(--color-primary);
}

.context-menu-item--primary:hover,
.context-menu-item--primary.context-menu-item--focused {
  --md-list-item-hover-state-layer-color: var(--color-primary-subtle);
  --md-list-item-hover-state-layer-opacity: 1;
}

/* 动画 */
.context-menu-enter-active,
.context-menu-leave-active {
  transition:
    opacity var(--md-sys-motion-duration-short2)
      var(--md-sys-motion-easing-standard),
    transform var(--md-sys-motion-duration-short2)
      var(--md-sys-motion-easing-standard);
}

.context-menu-enter-from {
  opacity: 0;
  transform: scale(0.95) translateY(-4px);
}

.context-menu-leave-to {
  opacity: 0;
  transform: scale(0.95) translateY(-4px);
}
</style>
