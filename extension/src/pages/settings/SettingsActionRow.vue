<script setup lang="ts">
/**
 * 设置页行式操作：标题 + 一行说明左对齐，操作按钮右对齐。
 */
defineOptions({ name: 'SettingsActionRow' })

withDefaults(
  defineProps<{
    /** 行标题 */
    title: string
    /** 一行 muted 说明；详情见 Confirm Modal */
    subtitle?: string
    /** danger=不可逆/删除类操作行 */
    tone?: 'default' | 'danger'
    /**
     * embedded=嵌在分组卡内（去独立描边/圆角，由分组卡统一包边）。
     * card=默认独立行卡。
     */
    surface?: 'card' | 'embedded'
  }>(),
  {
    tone: 'default',
    surface: 'card'
  }
)
</script>

<template>
  <div
    class="settings-action-row"
    :class="{
      'settings-action-row--danger': tone === 'danger',
      'settings-action-row--embedded': surface === 'embedded'
    }"
  >
    <div class="settings-action-row__copy">
      <p class="settings-action-row__title">{{ title }}</p>
      <p v-if="subtitle" class="settings-action-row__subtitle">{{ subtitle }}</p>
    </div>
    <div class="settings-action-row__action">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.settings-action-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-md);
  padding: var(--space-sm) var(--space-md);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: var(--surface-raised);
}

.settings-action-row--danger {
  border-color: color-mix(in srgb, var(--danger) 28%, var(--border));
}

.settings-action-row--embedded {
  border: none;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
}

.settings-action-row--embedded + .settings-action-row--embedded {
  border-top: 1px solid var(--border);
}

.settings-action-row--embedded.settings-action-row--danger {
  border-color: transparent;
}

.settings-action-row--embedded.settings-action-row--danger + .settings-action-row--embedded {
  border-top-color: color-mix(in srgb, var(--danger) 22%, var(--border));
}

.settings-action-row__copy {
  flex: 1;
  min-width: 0;
}

.settings-action-row__title {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  line-height: 1.35;
}

.settings-action-row--danger .settings-action-row__title {
  color: var(--danger);
}

.settings-action-row__subtitle {
  margin: var(--space-2xs) 0 0;
  font-size: 12px;
  line-height: 1.4;
  color: var(--on-surface-muted);
}

.settings-action-row__action {
  flex-shrink: 0;
}

@media (width <= 640px) {
  .settings-action-row {
    flex-direction: column;
    align-items: stretch;
  }

  .settings-action-row__action {
    display: flex;
    justify-content: flex-end;
  }
}
</style>
