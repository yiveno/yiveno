<script setup lang="ts">
/**
 * 自研图标按钮；省略可见文字时由父组件传入 title + aria-label。
 */
defineOptions({ name: 'AppIconButton' })

withDefaults(
  defineProps<{
    type?: 'button' | 'submit' | 'reset'
    disabled?: boolean
    title?: string
    ariaLabel?: string
    /** danger=危险操作着色 */
    tone?: 'default' | 'danger'
  }>(),
  {
    type: 'button',
    disabled: false,
    tone: 'default'
  }
)
</script>

<template>
  <button
    class="app-icon-button"
    :class="{ 'app-icon-button--danger': tone === 'danger' }"
    :type="type"
    :disabled="disabled"
    :title="title"
    :aria-label="ariaLabel ?? title"
  >
    <slot />
  </button>
</template>

<style scoped>
.app-icon-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  padding: 0;
  border: none;
  border-radius: var(--radius-full);
  background: transparent;
  color: var(--on-surface-muted);
  cursor: pointer;
  transition:
    background-color var(--motion-duration-fast) var(--motion-easing-standard),
    color var(--motion-duration-fast) var(--motion-easing-standard),
    opacity var(--motion-duration-fast) var(--motion-easing-standard);
}

.app-icon-button:hover:not(:disabled) {
  background: color-mix(
    in srgb,
    var(--on-surface) calc(var(--state-hover-opacity) * 100%),
    transparent
  );
  color: var(--on-surface);
}

.app-icon-button:active:not(:disabled) {
  background: color-mix(
    in srgb,
    var(--on-surface) calc(var(--state-pressed-opacity) * 100%),
    transparent
  );
}

.app-icon-button:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 2px;
}

.app-icon-button:disabled {
  cursor: not-allowed;
  opacity: var(--disabled-opacity);
}

.app-icon-button--danger {
  color: var(--danger);
}

.app-icon-button--danger:hover:not(:disabled),
.app-icon-button--danger:active:not(:disabled) {
  color: var(--danger);
  background: color-mix(
    in srgb,
    var(--danger) calc(var(--state-hover-opacity) * 100%),
    transparent
  );
}

.app-icon-button--danger:focus-visible {
  outline-color: var(--danger-ring);
}
</style>
