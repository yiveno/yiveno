<script setup lang="ts">
/**
 * 带弹出菜单的按钮：hover 预展开 + click 切换；支持键盘 Esc 关闭与点击外部关闭。
 */
import { onBeforeUnmount, ref, watch } from 'vue'

import AppIcon from '@/infrastructure/ui/icons/AppIcon.vue'
import type { AppIconName } from '@/infrastructure/ui/icons/icon-paths'

defineOptions({ name: 'AppMenuButton' })

export type AppMenuPlacement = 'top' | 'bottom'

export type AppMenuButtonItem = {
  id: string
  label: string
}

const props = withDefaults(
  defineProps<{
    label: string
    items: AppMenuButtonItem[]
    disabled?: boolean
    /** filled=主强调；outlined=描边；text=文字 */
    variant?: 'filled' | 'tonal' | 'outlined' | 'text'
    /** 菜单相对触发器弹出方向 */
    placement?: AppMenuPlacement
    icon?: AppIconName
    ariaLabel?: string
  }>(),
  {
    disabled: false,
    variant: 'outlined',
    placement: 'top'
  }
)

const emit = defineEmits<{
  select: [id: string]
}>()

const open = ref(false)
const rootRef = ref<HTMLElement | null>(null)
let openTimer: ReturnType<typeof setTimeout> | null = null
let closeTimer: ReturnType<typeof setTimeout> | null = null

const HOVER_OPEN_MS = 120
const HOVER_CLOSE_MS = 180

function clearTimers(): void {
  if (openTimer) {
    clearTimeout(openTimer)
    openTimer = null
  }
  if (closeTimer) {
    clearTimeout(closeTimer)
    closeTimer = null
  }
}

function setOpen(next: boolean): void {
  if (props.disabled) {
    open.value = false
    return
  }
  open.value = next
}

function scheduleOpen(): void {
  if (props.disabled) {
    return
  }
  clearTimers()
  openTimer = setTimeout(() => setOpen(true), HOVER_OPEN_MS)
}

function scheduleClose(): void {
  clearTimers()
  closeTimer = setTimeout(() => setOpen(false), HOVER_CLOSE_MS)
}

function handlePointerEnter(): void {
  scheduleOpen()
}

function handlePointerLeave(): void {
  scheduleClose()
}

function handleTriggerClick(): void {
  if (props.disabled) {
    return
  }
  clearTimers()
  setOpen(!open.value)
}

function handleItemClick(id: string): void {
  emit('select', id)
  setOpen(false)
}

function onDocumentPointerDown(event: PointerEvent): void {
  const root = rootRef.value
  if (!root || !open.value) {
    return
  }
  if (!root.contains(event.target as Node)) {
    setOpen(false)
  }
}

function onDocumentKeyDown(event: KeyboardEvent): void {
  if (event.key === 'Escape' && open.value) {
    event.preventDefault()
    setOpen(false)
  }
}

function bindDocumentListeners(): void {
  document.addEventListener('pointerdown', onDocumentPointerDown, true)
  document.addEventListener('keydown', onDocumentKeyDown)
}

function unbindDocumentListeners(): void {
  document.removeEventListener('pointerdown', onDocumentPointerDown, true)
  document.removeEventListener('keydown', onDocumentKeyDown)
}

watch(
  () => props.disabled,
  disabled => {
    if (disabled) {
      setOpen(false)
    }
  }
)

watch(open, isOpen => {
  if (isOpen) {
    bindDocumentListeners()
    return
  }
  unbindDocumentListeners()
})

onBeforeUnmount(() => {
  clearTimers()
  unbindDocumentListeners()
})
</script>

