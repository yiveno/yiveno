<template>
  <div class="settings-section">
    <h3 class="section-subtitle">
      <LucideIcon name="bell" />
      <span>{{ t('settings_notification_title') }}</span>
    </h3>
    <div class="grid">
      <div class="row">
        <div class="label label--with-tooltip">
          {{ t('settings_notification_mirror') }}
          <Tooltip offset="md">
            <LucideIcon name="info" class="label-info-icon" />
            <template #content>
              <div class="tooltip-content">
                <strong>{{ t('settings_notification_mirror_tooltip_title') }}</strong>
                <ul>
                  <li>{{ t('settings_notification_mirror_tooltip_1') }}</li>
                  <li>{{ t('settings_notification_mirror_tooltip_2') }}</li>
                  <li>{{ t('settings_notification_mirror_tooltip_3') }}</li>
                </ul>
              </div>
            </template>
          </Tooltip>
        </div>
        <div class="field">
          <md-switch
            :selected="mirror"
            @change="handleMirrorToggle"
          ></md-switch>
        </div>
      </div>
    </div>
  </div>
</template>
<script setup lang="ts">
import { defineOptions, onMounted, ref } from 'vue'

defineOptions({
  name: 'NotificationSettings'
})
import { LucideIcon, Tooltip } from '@/components'
import { settingsAppService } from '@/application/settings/settings-app-service'
import { notifySuccess } from '@/application'
import { t } from '@/utils/i18n-helpers'

const mirror = ref<boolean>(true)

onMounted(async () => {
  const v = await settingsAppService.getSetting<boolean>(
    'notifications.mirrorSystemWhenHidden'
  )
  if (v !== null && typeof v !== 'undefined')
    mirror.value = Boolean((v as unknown as { value?: boolean }).value ?? v)
})

// 即时保存：开关变化时立即落盘
async function handleMirrorToggle(event: Event) {
  const target = event.target as HTMLElement & { selected: boolean }
  mirror.value = target.selected
  try {
    await settingsAppService.saveSetting(
      'notifications.mirrorSystemWhenHidden',
      Boolean(mirror.value),
      'boolean',
      '页面隐藏时镜像系统通知'
    )
    notifySuccess(mirror.value ? '系统通知镜像：开启' : '系统通知镜像：关闭', '通知')
  } catch {
    /* 保留手动保存按钮 */
  }
}
</script>
<style scoped>
.settings-section {
  margin-bottom: var(--spacing-6);
}

.section-subtitle {
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
  margin: 0 0 var(--spacing-4) 0;
  padding-bottom: var(--spacing-2);
  border-bottom: 1px solid var(--color-border-subtle);
  font-size: var(--text-base);
  font-weight: var(--font-semibold);
  color: var(--color-text-secondary);
}

.grid {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-2);
}

.label {
  width: 160px;
  color: var(--color-text-secondary);
}

.row {
  display: flex;
  align-items: center;
  gap: var(--spacing-3);
}

.label--with-tooltip {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-1);
  cursor: default;
}

.label-info-icon {
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
}

.label-info-icon:hover {
  color: var(--color-primary);
}

/* Material Web Components Switch 样式覆盖 */
md-switch {
  --md-switch-selected-track-color: var(--color-primary);
  --md-switch-selected-handle-color: var(--md-sys-color-on-primary);
  --md-switch-selected-hover-track-color: var(--color-primary-hover);
  --md-switch-selected-pressed-track-color: var(--color-primary-active);

  flex-shrink: 0;
}

.tooltip-content {
  font-size: 0.85rem;
  line-height: 1.4;
}

.tooltip-content ul {
  margin: var(--spacing-2) 0;
  padding-left: var(--spacing-5);
}

.tooltip-content li {
  margin-bottom: var(--spacing-1);
}
</style>
