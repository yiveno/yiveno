<template>
  <Teleport to="body">
    <Transition name="dialog" appear>
      <div
        v-if="show"
        :class="dialogClasses"
        tabindex="-1"
        @click.self="handleBackdropClick"
        @keydown="handleKeydown"
      >
        <Transition name="dialog-content" appear>
          <Card
            v-if="show"
            :class="contentClasses"
            elevation="high"
            :footer-visible="!!$slots.actions"
            @click.stop
          >
            <template
              v-if="$slots.header || title || $slots['header-actions']"
              #header
            >
              <div class="acuity-dialog-header">
                <div class="acuity-dialog-header-main">
                  <slot v-if="$slots.header" name="header" />
                  <template v-else>
                    <div class="acuity-dialog-title">
                      <LucideIcon
                        v-if="icon"
                        :name="icon"
                        :color="iconColor"
                        class="title-icon"
                      />
                      <span>{{ title }}</span>
                    </div>
                  </template>
                </div>
                <div
                  v-if="$slots['header-actions']"
                  class="acuity-dialog-header-actions"
                >
                  <slot name="header-actions" />
                </div>
              </div>
            </template>

            <div
              ref="bodyRef"
              :class="['acuity-dialog-body', bodyMinHeightClass]"
            >
              <slot />
            </div>
            <!-- 取消确认覆盖层 -->
            <div v-if="showCancelConfirm" class="acuity-dialog-cancel-overlay">
              <div class="acuity-dialog-cancel-box">
                <div class="cancel-text">{{ cancelConfirmText }}</div>
                <div class="cancel-actions">
                  <md-text-button @click="continueEditing">{{
                    cancelConfirmContinueText
                  }}</md-text-button>
                  <md-filled-button class="button--danger" @click="confirmCancel">{{
                    cancelConfirmOkText
                  }}</md-filled-button>
                </div>
              </div>
            </div>

            <template v-if="$slots.actions" #footer>
              <div class="acuity-dialog-actions">
                <slot name="actions" />
              </div>
            </template>
          </Card>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import type { DialogProps } from './Dialog.d'
import { Card } from '@/components'
import { LucideIcon } from '@/components/base/LucideIcon'
import '@material/web/button/filled-button.js'
import '@material/web/button/text-button.js'

const props = withDefaults(defineProps<DialogProps>(), {
  width: '480px',
  persistent: false,
  dense: false,
  hideClose: false,
  teleportTarget: 'body',
  closeOnOverlay: true,
  escToClose: true,
  cancelable: true
})

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'update:show': [value: boolean]
  open: []
  close: []
  confirm: []
}>()

const show = computed({
  get: () =>
    props.show !== undefined ? props.show : (props.modelValue ?? false),
  set: value => {
    emit('update:modelValue', value)
    emit('update:show', value)
  }
})

const dialogClasses = computed(() => [
  'acuity-dialog-overlay',
  {
    'acuity-dialog-overlay--fullscreen': props.fullscreen
  }
])

const contentClasses = computed(() => {
  const classes = ['acuity-dialog-content']
  if (props.fullscreen) classes.push('acuity-dialog-content--fullscreen')
  if (props.scrollable) classes.push('acuity-dialog-content--scrollable')
  // 映射固定尺寸（仅使用到的三种宽度）
  // width 属性会映射到 maxWidth
  if (!props.fullscreen) {
    const mw = (props.maxWidth || props.width || '').trim()
    if (mw === '480px') classes.push('acuity-dialog-content--size-480')
    else if (mw === '500px') classes.push('acuity-dialog-content--size-500')
    else if (mw === '520px') classes.push('acuity-dialog-content--size-520')
    else if (mw === '440px') classes.push('acuity-dialog-content--size-440')
  }
  return classes
})

// 将 bodyMinHeight 从字符串(px)映射到就近的类，避免内联样式
const bodyMinHeightClass = computed(() => {
  const val = (props.bodyMinHeight || '').trim()
  if (!val.endsWith('px')) return undefined
  const n = Number(val.replace('px', ''))
  const steps = [320, 360, 400, 420, 440, 480, 520, 560, 600]
  let picked = steps[0]
  for (const s of steps) {
    if (n <= s) {
      picked = s
      break
    }
    picked = s
  }
  return `min-h-${picked}`
})

