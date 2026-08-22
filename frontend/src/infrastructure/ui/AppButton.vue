<script setup lang="ts">
/**
 * 自研按钮：filled / tonal / outlined / text；可选 href 渲染为链接。
 * 样式仅消费 Brand Roles；交互态无几何变换。
 */
defineOptions({ name: 'AppButton' })

withDefaults(
  defineProps<{
    /** filled=主强调；tonal=次强调；outlined=描边；text=文字按钮 */
    variant?: 'filled' | 'tonal' | 'outlined' | 'text'
    type?: 'button' | 'submit' | 'reset'
    disabled?: boolean
    href?: string
    title?: string
    /** 仅 href 模式 */
    target?: string
    rel?: string
  }>(),
  {
    variant: 'filled',
    type: 'button',
    disabled: false
  }
)
</script>

<template>
  <a
    v-if="href && !disabled"
    class="app-button"
    :class="`app-button--${variant}`"
    :href="href"
    :title="title"
    :target="target"
    :rel="rel"
  >
    <slot />
  </a>
  <button
    v-else
    class="app-button"
    :class="`app-button--${variant}`"
    :type="type"
    :disabled="disabled"
    :title="title"
  >
    <slot />
  </button>
</template>

<style scoped>
.app-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2xs);
  min-height: 40px;
  padding: 0 var(--space-md);
  border: 1px solid transparent;
  border-radius: var(--radius-full);
  font: inherit;
  font-size: 0.875rem;
  font-weight: 500;
  line-height: 1.25;
  text-decoration: none;
  cursor: pointer;
  transition:
    background-color var(--motion-duration-fast) var(--motion-easing-standard),
    color var(--motion-duration-fast) var(--motion-easing-standard),
    border-color var(--motion-duration-fast) var(--motion-easing-standard),
    opacity var(--motion-duration-fast) var(--motion-easing-standard);
}

.app-button:disabled {
  cursor: not-allowed;
  opacity: var(--disabled-opacity);
}

.app-button:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 2px;
}

.app-button--filled {
  background: var(--accent);
  color: var(--on-accent);
}

.app-button--filled:hover:not(:disabled) {
  background: color-mix(in srgb, var(--accent) 88%, var(--ink));
}

.app-button--filled:active:not(:disabled) {
  background: color-mix(in srgb, var(--accent) 78%, var(--ink));
}

.app-button--tonal {
  background: color-mix(in srgb, var(--accent) 16%, var(--surface-raised));
  color: var(--accent);
}

.app-button--tonal:hover:not(:disabled) {
  background: color-mix(in srgb, var(--accent) 24%, var(--surface-raised));
}

.app-button--tonal:active:not(:disabled) {
  background: color-mix(in srgb, var(--accent) 32%, var(--surface-raised));
}

.app-button--outlined {
  border-color: var(--border-strong);
  background: transparent;
  color: var(--accent);
}

.app-button--outlined:hover:not(:disabled) {
  background: color-mix(
    in srgb,
    var(--accent) calc(var(--state-hover-opacity) * 100%),
    transparent
  );
}

.app-button--outlined:active:not(:disabled) {
  background: color-mix(
    in srgb,
    var(--accent) calc(var(--state-pressed-opacity) * 100%),
    transparent
  );
}

.app-button--text {
  min-height: 36px;
  padding: 0 var(--space-sm);
  background: transparent;
  color: var(--accent);
}

.app-button--text:hover:not(:disabled) {
  background: color-mix(
    in srgb,
    var(--accent) calc(var(--state-hover-opacity) * 100%),
    transparent
  );
}

.app-button--text:active:not(:disabled) {
  background: color-mix(
    in srgb,
    var(--accent) calc(var(--state-pressed-opacity) * 100%),
    transparent
  );
}
</style>
