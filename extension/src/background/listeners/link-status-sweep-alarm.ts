/**
 * 注册死链巡检闹钟监听；启动时按 Settings 开关挂/卸闹钟。
 */

import { ensureBackgroundBootstrapped } from '@/background/bootstrap-ready'
import { sweepMemoryLinkStatusTick } from '@/application/dreaming/sweep-memory-link-status'
import {
  LINK_STATUS_SWEEP_ALARM_NAME,
  ensureLinkStatusSweepAlarm
} from '@/infrastructure/sync/link-status-sweep-alarm'
import { getUserSettings } from '@/infrastructure/settings/user-settings-service'
import { logger } from '@/infrastructure/logging/logger'

let registered = false

async function ensureBootstrapReady(): Promise<void> {
  await ensureBackgroundBootstrapped()
}

async function handleLinkStatusSweepAlarmTick(): Promise<void> {
  const settings = await getUserSettings()
  if (!settings.linkStatusSweepEnabled) {
    logger.info('Dreaming', '死链闹钟触发但开关已关，跳过且清除闹钟')
    await ensureLinkStatusSweepAlarm(false)
    return
  }
  const result = await sweepMemoryLinkStatusTick()
  logger.info('Dreaming', '定时 tick · 死链巡检', result)
}

/** 注册 alarms.onAlarm；启动时按开关挂周期闹钟。 */
export function registerLinkStatusSweepAlarmListener(): void {
  if (registered) {
    return
  }
  if (typeof chrome === 'undefined' || !chrome.alarms) {
    logger.warn('Dreaming', '无法注册死链巡检闹钟：chrome.alarms 不可用')
    return
  }

  chrome.alarms.onAlarm.addListener(alarm => {
    if (alarm.name !== LINK_STATUS_SWEEP_ALARM_NAME) {
      return
    }
    void ensureBootstrapReady()
      .then(() => handleLinkStatusSweepAlarmTick())
      .catch(error => {
        logger.error('Dreaming', '定时死链巡检 tick 异常', error)
      })
  })

  registered = true
  logger.info('Dreaming', '死链巡检闹钟监听已注册')

  void getUserSettings()
    .then(settings => ensureLinkStatusSweepAlarm(settings.linkStatusSweepEnabled))
    .catch(error => {
      logger.warn('Dreaming', '启动时挂载死链巡检闹钟失败', error)
    })
}

/** 当前是否已挂上闹钟监听（测试 / 诊断用）。 */
export function isLinkStatusSweepAlarmListenerRegistered(): boolean {
  return registered
}

/** 测试用：重置监听器注册状态。 */
export function resetLinkStatusSweepAlarmListenerForTests(): void {
  registered = false
}