<template>
  <div
    ref="rootRef"
    class="app-menu-button"
    :class="[`app-menu-button--${placement}`, { 'app-menu-button--open': open }]"
    @pointerenter="handlePointerEnter"
    @pointerleave="handlePointerLeave"
  >
    <button
      type="button"
      class="app-menu-button__trigger"
      :class="[`app-menu-button__trigger--${variant}`, { 'app-menu-button__trigger--open': open }]"
      :disabled="disabled"
      :aria-label="ariaLabel ?? label"
      :title="label"
      aria-haspopup="menu"
      :aria-expanded="open"
      @click="handleTriggerClick"
    >
      <AppIcon v-if="icon" :name="icon" size="18px" aria-hidden="true" />
      <span class="app-menu-button__label">{{ label }}</span>
      <AppIcon class="app-menu-button__chevron" name="expand_more" size="16px" aria-hidden="true" />
    </button>

    <div v-if="open" class="app-menu-button__flyout">
      <div class="app-menu-button__panel" role="menu" :aria-label="label">
        <button
          v-for="item in items"
          :key="item.id"
          type="button"
          class="app-menu-button__item"
          role="menuitem"
          @click="handleItemClick(item.id)"
        >
          {{ item.label }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.app-menu-button {
  position: relative;
  display: inline-flex;
}

.app-menu-button__trigger {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2xs);
  min-height: 40px;
  padding: 0 var(--space-md);
  border: 1px solid transparent;
  border-radius: var(--radius-full);
  font: inherit;
  font-size: 0.875rem;
  font-weight: 500;
  line-height: 1.25;
  cursor: pointer;
  transition:
    background-color var(--motion-duration-fast) var(--motion-easing-standard),
    color var(--motion-duration-fast) var(--motion-easing-standard),
    border-color var(--motion-duration-fast) var(--motion-easing-standard),
    opacity var(--motion-duration-fast) var(--motion-easing-standard);
}

.app-menu-button__trigger:disabled {
  cursor: not-allowed;
  opacity: var(--disabled-opacity);
}

.app-menu-button__trigger--outlined {
  border-color: var(--border);
  background: var(--surface-white);
  color: var(--on-surface);
}

.app-menu-button__trigger--outlined:hover:not(:disabled),
.app-menu-button__trigger--outlined.app-menu-button__trigger--open:not(:disabled) {
  background: color-mix(
    in srgb,
    var(--on-surface) calc(var(--state-hover-opacity) * 100%),
    transparent
  );
}

.app-menu-button__trigger--filled {
  border-color: var(--accent);
  background: var(--accent);
  color: var(--on-accent);
}

.app-menu-button__trigger--filled:hover:not(:disabled),
.app-menu-button__trigger--filled.app-menu-button__trigger--open:not(:disabled) {
  background: var(--accent-hover);
  border-color: var(--accent-hover);
}

.app-menu-button__trigger:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 2px;
}

.app-menu-button__label {
  white-space: nowrap;
}

.app-menu-button__chevron {
  flex-shrink: 0;
  opacity: 0.72;
  transition: transform var(--motion-duration-fast) var(--motion-easing-standard);
}

.app-menu-button--top .app-menu-button__chevron {
  transform: rotate(180deg);
}

.app-menu-button--open.app-menu-button--top .app-menu-button__chevron {
  transform: rotate(0deg);
}

.app-menu-button__flyout {
  position: absolute;
  right: 0;
  z-index: 20;
  min-width: 100%;
}

.app-menu-button--top .app-menu-button__flyout {
  bottom: 100%;
  padding-bottom: var(--space-2xs);
}

.app-menu-button--bottom .app-menu-button__flyout {
  top: 100%;
  padding-top: var(--space-2xs);
}

.app-menu-button__panel {
  display: flex;
  flex-direction: column;
  min-width: 9.5rem;
  padding: var(--space-2xs);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--surface-white);
  box-shadow: 0 8px 24px rgb(0 0 0 / 10%);
}

.app-menu-button__item {
  display: flex;
  align-items: center;
  width: 100%;
  min-height: 36px;
  padding: 0 var(--space-sm);
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--on-surface);
  font: inherit;
  font-size: 0.875rem;
  line-height: 1.25;
  text-align: left;
  cursor: pointer;
  transition: background-color var(--motion-duration-fast) var(--motion-easing-standard);
}

.app-menu-button__item:hover {
  background: color-mix(
    in srgb,
    var(--on-surface) calc(var(--state-hover-opacity) * 100%),
    transparent
  );
}

.app-menu-button__item:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: -2px;
}
</style>
