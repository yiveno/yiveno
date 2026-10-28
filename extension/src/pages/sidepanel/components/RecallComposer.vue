<script setup lang="ts">
import { nextTick, onMounted, ref, watch } from 'vue'

import AppIcon from '@/infrastructure/ui/icons/AppIcon.vue'

defineOptions({ name: 'RecallComposer' })

const props = defineProps<{
  ariaLabel: string
  placeholder: string
  sendLabel: string
  disabled?: boolean
  /** 空线程时加重阴影（高度与有字态一致，避免跳变） */
  prominent?: boolean
  /** 本场找回会话标题（字面展示，无 Narrowing 前缀） */
  threadTitle?: string | null
  /** 标题前缀文案（可见 "This find"） */
  threadTitleLabel?: string | null
  /** 标题 a11y（This find: …） */
  threadTitleAria?: string | null
  /** 可见「New find」文案 */
  threadNewFindLabel?: string
}>()

const emit = defineEmits<{
  send: []
  clearThread: []
}>()
const model = defineModel<string>({ required: true })
const inputRef = ref<HTMLTextAreaElement | null>(null)

/** 与 CSS `.recall-input` 单行行高对齐；多行由 scrollHeight 撑开，空态固定单行。 */
const INPUT_MIN_HEIGHT_PX = 22
const INPUT_MAX_HEIGHT_PX = 160

/**
 * 随内容长高（仅 JS，不用 field-sizing）。
 * Edge Side Panel 窄栏下 field-sizing:content 会按长 placeholder 撑高，
 * 首字输入后回落并触发 focus scroll，整页下移、底栏贴边裁切；Chrome 宽栏不易复现。
 * 空态固定单行；有字再按 scrollHeight 长高。长高后钉死文档滚动，防止 Edge 滚视口。
 */
function pinDocumentScroll(): void {
  if (typeof window === 'undefined') {
    return
  }
  if (window.scrollY !== 0 || document.documentElement.scrollTop !== 0) {
    window.scrollTo(0, 0)
  }
  if (document.body.scrollTop !== 0) {
    document.body.scrollTop = 0
  }
}

function resizeInput(): void {
  const el = inputRef.value
  if (!el) {
    return
  }
  if (el.value.length === 0) {
    el.style.height = `${INPUT_MIN_HEIGHT_PX}px`
    pinDocumentScroll()
    return
  }
  el.style.height = 'auto'
  const next = Math.min(Math.max(el.scrollHeight, INPUT_MIN_HEIGHT_PX), INPUT_MAX_HEIGHT_PX)
  el.style.height = `${next}px`
  pinDocumentScroll()
}

function handleKeydown(event: KeyboardEvent): void {
  // Enter 发送；Shift+Enter 换行
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    emit('send')
  }
}

function handleInput(): void {
  resizeInput()
}

function focus(): void {
  inputRef.value?.focus({ preventScroll: true })
  pinDocumentScroll()
}

watch(model, async () => {
  await nextTick()
  resizeInput()
})

watch(
  () => props.prominent,
  async () => {
    await nextTick()
    resizeInput()
  }
)

onMounted(() => {
  resizeInput()
})

defineExpose({ focus })
</script>

<template>
  <div class="recall-form" :class="{ 'recall-form--prominent': prominent }">
    <div v-if="props.threadTitle" class="recall-thread-bar">
      <p
        class="recall-thread-heading"
        role="status"
        :aria-label="props.threadTitleAria || undefined"
      >
        <span v-if="props.threadTitleLabel" class="recall-thread-heading__label">
          {{ props.threadTitleLabel }}
        </span>
        <span class="recall-thread-heading__title">{{ props.threadTitle }}</span>
      </p>
      <button
        type="button"
        class="recall-thread-new-find"
        :disabled="props.disabled"
        @click="emit('clearThread')"
      >
        <AppIcon name="message_circle_plus" size="14px" />
        <span>{{ props.threadNewFindLabel }}</span>
      </button>
    </div>
    <slot />
    <div class="recall-composer-shell">
      <textarea
        ref="inputRef"
        v-model="model"
        class="recall-input"
        rows="1"
        :aria-label="props.ariaLabel"
        :placeholder="props.placeholder"
        :disabled="props.disabled"
        @keydown="handleKeydown"
        @input="handleInput"
        @focus="pinDocumentScroll"
      />
      <button
        type="button"
        class="recall-send-button"
        :aria-label="props.sendLabel"
        :disabled="props.disabled || !model.trim()"
        @click="emit('send')"
      >
        <AppIcon name="arrow_upward" size="18px" />
      </button>
    </div>
  </div>
</template>