const bodyRef = ref<HTMLElement | null>(null)
const showCancelConfirm = ref(false)
// ✅ 焦点管理：保存打开对话框前的焦点元素
let previousActiveElement: Element | null = null

const detectUnsaved = (): boolean => {
  if (!bodyRef.value) return false
  const inputs = Array.from(
    bodyRef.value.querySelectorAll('input, textarea')
  ) as HTMLInputElement[]
  for (const el of inputs) {
    if (el.disabled || el.readOnly) continue
    const val = (el.value || '').trim()
    if (val.length > 0) return true
  }
  // 允许使用 data-dirty 标记为脏
  const dirty = bodyRef.value.querySelector('[data-dirty="true"]')
  return !!dirty
}

const attemptCancel = () => {
  if (!props.cancelable) return // 不可取消弹窗直接忽略
  if (props.enableCancelGuard && detectUnsaved()) {
    showCancelConfirm.value = true
  } else {
    show.value = false
    emit('close')
  }
}

const confirmCancel = () => {
  showCancelConfirm.value = false
  show.value = false
  emit('close')
}

const continueEditing = () => {
  showCancelConfirm.value = false
}

// ✅ 焦点管理：对话框打开/关闭时自动保存和恢复焦点
watch(show, (isShown, wasShown) => {
  if (isShown && !wasShown) {
    // 对话框打开：保存当前焦点
    previousActiveElement = document.activeElement
    // 等待 DOM 更新后，尝试聚焦到对话框内的第一个可聚焦元素
    nextTick(() => {
      const firstFocusable = bodyRef.value?.querySelector<HTMLElement>(
        'input, textarea, button, [tabindex]:not([tabindex="-1"])'
      )
      firstFocusable?.focus()
    })
  } else if (!isShown && wasShown) {
    // 对话框关闭：恢复之前的焦点
    ;(previousActiveElement as HTMLElement)?.focus?.()
    previousActiveElement = null
  }
})

const handleBackdropClick = () => {
  attemptCancel()
}

const handleKeydown = (event: KeyboardEvent) => {
  // ESC 键由全局监听器处理（handleGlobalKeydown），这里不再处理

  // Tab键 - 检查是否有Tabs组件进行特殊处理
  if (event.key === 'Tab') {
    // 查找弹窗内当前激活的 Tab 按钮（handleKeydown 绑定在按钮上）
    const activeTabButton = document.querySelector(
      '.acuity-dialog-overlay .acuity-tabs-nav .acuity-tab--active'
    ) as HTMLButtonElement
    if (activeTabButton) {
      // 先聚焦到按钮，然后触发键盘事件
      activeTabButton.focus()
      const tabsEvent = new KeyboardEvent('keydown', {
        key: 'Tab',
        shiftKey: event.shiftKey,
        bubbles: false,
        cancelable: true
      })
      activeTabButton.dispatchEvent(tabsEvent)
      event.preventDefault()
      return
    }
  }

  // 回车键 - 确认（只有在启用时才生效）
  if (event.key === 'Enter' && props.enterToConfirm) {
    // 统一由弹窗处理，无论焦点位于何处
    emit('confirm')
    event.preventDefault()
  }
}

// 全局 ESC 键处理（确保无论焦点在哪里都能关闭弹窗）
const handleGlobalKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape' && props.escToClose) {
    attemptCancel()
    event.preventDefault()
  }
}

// Focus trap and body scroll lock
watch(
  () => show.value,
  newShow => {
    if (newShow) {
      nextTick(() => {
        document.body.style.overflow = 'hidden'
        // 添加全局 ESC 键监听
        window.addEventListener('keydown', handleGlobalKeydown)
        // 自动获得焦点以确保键盘事件能被捕获
        const overlay = document.querySelector(
          '.acuity-dialog-overlay'
        ) as HTMLElement
        if (overlay) {
          overlay.focus()
        }
      })
    } else {
      document.body.style.overflow = ''
      // 移除全局 ESC 键监听
      window.removeEventListener('keydown', handleGlobalKeydown)
    }
  }
)

