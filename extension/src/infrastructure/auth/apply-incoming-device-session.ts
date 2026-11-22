/**
 * 写入新 device 会话并清旧 Supabase 会话键。
 * claim（OTP 认领）与官网 handoff 匿名覆盖共用；binding 仅在换账号时写入。
 * 调用方负责：旧 token 撤销、clearAnonExchange401Backoff、迁移门闸触发。
 */

import { markAuthValidatedNow } from '@/infrastructure/auth/auth-session-revalidate'
import { clearAuthSession } from '@/infrastructure/identity/auth-session-service'
import { setDeviceSession } from '@/infrastructure/identity/device-session-service'
import { setAccountBinding } from '@/infrastructure/identity/local-profile-service'
import type { DeviceSession } from '@/core/identity/device-session'

/**
 * ① setDeviceSession → ② clearAuthSession → ③（可选）setAccountBinding → ④ markAuthValidatedNow
 * 与 `applyExternalAuthDeviceHandoff` 匿名覆盖写入顺序对齐（backoff 由调用方处理）。
 */
export async function applyIncomingDeviceSession(input: {
  deviceSession: DeviceSession
  /** 换账号 / 匿名升级时写入 AccountBinding；同账号覆盖 token 时省略 */
  bindAccountId?: string
}): Promise<void> {
  await setDeviceSession(input.deviceSession)
  await clearAuthSession()
  if (input.bindAccountId) {
    await setAccountBinding({
      accountId: input.bindAccountId,
      boundAt: new Date().toISOString()
    })
  }
  await markAuthValidatedNow()
}
