<!--
  📋 上下文菜单组件 (Material Design 3)
  
  功能：
  1. 显示右键菜单
  2. 自动计算位置（防止超出视口）
  3. 点击外部自动关闭
  4. 支持图标、快捷键提示
  5. 支持禁用状态和颜色主题
  6. 键盘导航
  
  实现说明：
  - 使用自定义容器 + Material Web 的 md-list + md-list-item
  - 手动实现定位逻辑（md-menu 不支持右键菜单场景）
  - 使用 Teleport 渲染到 body
  - 保持 Material Design 3 视觉风格
-->

<template>
  <Teleport to="body">
    <!-- 自定义菜单容器 -->
    <div
      v-if="show"
      ref="menuRef"
      class="context-menu"
      :style="menuStyle"
      @click.stop
    >
      <!-- 菜单列表 -->
      <div class="context-menu__list">
        <button
          v-for="item in visibleItems"
          :key="item.id"
          type="button"
          :disabled="item.disabled"
          class="context-menu-item"
          :class="{
            [`context-menu-item--${item.color}`]: item.color && item.color !== 'default'
          }"
          @click="handleItemClick(item)"
        >
          <!-- 图标 -->
          <span v-if="item.icon" class="context-menu-item__icon-wrapper">
            <LucideIcon
              :name="item.icon"
              :size="16"
              class="context-menu-item__icon"
            />
          </span>
          
          <!-- 标签文本 -->
          <span class="context-menu-item__label">{{ item.label }}</span>
          
          <!-- 快捷键提示 -->
          <span v-if="item.shortcut" class="context-menu-item__shortcut">
            {{ item.shortcut }}
          </span>
        </button>
      </div>
    </div>

    <!-- 点击外部关闭的遮罩 -->
    <div
      v-if="show"
      class="context-menu-backdrop"
      @click="emit('close')"
      @contextmenu.prevent="emit('close')"
    ></div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
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

// 过滤出可见的菜单项
const visibleItems = computed(() => {
  return props.items.filter(item => item.visible !== false)
})

// 计算菜单位置（防止超出视口）
const menuStyle = computed(() => {
  const style: Record<string, string> = {
    position: 'fixed',
    zIndex: '9999'
  }

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
 * 处理菜单项点击
 */
const handleItemClick = (item: MenuItemConfig) => {
  if (item.disabled) return
  emit('item-click', item)
  emit('close')
}

/**
 * 处理键盘导航
 */
const handleKeyDown = (event: KeyboardEvent) => {
  if (!props.show) return

  switch (event.key) {
    case 'Escape':
      event.preventDefault()
      emit('close')
      break
    case 'ArrowDown':
    case 'ArrowUp':
      // 键盘导航：可以在这里实现上下箭头切换焦点
      break
  }
}

// 监听显示状态变化
watch(
  () => props.show,
  async (newShow) => {
    if (newShow) {
      await nextTick()
      // 聚焦第一个可用的菜单项以支持键盘导航
      const firstItem = menuRef.value?.querySelector('.context-menu-item:not([disabled])')
      if (firstItem instanceof HTMLElement) {
        firstItem.focus()
      }
    }
  }
)

onMounted(() => {
  document.addEventListener('keydown', handleKeyDown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeyDown)
})
</script>

<style scoped>
/* 点击外部关闭的遮罩 */
.context-menu-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  z-index: 9998;
  width: 100vw;
  height: 100vh;
  background: transparent;
}

/* 菜单容器 */
.context-menu {
  position: fixed;
  z-index: 9999;
  min-width: 180px;
  max-width: 280px;
  border-radius: var(--radius-md);
  background: var(--md-sys-color-surface-container);
  overflow: hidden;
  box-shadow: var(--md-sys-elevation-3);
}

/* 菜单列表容器 */
.context-menu__list {
  margin: 0;
  padding: var(--spacing-1) 0;
}

/* 菜单项按钮 */
.context-menu-item {
  display: flex;
  align-items: center;
  gap: var(--spacing-3);
  width: 100%;
  min-height: 40px;
  padding: var(--spacing-2) var(--spacing-3);
  border: none;
  font-family: var(--font-family-base);
  font-size: var(--text-sm);
  line-height: 1.25rem;
  text-align: left;
  color: var(--md-sys-color-on-surface);
  background: transparent;
  cursor: pointer;
  transition: background-color var(--md-sys-motion-duration-short2) var(--md-sys-motion-easing-standard);
}

.context-menu-item:focus-visible {
  outline: none;
  background-color: color-mix(in srgb, var(--md-sys-color-on-surface) 12%, transparent);
}

.context-menu-item:disabled {
  color: var(--color-text-disabled);
  opacity: 0.5;
  cursor: not-allowed;
}

.context-menu-item:hover:not(:disabled) {
  background-color: color-mix(in srgb, var(--md-sys-color-on-surface) 8%, transparent);
}

/* 图标容器 */
.context-menu-item__icon-wrapper {
  display: flex;
  flex-shrink: 0;
  justify-content: center;
  align-items: center;
  width: 20px;
  height: 20px;
}

/* 图标 */
.context-menu-item__icon {
  color: var(--color-text-secondary);
}

/* 标签文本 */
.context-menu-item__label {
  flex: 1;
  min-width: 0;
  font-size: var(--text-sm);
  white-space: nowrap;
  color: var(--md-sys-color-on-surface);
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 快捷键提示 */
.context-menu-item__shortcut {
  flex-shrink: 0;
  font-size: var(--text-xs);
  color: var(--color-text-tertiary);
  opacity: 0.7;
}

/* 颜色主题 - Error（危险操作） */
.context-menu-item--error {
  color: var(--md-sys-color-error);
}

.context-menu-item--error .context-menu-item__icon {
  color: var(--md-sys-color-error);
}

.context-menu-item--error:hover:not(:disabled) {
  background-color: color-mix(in srgb, var(--md-sys-color-error) 12%, transparent);
}

/* 颜色主题 - Warning */
.context-menu-item--warning {
  color: var(--color-warning);
}

.context-menu-item--warning .context-menu-item__icon {
  color: var(--color-warning);
}

.context-menu-item--warning:hover:not(:disabled) {
  background-color: color-mix(in srgb, var(--color-warning) 12%, transparent);
}

/* 颜色主题 - Success */
.context-menu-item--success {
  color: var(--color-success);
}

.context-menu-item--success .context-menu-item__icon {
  color: var(--color-success);
}

.context-menu-item--success:hover:not(:disabled) {
  background-color: color-mix(in srgb, var(--color-success) 12%, transparent);
}

/* 颜色主题 - Primary */
.context-menu-item--primary {
  color: var(--md-sys-color-primary);
}

.context-menu-item--primary .context-menu-item__icon {
  color: var(--md-sys-color-primary);
}

.context-menu-item--primary:hover:not(:disabled) {
  background-color: color-mix(in srgb, var(--md-sys-color-primary) 12%, transparent);
}
</style>