<style scoped>
.recall-form {
  flex-shrink: 0;
  margin-top: var(--space-xs);
  padding-top: var(--space-2xs);
}

.recall-form--prominent {
  margin-top: 0;
  padding-top: 0;
}

.recall-thread-bar {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  box-sizing: border-box;
  width: 100%;
  min-width: 0;
  margin: 0 0 var(--space-2xs) var(--space-2xs);
}

.recall-thread-heading {
  display: flex;
  flex: 1 1 auto;
  align-items: baseline;
  gap: var(--space-2xs);
  min-width: 0;
  margin: 0;
  padding: 2px 0;
  line-height: 1.35;
}

.recall-thread-heading__label {
  flex-shrink: 0;
  font-size: 12px;
  font-weight: 500;
  color: var(--on-surface-muted);
}

.recall-thread-heading__title {
  /* 吃满标题区剩余宽度；窄栏 CSS 省略，宽栏自动多露字 */
  flex: 1 1 auto;
  min-width: 0;
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
  color: var(--on-surface);
  overflow: hidden;
  text-overflow: ellipsis;
}

.recall-thread-new-find {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  gap: var(--space-2xs);
  margin: 0;
  padding: var(--space-2xs) var(--space-sm);
  border: 1px solid var(--border);
  border-radius: var(--radius-full);
  font-size: 12px;
  font-weight: 500;
  line-height: 1.3;
  white-space: nowrap;
  color: var(--on-surface);
  background: var(--surface-white);
  cursor: pointer;
  transition:
    background-color 140ms ease-out,
    border-color 140ms ease-out,
    color 140ms ease-out;
  font: inherit;
}

.recall-thread-new-find:hover:not(:disabled) {
  border-color: color-mix(in srgb, var(--accent) 35%, var(--border));
  background: color-mix(in srgb, var(--accent) 8%, var(--surface-white));
}

.recall-thread-new-find:disabled {
  opacity: 0.5;
  cursor: default;
}

.recall-thread-new-find:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 1px;
}

.recall-composer-shell {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  box-sizing: border-box;
  width: 100%;
  min-width: 0;

  /* 单行高：按钮 36px + 上下 padding；文案与发送钮垂直居中 */
  min-height: 52px;
  max-height: calc(160px + 2 * var(--space-xs));
  padding: var(--space-xs) var(--space-xs) var(--space-xs) var(--space-md);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: var(--surface-white);
  box-shadow:
    0 1px 2px color-mix(in srgb, var(--ink) 8%, transparent),
    0 8px 24px color-mix(in srgb, var(--ink) 6%, transparent);
  overflow: hidden;
}

.recall-form--prominent .recall-composer-shell {
  box-shadow:
    0 1px 2px color-mix(in srgb, var(--ink) 10%, transparent),
    0 12px 32px color-mix(in srgb, var(--ink) 8%, transparent);
}

.recall-composer-shell:focus-within {
  border-color: color-mix(in srgb, var(--accent) 40%, var(--border));
  box-shadow:
    0 1px 2px color-mix(in srgb, var(--ink) 8%, transparent),
    0 8px 24px color-mix(in srgb, var(--ink) 6%, transparent),
    0 0 0 3px color-mix(in srgb, var(--accent) 12%, transparent);
}

.recall-input {
  flex: 1 1 auto;
  align-self: center;
  box-sizing: border-box;
  width: 100%;
  min-width: 0;
  height: 22px;
  min-height: 22px;
  max-height: 160px;

  /* 不用 field-sizing：见 resizeInput 注释（Edge 首字回落 + 整页下移） */
  field-sizing: fixed;
  margin: 0;
  padding: 0;
  border: 0;
  outline: none;
  font-family: inherit;
  font-size: 15px;
  line-height: 1.45;
  color: inherit;
  background: transparent;
  resize: none;
  overflow-x: hidden;
  overflow-y: auto;
  overflow-anchor: none;
}

.recall-input:focus {
  outline: none;
}

.recall-input::placeholder {
  color: var(--on-surface-muted);
}

.recall-send-button {
  display: inline-flex;
  flex-shrink: 0;
  justify-content: center;
  align-items: center;
  width: 36px;
  height: 36px;
  margin: 0;
  padding: 0;
  border: 0;
  border-radius: var(--radius-full);
  color: var(--on-accent);
  background: var(--accent);
  cursor: pointer;
  transition:
    background-color 140ms ease-out,
    opacity 140ms ease-out;
}

.recall-send-button:disabled {
  color: var(--on-surface-muted);
  background: var(--surface-chrome);
  cursor: default;
}

.recall-send-button:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.recall-send-button:hover:not(:disabled) {
  background: color-mix(in srgb, var(--accent) 88%, var(--ink) 12%);
}
</style>
