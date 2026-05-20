<!--
  应用对话框（基于 Material Web md-dialog）
  - 利：原生 modal + 焦点陷阱、与 M3 动效/无障碍一致、在 md-dialog 内 select 可用 menu-positioning 文档建议
  - 弊：需用 cancel/closed 事件适配原 overlay 逻辑；重度自定义动画弱于自研 Transition
  @see https://github.com/material-components/material-web/blob/main/docs/components/dialog.md
-->
<script setup lang="ts">
import {
  computed,
  nextTick,
  onBeforeUnmount,
  ref,
  useSlots,
  watch
} from 'vue'
import type { DialogProps } from './Dialog.d'
import { LucideIcon } from '@/components/base/LucideIcon'

/**
 * `md-dialog` / 按钮由各 HTML 入口 `preloadMaterialWebComponents` 在 `mount` 前注册；
 * 勿在此再写仅副作用的 `import '@material/web/...'`，避免与入口策略分叉。
 */
defineOptions({
  name: 'AcuityDialog'
})

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

const slots = useSlots()

const show = computed({
  get: () =>
    props.show !== undefined ? props.show : (props.modelValue ?? false),
  set: value => {
    emit('update:modelValue', value)
    emit('update:show', value)
  }
})

const showHeadline = computed(
  () => !!(slots.header || props.title || slots['header-actions'])
)

/** 无 headline 插槽时供屏幕阅读器使用 */
const dialogAriaLabel = computed(() => {
  if (props.title?.trim()) return props.title.trim()
  return 'AcuityBookmarks'
})

const mdDialogClasses = computed(() => [
  {
    'acuity-md-dialog--fullscreen': props.fullscreen,
    'acuity-md-dialog--scrollable': props.scrollable
  },
  ...mdDialogSizeClasses.value
])

const mdDialogSizeClasses = computed(() => {
  const classes: string[] = []
  if (props.fullscreen) return classes
  const mw = (props.maxWidth || props.width || '').trim()
  if (mw === '480px') classes.push('acuity-md-dialog--size-480')
  else if (mw === '500px') classes.push('acuity-md-dialog--size-500')
  else if (mw === '520px') classes.push('acuity-md-dialog--size-520')
  else if (mw === '440px') classes.push('acuity-md-dialog--size-440')
  return classes
})

const dialogInlineStyle = computed(() => {
  if (props.fullscreen) return undefined
  const mw = (props.maxWidth || props.width || '').trim()
  const known = ['440px', '480px', '500px', '520px']
  const style: Record<string, string> = {}
  if (props.minWidth?.trim()) {
    style.minWidth = props.minWidth.trim()
  }
  if (mw && !known.includes(mw)) {
    style.width = 'min(100vw - 32px, ' + mw + ')'
    style.maxWidth = mw
  }
  return Object.keys(style).length ? style : undefined
})

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

/** 用户通过 scrim / Esc 触发的 cancel 且未被拦截时，在 closed 中发出 close */
const userDismissedViaCancel = ref(false)

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
  const dirty = bodyRef.value.querySelector('[data-dirty="true"]')
  return !!dirty
}

/**
 * scrim / Esc 触发的 cancel：可 preventDefault 以阻止关闭（与 Material 文档一致）
 */
const handleMdCancel = (ev: Event) => {
  if (!props.cancelable) {
    ev.preventDefault()
    return
  }
  if (props.persistent) {
    ev.preventDefault()
    return
  }
  if (props.enableCancelGuard && !showCancelConfirm.value && detectUnsaved()) {
    ev.preventDefault()
    showCancelConfirm.value = true
    return
  }
  userDismissedViaCancel.value = true
}

const handleMdClosed = () => {
  emit('update:modelValue', false)
  emit('update:show', false)
  if (userDismissedViaCancel.value) {
    emit('close')
    userDismissedViaCancel.value = false
  }
}

const handleMdOpened = () => {
  emit('open')
  nextTick(() => {
    const firstFocusable = bodyRef.value?.querySelector<HTMLElement>(
      'input, textarea, button, [tabindex]:not([tabindex="-1"])'
    )
    firstFocusable?.focus()
  })
}

const confirmCancel = () => {
  showCancelConfirm.value = false
  show.value = false
  emit('close')
}

const continueEditing = () => {
  showCancelConfirm.value = false
}

const handleKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Tab') {
    const activeTabButton = bodyRef.value?.querySelector(
      '.acuity-tabs-nav .acuity-tab--active'
    ) as HTMLButtonElement
    if (activeTabButton) {
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

  if (event.key === 'Enter' && props.enterToConfirm) {
    emit('confirm')
    event.preventDefault()
  }
}

/** escToClose 为 false 时仅拦截 Esc，不拦截 scrim（与旧版 window 监听行为一致） */
let escapeBlockHandler: ((e: KeyboardEvent) => void) | null = null

