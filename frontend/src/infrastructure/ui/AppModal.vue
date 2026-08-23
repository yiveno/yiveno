<script setup lang="ts">
/**
 * Yiveno Modal Dialog：遮罩 + 卡片 + 标题/内容/操作区；内置 Esc、焦点陷阱。
 */
import { nextTick, onUnmounted, ref, useId, watch } from 'vue'

import { bindModalFocusTrap } from '@/infrastructure/ui/use-modal-focus-trap'

defineOptions({ name: 'AppModal' })

const props = withDefaults(
  defineProps<{
    /** 受控显隐 */
    open: boolean
    /** 标题（aria-labelledby） */
    title: string
    /** 副文案（aria-describedby） */
    description?: string | undefined
    /** sm=420px；md=520px（多选项弹层） */
    size?: 'sm' | 'md'
    /** 点遮罩关闭；表单/危险操作默认 false */
    closeOnBackdrop?: boolean
    /** Esc 关闭 */
    closeOnEscape?: boolean
    /** 进行中时禁止关闭 */
    loading?: boolean
  }>(),
  {
    size: 'sm',
    closeOnBackdrop: false,
    closeOnEscape: true,
    loading: false
  }
)

const emit = defineEmits<{
  close: []
}>()

const panelRef = ref<HTMLElement | null>(null)
const titleId = useId()
const descriptionId = `${titleId}-desc`
let releaseFocusTrap: (() => void) | null = null
let releaseEscapeListener: (() => void) | null = null

function requestClose(): void {
  if (props.loading) {
    return
  }
  emit('close')
}

function onBackdropClick(): void {
  if (props.closeOnBackdrop) {
    requestClose()
  }
}

function bindEscapeListener(): void {
  const onDocumentKeyDown = (event: KeyboardEvent) => {
    if (!props.open || !props.closeOnEscape || props.loading) {
      return
    }
    if (event.key === 'Escape') {
      event.preventDefault()
      requestClose()
    }
  }

  document.addEventListener('keydown', onDocumentKeyDown)
  releaseEscapeListener = () => {
    document.removeEventListener('keydown', onDocumentKeyDown)
    releaseEscapeListener = null
  }
}

function teardownModalListeners(): void {
  releaseFocusTrap?.()
  releaseFocusTrap = null
  releaseEscapeListener?.()
  releaseEscapeListener = null
}

async function setupModalListeners(): Promise<void> {
  teardownModalListeners()
  await nextTick()
  if (!props.open || !panelRef.value) {
    return
  }
  releaseFocusTrap = bindModalFocusTrap(panelRef.value)
  bindEscapeListener()
}

watch(
  () => props.open,
  open => {
    if (open) {
      void setupModalListeners()
      return
    }
    teardownModalListeners()
  },
  { immediate: true }
)

onUnmounted(() => {
  teardownModalListeners()
})
</script>

<template>
  <div v-if="open" class="app-modal-backdrop" @click.self="onBackdropClick">
    <div
      ref="panelRef"
      class="app-modal"
      :class="`app-modal--${size}`"
      role="dialog"
      aria-modal="true"
      :aria-labelledby="titleId"
      :aria-describedby="description ? descriptionId : undefined"
      tabindex="-1"
    >
      <h2 :id="titleId" class="app-modal__title">{{ title }}</h2>
      <p v-if="description" :id="descriptionId" class="app-modal__description">
        {{ description }}
      </p>

      <div class="app-modal__body">
        <slot />
      </div>

      <div v-if="$slots.error" class="app-modal__error" role="alert">
        <slot name="error" />
      </div>

      <div v-if="$slots.actions" class="app-modal__actions">
        <slot name="actions" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.app-modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 40;
  display: grid;
  place-items: center;
  padding: var(--space-lg);
  background: color-mix(in srgb, var(--ink) 42%, transparent);
}

.app-modal {
  display: grid;
  gap: var(--space-sm);
  width: min(100%, 420px);
  max-height: min(90vh, 640px);
  padding: var(--space-md);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: var(--surface-white);
  overflow: auto;
  box-shadow: var(--shadow-ink-md);
  outline: none;
}

.app-modal--md {
  width: min(100%, 520px);
}

.app-modal__title {
  margin: 0;
  font-size: 18px;
  line-height: 1.3;
}

.app-modal__description {
  margin: 0;
  font-size: 13px;
  line-height: 1.5;
  color: var(--on-surface-muted);
}

.app-modal__body {
  display: grid;
  gap: var(--space-sm);
  min-width: 0;
}

.app-modal__error {
  margin: 0;
  font-size: 13px;
  line-height: 1.4;
  color: var(--danger);
}

.app-modal__actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  align-items: center;
  gap: var(--space-xs);
}
</style>
