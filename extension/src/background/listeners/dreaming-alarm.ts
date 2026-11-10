/**
 * 注册 dreaming 定时闹钟监听。
 * Phase 3：读游标 → 编译分片 → 孤儿扫；失败只记日志。
 */

import { ensureBackgroundBootstrapped } from '@/background/bootstrap-ready'
import { compileMemoryNotesTick } from '@/application/dreaming/compile-memory-notes'
import { sweepOrphanMemoryNotes } from '@/application/dreaming/sweep-orphan-memory-notes'
import { DREAMING_ALARM_NAME, ensureDreamingAlarm } from '@/infrastructure/sync/dreaming-alarm'
import { logger } from '@/infrastructure/logging/logger'

let registered = false

async function ensureBootstrapReady(): Promise<void> {
  await ensureBackgroundBootstrapped()
}

async function handleDreamingAlarmTick(): Promise<void> {
  const compile = await compileMemoryNotesTick()
  logger.info('Dreaming', '定时 tick · 编译', compile)
  const orphans = await sweepOrphanMemoryNotes()
  logger.info('Dreaming', '定时 tick · 孤儿扫', orphans)
}

/** 注册 alarms.onAlarm；启动时挂上每日周期闹钟。 */
export function registerDreamingAlarmListener(): void {
  if (registered) {
    return
  }
  if (typeof chrome === 'undefined' || !chrome.alarms) {
    logger.warn('Dreaming', '无法注册 dreaming 闹钟：chrome.alarms 不可用')
    return
  }

  chrome.alarms.onAlarm.addListener(alarm => {
    if (alarm.name !== DREAMING_ALARM_NAME) {
      return
    }
    void ensureBootstrapReady()
      .then(() => handleDreamingAlarmTick())
      .catch(error => {
        logger.error('Dreaming', '定时 dreaming tick 异常', error)
      })
  })

  registered = true
  logger.info('Dreaming', 'dreaming 定时闹钟监听已注册')

  void ensureDreamingAlarm(true).catch(error => {
    logger.warn('Dreaming', '启动时挂载 dreaming 闹钟失败', error)
  })
}

/** 当前是否已挂上闹钟监听（测试 / 诊断用）。 */
export function isDreamingAlarmListenerRegistered(): boolean {
  return registered
}

/** 测试用：重置监听器注册状态。 */
export function resetDreamingAlarmListenerForTests(): void {
  registered = false
}
