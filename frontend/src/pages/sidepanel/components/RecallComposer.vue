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
}>()

const emit = defineEmits<{
  send: []
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
  margin-top: 8px;
  padding-top: 4px;
}

.recall-form--prominent {
  margin-top: 0;
  padding-top: 0;
}

.recall-composer-shell {
  display: flex;
  align-items: center;
  gap: 8px;
  box-sizing: border-box;
  width: 100%;
  min-width: 0;
  /* 固定下限：约两行线索 + 内边距，空/有字/是否 prominent 一致 */
  min-height: 76px;
  padding: 10px 10px 10px 16px;
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
  padding: 4px 0;
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
  justify-content: center;
  align-items: center;
  flex-shrink: 0;
  width: 36px;
  height: 36px;
  margin: 0;
  padding: 0;
  border: 0;
  border-radius: 999px;
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
