<script setup lang="ts">
import { ref } from 'vue'

import MaterialSymbolIcon from '@/infrastructure/ui/icons/MaterialSymbolIcon.vue'

defineOptions({ name: 'RecallComposer' })

const props = defineProps<{
  ariaLabel: string
  placeholder: string
  disabled?: boolean
}>()

const emit = defineEmits<{
  send: []
}>()
const model = defineModel<string>({ required: true })
const inputRef = ref<HTMLTextAreaElement | null>(null)

function handleKeydown(event: KeyboardEvent): void {
  // Enter 发送；Shift+Enter 换行
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    emit('send')
  }
}

function focus(): void {
  inputRef.value?.focus()
}

defineExpose({ focus })
</script>

<template>
  <div class="recall-form">
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
      />
      <button
        type="button"
        class="recall-send-button"
        :aria-label="props.ariaLabel"
        :disabled="props.disabled || !model.trim()"
        @click="emit('send')"
      >
        <MaterialSymbolIcon name="arrow_upward" size="18px" />
      </button>
    </div>
  </div>
</template>

<style scoped>
.recall-form {
  flex-shrink: 0;
  margin-top: 10px;
}

.recall-composer-shell {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  width: 100%;
  min-width: 0;
  padding: 9px 10px 9px 14px;
  border: 1px solid var(--border);
  border-radius: 24px;
  background: var(--surface-white);
  box-shadow:
    0 1px 2px color-mix(in srgb, var(--ink) 10%, transparent),
    0 0 0 1px color-mix(in srgb, var(--border) 20%, transparent);
}

.recall-composer-shell:focus-within {
  border-color: color-mix(in srgb, var(--accent) 40%, var(--border));
  box-shadow:
    0 1px 2px color-mix(in srgb, var(--ink) 10%, transparent),
    0 0 0 3px color-mix(in srgb, var(--accent) 12%, transparent);
}

.recall-input {
  flex: 1 1 auto;
  box-sizing: border-box;
  width: auto;
  min-height: 44px;
  max-height: 120px;
  padding: 5px 0;
  border: 0;
  outline: none;
  font-family: inherit;
  font-size: 15px;
  line-height: 1.45;
  color: inherit;
  background: transparent;
  resize: none;
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
  width: 38px;
  height: 38px;
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