// 组件卸载时清理
onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleGlobalKeydown)
})
</script>

<style scoped>
/**
 * ✨ 淡入动画 - 用于弹窗内容
 */
@keyframes fade-in {
  from {
    opacity: 0;
  }

  to {
    opacity: 1;
  }
}

/**
 * ♿ 可访问性：尊重用户的动画偏好
 */
@media (prefers-reduced-motion: reduce) {
  .acuity-dialog-overlay,
  .acuity-dialog-content {
    transition: none !important;
    animation: none !important;
  }
  
  .dialog-enter-active,
  .dialog-leave-active,
  .dialog-content-enter-active,
  .dialog-content-leave-active {
    transition: none !important;
  }
}

.acuity-dialog-overlay {
  position: fixed;
  inset: 0;
  z-index: 10000;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: var(--spacing-lg);
  outline: none; /* 移除焦点轮廓 */
  
  /* ✨ 优化背景遮罩：更深的颜色 + 更强的模糊 */
  background: rgb(0 0 0 / 70%);
  backdrop-filter: blur(8px);
  
  /* ✨ 性能优化 */
  will-change: opacity, backdrop-filter;
}

.acuity-dialog-overlay--fullscreen {
  padding: 0;
}

.acuity-dialog-content {
  display: flex;
  flex-direction: column;
  max-height: 90vh;
  
  /* ✨ 改进弹窗阴影：多层次阴影 */
  box-shadow: 
    0 8px 32px rgb(0 0 0 / 20%),
    0 4px 16px rgb(0 0 0 / 15%),
    0 0 0 1px rgb(255 255 255 / 5%);
  
  /* ✨ 性能优化 */
  will-change: transform, opacity;
}

.acuity-dialog-content--scrollable {
  overflow: hidden;
}

.acuity-dialog-content--fullscreen {
  width: 100%;
  min-width: 100%;
  max-width: 100%;
  height: 100%;
  max-height: 100vh;
  border-radius: 0;
}

.acuity-dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--spacing-md);
  padding: var(--spacing-lg);
  padding-right: 0;
  padding-left: 0;
}

.acuity-dialog-header-main {
  display: flex;
  flex: 1;
  align-items: center;
  min-width: 0;
}

.acuity-dialog-header-actions {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: var(--spacing-sm);
}

.acuity-dialog-title {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  min-width: 0;
  font-size: var(--text-lg);
  font-weight: var(--font-semibold);
  color: var(--color-text-primary);
}

.acuity-dialog-title span {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 为自定义header slot内容提供样式基类 */
.acuity-dialog-header .custom-header {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  padding: 0 var(--spacing-lg);
  font-size: var(--text-lg);
  font-weight: var(--font-semibold);
  color: var(--color-text-primary);
}

.title-icon {
  flex-shrink: 0;
}

.acuity-dialog-body {
  flex: 1;
  font-size: var(--md-sys-typescale-body-large-size); /* 16px */
  line-height: 1.75;
  overflow-y: auto;
}

/* 取消确认覆盖层 */
.acuity-dialog-cancel-overlay {
  position: absolute;
  inset: 0;
  z-index: 10;
  display: flex;
  justify-content: center;
  align-items: center;
  background: rgb(0 0 0 / 35%);
}

.acuity-dialog-cancel-box {
  width: 420px;
  max-width: 90%;
  padding: var(--spacing-lg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  
  /* ✨ 优化取消确认框阴影 */
  box-shadow: 
    0 12px 48px rgb(0 0 0 / 25%),
    0 6px 24px rgb(0 0 0 / 20%),
    0 0 0 1px rgb(255 255 255 / 8%);
  
  /* ✨ 淡入动画 */
  animation: fade-in var(--anim-duration-fast) var(--anim-ease-standard);
}

.cancel-text {
  margin-bottom: var(--spacing-md);
  font-size: var(--text-base);
  color: var(--color-text-primary);
}

.cancel-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--spacing-md);
}

