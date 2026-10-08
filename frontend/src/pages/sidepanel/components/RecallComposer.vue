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

/** 与 CSS `.recall-input` min/max-height 对齐；空/有字同一下限。 */
const INPUT_MIN_HEIGHT_PX = 52
const INPUT_MAX_HEIGHT_PX = 160

/**
 * 随内容长高。空值清掉 inline height，交给 CSS min-height，
 * 避免 placeholder 换行虚高 scrollHeight → 输入后回落。
 */
function resizeInput(): void {
  const el = inputRef.value
  if (!el) {
    return
  }
  if (el.value.length === 0) {
    el.style.height = ''
    return
  }
  el.style.height = 'auto'
  const next = Math.min(Math.max(el.scrollHeight, INPUT_MIN_HEIGHT_PX), INPUT_MAX_HEIGHT_PX)
  el.style.height = `${next}px`
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
  inputRef.value?.focus()
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
    <div class="recall-composer-shell">
      <textarea
        ref="inputRef"
        v-model="model"
        class="recall-input"
        rows="2"
        :aria-label="props.ariaLabel"
        :placeholder="props.placeholder"
        :disabled="props.disabled"
        @keydown="handleKeydown"
        @input="handleInput"
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
  margin: 0 0 var(--space-xs) var(--space-2xs);
}

.recall-thread-heading {
  display: flex;
  flex: 1 1 auto;
  align-items: baseline;
  gap: 6px;
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
  gap: 4px;
  margin: 0;
  padding: 5px var(--space-sm);
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

  /* 固定下限：约两行线索 + 内边距，空/有字/是否 prominent 一致 */
  min-height: 76px;
  padding: var(--space-sm) var(--space-sm) var(--space-sm) var(--space-md);
  border: 1px solid var(--border);
  border-radius: 28px;
  background: var(--surface-white);
  box-shadow:
    0 1px 2px color-mix(in srgb, var(--ink) 8%, transparent),
    0 8px 24px color-mix(in srgb, var(--ink) 6%, transparent);
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
  box-sizing: border-box;
  width: auto;
  min-height: 52px;
  max-height: 160px;
  padding: var(--space-2xs) 0;
  border: 0;
  outline: none;
  font-family: inherit;
  font-size: 15px;
  line-height: 1.45;
  color: inherit;
  background: transparent;
  resize: none;
  overflow-y: auto;
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
