<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue'
import { LucideIcon, Button } from '@/components'
import { tabBrowserAppService } from '@/application/browser/tab-browser-app-service'
import { useCommandsShortcuts } from '@/composables/useCommandsShortcuts'
import { useUIStore } from '@/stores/ui-store'
import { t } from '@/utils/i18n-helpers'

defineOptions({
  name: 'ShortcutSettings'
})

const uiStore = useUIStore()

/**
 * 全局命令快捷键工具集
 */
const { shortcuts, loadShortcuts, startAutoRefresh, stopAutoRefresh } = useCommandsShortcuts()

/**
 * 快捷键标签映射
 */
const labelMap: Record<string, string> = {
  _execute_action: t('settings_shortcut_label_execute_action'),
  'open-management': t('settings_shortcut_label_open_management'),
  'open-settings': t('settings_shortcut_label_open_settings'),
  'quick-add-bookmark': t('settings_shortcut_label_quick_add_bookmark')
}

/**
 * 格式化快捷键列表
 */
const shortcutItems = computed(() => {
  const items: Array<{ command: string; label: string; keys: string }> = []

  Object.keys(labelMap).forEach(cmd => {
    const keys = shortcuts.value[cmd]
    items.push({
      command: cmd,
      label: labelMap[cmd] ?? cmd,
      keys: keys && keys.trim() ? keys : ''
    })
  })

  return items
})

/**
 * 打开 Chrome 快捷键设置页面
 */
async function openChromeShortcutSettings(): Promise<void> {
  const result = await tabBrowserAppService.openSystemUrl('chrome://extensions/shortcuts')
  if (!result.ok) {
    uiStore.showInfo(t('settings_shortcut_chrome_url_hint'))
  }
}

onMounted(() => {
  loadShortcuts()
  startAutoRefresh()
})

onUnmounted(() => {
  stopAutoRefresh()
})
</script>

<template>
  <div class="shortcuts-container">
    <!-- 快捷键列表 - Material Web List -->
    <md-list v-if="shortcutItems.length > 0" class="shortcuts-list">
      <md-list-item v-for="item in shortcutItems" :key="item.command">
        <div slot="headline">{{ item.label }}</div>
        <div slot="trailing-supporting-text" class="shortcut-keys">
          <kbd v-if="item.keys" class="shortcut-kbd">{{ item.keys }}</kbd>
          <span v-else class="shortcut-empty">{{ t('settings_shortcut_not_set') }}</span>
        </div>
      </md-list-item>
    </md-list>

    <!-- 未配置提示 -->
    <div v-else class="shortcuts-empty">
      <LucideIcon name="info" :size="24" />
      <p>{{ t('settings_shortcut_empty') }}</p>
    </div>

    <!-- 操作按钮 -->
    <div class="shortcuts-actions">
      <Button variant="filled" @click="openChromeShortcutSettings">
        {{ t('settings_shortcut_open_chrome') }}
      </Button>
    </div>
  </div>
</template>

<style scoped>
.shortcuts-container {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-5);
}

/* Material Web List 样式 */
.shortcuts-list {
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  overflow: hidden;
}

.shortcut-keys {
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
}

.shortcut-kbd {
  display: inline-flex;
  align-items: center;
  padding: var(--spacing-1) var(--spacing-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  color: var(--color-text-primary);
  background: var(--color-background);
  box-shadow: 0 1px 2px var(--color-shadow-005);
}

.shortcut-empty {
  font-size: var(--text-xs);
  color: var(--color-text-tertiary);
}

.shortcuts-empty {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: var(--spacing-2);
  padding: var(--spacing-6);
  border: 1px dashed var(--color-border);
  border-radius: var(--radius-md);
  color: var(--color-text-tertiary);
}

.shortcuts-empty p {
  margin: 0;
  font-size: var(--text-sm);
}

.shortcuts-actions {
  display: flex;
  justify-content: flex-start;
  padding-top: var(--spacing-2);
}

/* Material Web 组件覆盖（与全局不一致的特化值） */
md-list {
  --md-list-container-color: transparent;
}

md-list-item {
  --md-list-item-trailing-supporting-text-color: var(--md-sys-color-on-surface-variant);
  --md-list-item-label-text-size: var(--md-sys-typescale-body-large-size);
  --md-list-item-supporting-text-size: var(--md-sys-typescale-body-medium-size);
  --md-list-item-one-line-container-height: 56px;
}
</style>
