import { z } from 'zod'

/**
 * 官网 → 扩展：device-register 后回传 device token（D 方案 Connect）。
 * 同通道替代旧 `YIVENO_AUTH_SESSION_HANDOFF`（Supabase 会话载荷）。
 * `createdAt` 由扩展本机生成，不在载荷内。
 */
export const ExternalAuthDeviceHandoffSchema = z.object({
  type: z.literal('YIVENO_AUTH_DEVICE_HANDOFF'), // 官网 Connect 回传 device
  payload: z.object({
    deviceToken: z.string().min(32),
    deviceId: z.uuid(),
    userId: z.uuid(),
    isAnonymous: z.boolean(),
    email: z.email().optional(),
    avatarUrl: z.url().optional(),
    displayName: z.string().optional(),
    /** 可选；消费时撤 device（若官网发了） */
    uninstallRevokeToken: z.string().min(32).optional()
  })
})

/**
 * 官网 → 扩展：仅探测官网是否已登录（Side Panel Connect 软条用；不带 token）。
 */
export const WebsiteAuthProbeHandoffSchema = z.object({
  type: z.literal('YIVENO_WEBSITE_AUTH_PROBE'), // 官网 session 探测回传
  payload: z.object({
    signedIn: z.boolean() // 官网当前是否有 Supabase session
  })
})

/**
 * 官网 → 扩展：询问本机扩展是否已登录（Connect 前短路；同账号则跳过 device-register）。
 * 不带 token；扩展只回本地 binding / device session 的 userId。
 */
export const ExtensionAuthStatusProbeSchema = z.object({
  type: z.literal('YIVENO_EXTENSION_AUTH_STATUS_PROBE'), // 官网问扩展登录态
  payload: z
    .object({
      expectedUserId: z.string().min(1).optional() // 官网当前 userId（可选，便于对照）
    })
    .optional()
})

/**
 * 官网 → 扩展：请求用扩展登录态为官网铸造会话（反向接通；扩展调 Worker，回传 token）。
 * 仅 externally_connectable 官网源；**禁止**经 UI 桥 Port 传 token。
 */
export const WebsiteSessionRequestSchema = z.object({
  type: z.literal('YIVENO_WEBSITE_SESSION_REQUEST'), // 官网向扩展要官网会话
  payload: z
    .object({
      nextPath: z.string().min(1).optional() // 官网落地路径提示（扩展可忽略）
    })
    .optional()
})

export const ExternalAuthHandoffMessageSchema = z.union([
  ExternalAuthDeviceHandoffSchema,
  WebsiteAuthProbeHandoffSchema,
  ExtensionAuthStatusProbeSchema,
  WebsiteSessionRequestSchema
])

/** 扩展处理 handoff 后的响应（ok / 错误码；状态/官网会话可附带字段）。 */
export type ExternalAuthHandoffResponse =
  | {
      ok: true
      signedIn?: boolean
      userId?: string
      /** STATUS_PROBE：扩展当前会话是否为匿名占位（官网 Connect 据此决定是否覆盖） */
      isAnonymous?: boolean
      /** STATUS_PROBE / WEBSITE_SESSION_REQUEST：展示用 */
      email?: string
      displayName?: string
      /** 仅 WEBSITE_SESSION_REQUEST 成功时 */
      accessToken?: string
      refreshToken?: string
      expiresAt?: number
    }
  | { ok: false; error: string }
