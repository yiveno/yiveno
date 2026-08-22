<script setup lang="ts">
/**
 * 自研开关：受控 modelValue；失败回滚由父组件保持旧值即可。
 */
defineOptions({ name: 'AppSwitch' })

const props = withDefaults(
  defineProps<{
    modelValue: boolean
    disabled?: boolean
    ariaLabel?: string
  }>(),
  {
    disabled: false
  }
)

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

function onToggle() {
  if (props.disabled) {
    return
  }
  emit('update:modelValue', !props.modelValue)
}
</script>

<template>
  <button
    class="app-switch"
    type="button"
    role="switch"
    :aria-checked="modelValue"
    :aria-label="ariaLabel"
    :disabled="disabled"
    @click="onToggle"
  >
    <span class="app-switch__track" aria-hidden="true">
      <span class="app-switch__thumb" />
    </span>
  </button>
</template>

<style scoped>
.app-switch {
  display: inline-flex;
  flex-shrink: 0;
  padding: 0;
  border: none;
  background: transparent;
  cursor: pointer;
}

.app-switch:disabled {
  cursor: not-allowed;
  opacity: var(--disabled-opacity);
}

.app-switch:focus-visible .app-switch__track {
  outline: 2px solid var(--focus-ring);
  outline-offset: 2px;
}

.app-switch__track {
  position: relative;
  display: block;
  width: 52px;
  height: 32px;
  border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--on-surface) 18%, var(--surface));
  transition: background-color var(--motion-duration-short) var(--motion-easing-standard);
}

.app-switch[aria-checked='true'] .app-switch__track {
  background: var(--accent);
}

.app-switch__thumb {
  position: absolute;
  top: 4px;
  left: 4px;
  width: 24px;
  height: 24px;
  border-radius: var(--radius-full);
  background: var(--surface-raised);
  box-shadow: var(--shadow-ink-sm);
  transition: left var(--motion-duration-short) var(--motion-easing-standard);
}

.app-switch[aria-checked='true'] .app-switch__thumb {
  left: 24px;
}
</style>
