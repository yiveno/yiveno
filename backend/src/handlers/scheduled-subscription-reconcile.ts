import { reconcileStaleActiveSubscriptions } from '../services/billing/reconcile'
import type { Env } from '../types/env'
import { error as logErrorMessage, info } from '../utils/logger'

/** Worker cron：对账过期的 active 订阅投影（§A.3.2） */
export async function handleScheduledSubscriptionReconcile(
  controller: Pick<ScheduledController, 'cron' | 'scheduledTime'>,
  env: Env
): Promise<void> {
  const enabled =
    (env as Env & { SUBSCRIPTION_RECONCILE_SCHEDULED_ENABLED?: string })
      .SUBSCRIPTION_RECONCILE_SCHEDULED_ENABLED !== 'false'
  if (!enabled) {
    info('[BillingReconcile] 定时对账已关闭', {
      cron: controller.cron,
      scheduledTime: new Date(controller.scheduledTime).toISOString()
    })
    return
  }

  try {
    const result = await reconcileStaleActiveSubscriptions(env)
    info('[BillingReconcile] 定时对账完成', {
      cron: controller.cron,
      ...result
    })
  } catch (error) {
    logErrorMessage('[BillingReconcile] 定时对账失败', {
      cron: controller.cron,
      scheduledTime: new Date(controller.scheduledTime).toISOString(),
      detail: error instanceof Error ? error.message : String(error)
    })
    throw error
  }
}