const detachEscapeBlock = () => {
  if (escapeBlockHandler) {
    window.removeEventListener('keydown', escapeBlockHandler, true)
    escapeBlockHandler = null
  }
}

watch(
  () => [show.value, props.escToClose, props.persistent] as const,
  ([isOpen, escToClose, persistent]) => {
    detachEscapeBlock()
    if (!isOpen || persistent || escToClose) {
      return
    }
    escapeBlockHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
      }
    }
    window.addEventListener('keydown', escapeBlockHandler, true)
  },
  { immediate: true }
)

watch(show, isShown => {
  if (!isShown) {
    showCancelConfirm.value = false
    userDismissedViaCancel.value = false
  }
})

onBeforeUnmount(() => {
  detachEscapeBlock()
})
</script>

<template>
  <Teleport :to="teleportTarget">
    <md-dialog
      class="acuity-md-dialog"
      :class="mdDialogClasses"
      :style="dialogInlineStyle"
      :open="show"
      :quick="dense"
      :aria-label="dialogAriaLabel"
      @cancel="handleMdCancel"
      @closed="handleMdClosed"
      @opened="handleMdOpened"
    >
      <!-- headline：与 md-dialog 无障碍约定一致（无标题时用 aria-label） -->
      <div v-if="showHeadline" slot="headline" class="acuity-dialog-header">
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

      <div
        slot="content"
        class="acuity-dialog-content-slot"
        @keydown="handleKeydown"
      >
        <div
          ref="bodyRef"
          :class="['acuity-dialog-body', bodyMinHeightClass]"
        >
          <slot />
        </div>
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
      </div>

      <div v-if="$slots.actions" slot="actions" class="acuity-dialog-actions">
        <slot name="actions" />
      </div>
    </md-dialog>
  </Teleport>
</template>

<style scoped>
/**
 * ♿ 尊重用户的动画偏好（Material 内部动画另受组件 quick 控制）
 */
@media (prefers-reduced-motion: reduce) {
  .acuity-md-dialog {
    --md-dialog-container-motion-duration: 0ms;
  }
}

.acuity-md-dialog {
  --md-dialog-container-shape: var(--radius-lg);

  max-height: min(90vh, 900px);
}

.acuity-md-dialog--fullscreen {
  width: 100vw;
  max-width: 100vw;
  height: 100vh;
  max-height: 100vh;
}

.acuity-md-dialog--scrollable :deep(.scroller) {
  max-height: min(70vh, 640px);
}

.acuity-md-dialog--size-440 {
  width: min(100vw - 32px, 440px);
  min-width: min(100vw - 32px, 440px);
  max-width: 440px;
}

.acuity-md-dialog--size-480 {
  width: min(100vw - 32px, 480px);
  min-width: min(100vw - 32px, 480px);
  max-width: 480px;
}

.acuity-md-dialog--size-500 {
  width: min(100vw - 32px, 500px);
  min-width: min(100vw - 32px, 500px);
  max-width: 500px;
}

.acuity-md-dialog--size-520 {
  width: min(100vw - 32px, 520px);
  min-width: min(100vw - 32px, 520px);
  max-width: 520px;
}

.acuity-dialog-content-slot {
  position: relative;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.acuity-dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--spacing-md);
  padding: var(--spacing-md) var(--spacing-lg) 0;
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

.title-icon {
  flex-shrink: 0;
}

.acuity-dialog-body {
  flex: 1;
  padding: var(--spacing-lg);
  font-size: var(--md-sys-typescale-body-large-size);
  line-height: 1.75;
  overflow-y: auto;
}

.acuity-dialog-cancel-overlay {
  position: absolute;
  inset: 0;
  z-index: 10;
  display: flex;
  justify-content: center;
  align-items: center;
  background: var(--color-scrim-35);
}

.acuity-dialog-cancel-box {
  width: 420px;
  max-width: 90%;
  padding: var(--spacing-lg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  box-shadow:
    0 12px 48px var(--color-shadow-025),
    0 6px 24px var(--color-shadow-020),
    0 0 0 1px var(--color-surface-edge-010);
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
  flex-wrap: wrap;
  justify-content: flex-end;
  align-items: center;
  gap: var(--spacing-md);
  padding: var(--spacing-sm) var(--spacing-md) var(--spacing-md);
}

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
  box-shadow: 0 1px 2px var(--color-shadow-005);
  vertical-align: middle;
}

:deep(.btn--primary .keyboard-hint) {
  border-color: var(--color-on-primary-faint-030);
  color: var(--color-text-on-primary);
  background: var(--color-on-primary-faint-020);
}

:deep(.btn--text .keyboard-hint),
:deep(.btn--ghost .keyboard-hint) {
  color: var(--color-text-secondary);
  background: var(--color-surface);
}
</style>
