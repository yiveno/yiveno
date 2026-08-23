<script setup lang="ts">
/**
 * 自研多行输入：附注等表单场景；Recall Composer 等个性化输入保持独立样式。
 */
defineOptions({ name: 'AppTextarea' })

withDefaults(
  defineProps<{
    modelValue: string
    disabled?: boolean
    rows?: number
    maxlength?: number
    placeholder?: string
    id?: string
    ariaLabel?: string
    /** vertical=可纵向拖拽（默认）；none=固定高度 */
    resize?: 'vertical' | 'none'
  }>(),
  {
    disabled: false,
    rows: 4,
    resize: 'vertical'
  }
)

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

function onInput(event: Event) {
  const target = event.target
  if (!(target instanceof HTMLTextAreaElement)) {
    return
  }
  emit('update:modelValue', target.value)
}
</script>

<template>
  <textarea
    class="app-textarea"
    :class="{ 'app-textarea--resize-none': resize === 'none' }"
    :id="id"
    :value="modelValue"
    :rows="rows"
    :maxlength="maxlength"
    :placeholder="placeholder"
    :disabled="disabled"
    :aria-label="ariaLabel"
    @input="onInput"
  />
</template>

<style scoped>
.app-textarea {
  box-sizing: border-box;
  display: block;
  width: 100%;
  margin: 0;
  padding: var(--space-sm);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  resize: vertical;
  font: inherit;
  font-size: 14px;
  line-height: 1.45;
  color: var(--on-surface);
  background: var(--surface-white);
}

.app-textarea--resize-none {
  resize: none;
}

.app-textarea::placeholder {
  color: var(--on-surface-muted);
}

.app-textarea:focus {
  outline: 2px solid var(--focus-ring);
  outline-offset: 1px;
}

.app-textarea:disabled {
  cursor: not-allowed;
  opacity: var(--disabled-opacity);
}
</style>
