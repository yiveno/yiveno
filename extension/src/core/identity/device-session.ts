import { z } from 'zod'

/**
 * 扩展侧持久化的设备会话（D 方案 device token）。
 * 不存 Supabase access/refresh；Bearer 仅用 deviceToken。
 * 权威：docs/device-token-design.md §1.4 / §4。
 */
export const DeviceSessionSchema = z.object({
  /** Worker 签发的 opaque device token（含 `ydt_` 前缀） */
  deviceToken: z.string().min(32),
  /** Worker 设备行主键 */
  deviceId: z.uuid(),
  /** 账号 / 匿名用户 UUID */
  userId: z.uuid(),
  email: z.email().optional(),
  avatarUrl: z.url().optional(),
  displayName: z.string().optional(),
  /** true = GoTrue 匿名号经 session_exchange 所得 */
  isAnonymous: z.boolean(),
  /** 本机写入该会话的时间（ISO） */
  createdAt: z.string().datetime()
})

export type DeviceSession = z.infer<typeof DeviceSessionSchema>

/** chrome.storage.local 键名（替换旧 `yiveno:auth_session`）。 */
export const DEVICE_SESSION_STORAGE_KEY = 'yiveno:device_session' as const

/** 日志用：只暴露 token 末 4 字符。 */
export function maskDeviceTokenForLog(deviceToken: string): string {
  if (deviceToken.length <= 4) {
    return '****'
  }
  return `…${deviceToken.slice(-4)}`
}
