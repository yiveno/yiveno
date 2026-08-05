import { runBusinessDataCleanup } from '../data-access/business-data-cleanup'
import type { Env } from '../types/env'
import { error as logErrorMessage, info } from '../utils/logger'

/** Worker cron：定时清理过期 / 冗余业务数据。 */
export async function handleScheduledCleanup(
  controller: Pick<ScheduledController, 'cron' | 'scheduledTime'>,
  env: Env,
  runner: typeof runBusinessDataCleanup = runBusinessDataCleanup
): Promise<void> {
  const cleanupEnabled = env.CLEANUP_SCHEDULED_ENABLED !== 'false'
  if (!cleanupEnabled) {
    info('[Cleanup] 定时清理已关闭', {
      cron: controller.cron,
      scheduledTime: new Date(controller.scheduledTime).toISOString()
    })
    return
  }

  try {
    await runner(env)
  } catch (error) {
    logErrorMessage('[Cleanup] 定时清理失败', {
      cron: controller.cron,
      scheduledTime: new Date(controller.scheduledTime).toISOString(),
      detail: error instanceof Error ? error.message : String(error)
    })
    throw error
  }
}
