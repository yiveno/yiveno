/**
 * Worker cron：每周清理超期匿名 Auth 用户（默认 dry-run）。
 */

import { runAnonymousCleanup, type AnonymousCleanupDeps } from '../services/auth/anonymous-cleanup'
import type { Env } from '../types/env'
import { error as logErrorMessage, info } from '../utils/logger'

/** 与 wrangler.toml triggers 中周日 UTC 03:00 表达式一致 */
export const ANONYMOUS_CLEANUP_CRON = '0 3 * * 0'

/**
 * 定时入口：异常只记日志不抛，避免炸其它 cron 同进程语义（本触发独立）。
 */
export async function handleScheduledAnonymousCleanup(
  controller: Pick<ScheduledController, 'cron' | 'scheduledTime'>,
  env: Env,
  deps: AnonymousCleanupDeps = {}
): Promise<void> {
  const enabled = env.ANON_CLEANUP_SCHEDULED_ENABLED !== 'false'
  if (!enabled) {
    info('[AnonCleanup] 定时清理已关闭', {
      cron: controller.cron,
      scheduledTime: new Date(controller.scheduledTime).toISOString()
    })
    return
  }

  try {
    const result = await runAnonymousCleanup(env, deps)
    info('[AnonCleanup] 定时任务完成', {
      cron: controller.cron,
      scheduledTime: new Date(controller.scheduledTime).toISOString(),
      ...result
    })
  } catch (error) {
    logErrorMessage('[AnonCleanup] 定时任务失败', {
      cron: controller.cron,
      scheduledTime: new Date(controller.scheduledTime).toISOString(),
      detail: error instanceof Error ? error.message : String(error)
    })
  }
}
