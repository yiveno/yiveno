<script setup lang="ts">
import { onMounted, ref, watch, nextTick } from 'vue'

defineOptions({
  name: 'NotificationSettings'
})
import { LucideIcon, Tooltip } from '@/components'
import { settingsAppService } from '@/application/settings/settings-app-service'
import { notificationService } from '@/application/notification/notification-service'
import { message } from '@/application/message/message-service'
import { t } from '@/utils/i18n-helpers'

const mirror = ref<boolean>(true)
const doNotDisturb = ref<boolean>(false)
const notificationDuration = ref<number>(4) // 默认 4 秒
const sliderRef = ref<HTMLElement | null>(null)

onMounted(async () => {
  // 加载后台通知提醒设置
  const mirrorValue = await settingsAppService.getSetting<boolean>(
    'notifications.mirrorSystemWhenHidden'
  )
  if (mirrorValue !== null && typeof mirrorValue !== 'undefined')
    mirror.value = Boolean((mirrorValue as unknown as { value?: boolean }).value ?? mirrorValue)

  // 加载勿扰模式设置
  const dndValue = await settingsAppService.getSetting<boolean>('notifications.doNotDisturb')
  if (dndValue !== null && typeof dndValue !== 'undefined') {
    doNotDisturb.value = Boolean((dndValue as unknown as { value?: boolean }).value ?? dndValue)
    // 同步到通知服务
    notificationService.setDoNotDisturb(doNotDisturb.value)
  }

  // 加载通知显示时长设置
  const durationValue = await settingsAppService.getSetting<number>('notifications.duration')
  if (durationValue !== null && typeof durationValue !== 'undefined') {
    // 从毫秒转换为秒
    const milliseconds = Number(
      (durationValue as unknown as { value?: number }).value ?? durationValue
    )
    notificationDuration.value = Math.round(milliseconds / 1000)

    // 等待 DOM 更新后设置滑块值
    await nextTick()
    updateSliderValue()
  }
})

// 监听 notificationDuration 变化，更新滑块
watch(notificationDuration, () => {
  nextTick(() => {
    updateSliderValue()
  })
})

// 更新滑块的值
function updateSliderValue() {
  if (sliderRef.value) {
    ;(sliderRef.value as HTMLElement & { value: number }).value = notificationDuration.value
  }
}

// 勿扰模式开关
async function handleDoNotDisturbToggle(event: Event) {
  const target = event.target as HTMLElement & { selected: boolean }
  doNotDisturb.value = target.selected

  try {
    // 保存到设置
    await settingsAppService.saveSetting(
      'notifications.doNotDisturb',
      Boolean(doNotDisturb.value),
      'boolean',
      '勿扰模式'
    )

    // 同步到通知服务
    notificationService.setDoNotDisturb(doNotDisturb.value)

    message.success(doNotDisturb.value ? '勿扰模式：已开启' : '勿扰模式：已关闭')
  } catch {
    /* 保留手动保存按钮 */
  }
}

// 后台通知提醒开关
async function handleMirrorToggle(event: Event) {
  const target = event.target as HTMLElement & { selected: boolean }
  mirror.value = target.selected
  try {
    await settingsAppService.saveSetting(
      'notifications.mirrorSystemWhenHidden',
      Boolean(mirror.value),
      'boolean',
      '后台通知提醒'
    )
    message.success(mirror.value ? '后台通知提醒：已开启' : '后台通知提醒：已关闭')
  } catch {
    /* 保留手动保存按钮 */
  }
}

// 通知显示时长滑块输入（实时更新显示值）
function handleDurationInput(event: Event) {
  const target = event.target as HTMLElement & { value: number }
  notificationDuration.value = target.value
  console.log('Slider input:', target.value) // 调试日志
}

// 通知显示时长滑块改变（保存设置）
async function handleDurationChange(event: Event) {
  const target = event.target as HTMLElement & { value: number }
  notificationDuration.value = target.value
  console.log('Slider change:', target.value) // 调试日志

  try {
    // 保存到设置（转换为毫秒）
    await settingsAppService.saveSetting(
      'notifications.duration',
      notificationDuration.value * 1000,
      'number',
      '通知显示时长'
    )

    message.success(`通知显示时长：${notificationDuration.value} 秒`)
  } catch {
    /* 保留手动保存按钮 */
  }
}
</script>
<template>
  <div class="grid">
    <!-- 勿扰模式 -->
    <div class="row">
      <div class="label label--with-tooltip">
        {{ t('settings_notification_do_not_disturb') }}
        <Tooltip offset="md">
          <LucideIcon name="info" class="label-info-icon" />
          <template #content>
            <div class="tooltip-content">
              <strong>{{ t('settings_notification_do_not_disturb_tooltip_title') }}</strong>
              <ul>
                <li>
                  {{ t('settings_notification_do_not_disturb_tooltip_1') }}
                </li>
                <li>
                  {{ t('settings_notification_do_not_disturb_tooltip_2') }}
                </li>
                <li>
                  {{ t('settings_notification_do_not_disturb_tooltip_3') }}
                </li>
              </ul>
            </div>
          </template>
        </Tooltip>
      </div>
      <div class="field">
        <md-switch icons :selected="doNotDisturb" @change="handleDoNotDisturbToggle"></md-switch>
      </div>
    </div>

    <!-- 后台通知提醒 -->
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
          icons
          :selected="mirror"
          :disabled="doNotDisturb"
          @change="handleMirrorToggle"
        ></md-switch>
      </div>
    </div>

    <!-- 通知显示时长 -->
    <div class="row row--slider">
      <div class="label label--with-tooltip">
        {{ t('settings_notification_duration') }}
        <Tooltip offset="md">
          <LucideIcon name="info" class="label-info-icon" />
          <template #content>
            <div class="tooltip-content">
              <strong>{{ t('settings_notification_duration_tooltip_title') }}</strong>
              <ul>
                <li>{{ t('settings_notification_duration_tooltip_1') }}</li>
                <li>{{ t('settings_notification_duration_tooltip_2') }}</li>
                <li>{{ t('settings_notification_duration_tooltip_3') }}</li>
              </ul>
            </div>
          </template>
        </Tooltip>
      </div>
      <div class="field field--slider">
        <md-slider
          ref="sliderRef"
          :min="1"
          :max="10"
          :step="1"
          :value="notificationDuration"
          labeled
          @input="handleDurationInput"
          @change="handleDurationChange"
        ></md-slider>
        <span class="duration-value"
          >{{ notificationDuration }} {{ t('settings_notification_duration_seconds') }}</span
        >
      </div>
    </div>
  </div>
</template>
<style scoped>
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

.row--slider {
  align-items: center;

  /* 确保水平布局 */
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

.field {
  flex-shrink: 0;
}

.field--slider {
  display: flex;
  flex-direction: row;
  flex: 1;
  align-items: center;
  gap: var(--spacing-3);
}

md-slider {
  flex: 1;
  min-width: 200px;
  max-width: 400px;
  height: 48px;
}

.duration-value {
  min-width: 60px;
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  text-align: right;
  white-space: nowrap;
  color: var(--color-text-primary);
}

md-switch {
  flex-shrink: 0;
}

/* 禁用状态样式 */
md-switch:disabled {
  opacity: 0.5;
  cursor: not-allowed;
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

.description-row {
  margin-left: calc(160px + var(--spacing-3));
}

.feature-description {
  margin: 0;
  font-size: var(--text-xs);
  line-height: 1.5;
  color: var(--color-text-tertiary);
}
</style>
