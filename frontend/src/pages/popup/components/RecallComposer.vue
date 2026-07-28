<script setup lang="ts">
import { ref } from 'vue'

import MaterialSymbolIcon from '@/infrastructure/ui/icons/MaterialSymbolIcon.vue'

defineOptions({ name: 'RecallComposer' })

const model = defineModel<string>({ required: true })
const inputRef = ref<HTMLTextAreaElement | null>(null)

const props = defineProps<{
  ariaLabel: string
  placeholder: string
  disabled?: boolean
}>()

const emit = defineEmits<{
  send: []
}>()

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
  border: 1px solid var(--md-sys-color-outline-variant);
  border-radius: 24px;
  background: var(--md-sys-color-surface-container-lowest);
  box-shadow:
    0 1px 2px color-mix(in srgb, var(--md-sys-color-shadow, black) 10%, transparent),
    0 0 0 1px color-mix(in srgb, var(--md-sys-color-outline-variant) 20%, transparent);
}

.recall-composer-shell:focus-within {
  border-color: color-mix(
    in srgb,
    var(--md-sys-color-primary) 40%,
    var(--md-sys-color-outline-variant)
  );
  box-shadow:
    0 1px 2px color-mix(in srgb, var(--md-sys-color-shadow, black) 10%, transparent),
    0 0 0 3px color-mix(in srgb, var(--md-sys-color-primary) 12%, transparent);
}

.recall-input {
  flex: 1 1 auto;
  width: auto;
  box-sizing: border-box;
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
  color: var(--md-sys-color-on-surface-variant);
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
  color: var(--md-sys-color-on-primary);
  background: var(--md-sys-color-primary);
  cursor: pointer;
  transition:
    background-color 140ms ease-out,
    opacity 140ms ease-out;
}

.recall-send-button:hover:not(:disabled) {
  background: color-mix(in srgb, var(--md-sys-color-primary) 88%, black 12%);
}

.recall-send-button:disabled {
  color: var(--md-sys-color-on-surface-variant);
  background: var(--md-sys-color-surface-container-high);
  cursor: default;
}

.recall-send-button:focus-visible {
  outline: 2px solid var(--md-sys-color-primary);
  outline-offset: 2px;
}
</style>