.acuity-dialog-actions {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: var(--spacing-md);
  padding: var(--spacing-md);
}

/* 固定宽度尺寸（避免内联样式） */
.acuity-dialog-content--size-440 {
  min-width: 440px;
  max-width: 440px;
}

.acuity-dialog-content--size-480 {
  min-width: 480px;
  max-width: 480px;
}

.acuity-dialog-content--size-500 {
  min-width: 500px;
  max-width: 500px;
}

.acuity-dialog-content--size-520 {
  min-width: 520px;
  max-width: 520px;
}

/* 主体最小高度类（就近映射） */
.acuity-dialog-body.min-h-320 {
  min-height: 320px;
}

.acuity-dialog-body.min-h-360 {
  min-height: 360px;
}

.acuity-dialog-body.min-h-400 {
  min-height: 400px;
}

.acuity-dialog-body.min-h-420 {
  min-height: 420px;
}

.acuity-dialog-body.min-h-440 {
  min-height: 440px;
}

.acuity-dialog-body.min-h-480 {
  min-height: 480px;
}

.acuity-dialog-body.min-h-520 {
  min-height: 520px;
}

.acuity-dialog-body.min-h-560 {
  min-height: 560px;
}

.acuity-dialog-body.min-h-600 {
  min-height: 600px;
}

/* ===============================================
   ✨ 弹窗动画优化
   =============================================== */

/**
 * 背景遮罩动画
 * - 淡入淡出
 * - 模糊效果渐变
 */
.dialog-enter-active,
.dialog-leave-active {
  transition: 
    opacity var(--anim-duration-normal) var(--anim-ease-standard),
    backdrop-filter var(--anim-duration-normal) var(--anim-ease-standard);
}

.dialog-enter-from {
  opacity: 0;
  backdrop-filter: blur(0);
}

.dialog-leave-to {
  opacity: 0;
  backdrop-filter: blur(0);
}

/**
 * 弹窗内容动画
 * - 缩放 + 淡入
 * - 使用 emphasized 缓动函数增强动感
 * - 从 0.92 缩放到 1.0 (更微妙的效果)
 * - 轻微上浮效果 (translateY)
 */
.dialog-content-enter-active {
  transition: 
    opacity var(--anim-duration-normal) var(--anim-ease-emphasized),
    transform var(--anim-duration-normal) var(--anim-ease-emphasized);
}

.dialog-content-leave-active {
  transition: 
    opacity var(--anim-duration-fast) var(--anim-ease-standard),
    transform var(--anim-duration-fast) var(--anim-ease-standard);
}

.dialog-content-enter-from {
  opacity: 0;
  transform: scale(0.92) translateY(16px);
}

.dialog-content-leave-to {
  opacity: 0;
  transform: scale(0.96) translateY(8px);
}

/* ✅ 键盘快捷键提示样式 */
.keyboard-hint {
  display: inline-block;
  margin-left: var(--spacing-1);
  padding: 2px 6px;
  border: 1px solid var(--color-border);
  border-radius: var(--border-radius-xs, 3px);
  font-family: var(--font-family-mono, monospace);
  font-size: var(--text-2xs, 10px);
  font-weight: 600;
  line-height: 1;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--color-text-tertiary);
  background: var(--color-surface-variant);
  box-shadow: 0 1px 2px rgb(0 0 0 / 5%);
  vertical-align: middle;
}

/* Button 组件内的键盘提示需要适配按钮颜色 */
:deep(.btn--primary .keyboard-hint) {
  border-color: rgb(255 255 255 / 30%);
  color: var(--color-text-on-primary);
  background: rgb(255 255 255 / 20%);
}

:deep(.btn--text .keyboard-hint),
:deep(.btn--ghost .keyboard-hint) {
  color: var(--color-text-secondary);
  background: var(--color-surface);
}
</style>
