import { z } from 'zod'

import { AuthSessionSchema } from '@/core/identity/auth-session'

/**
 * 官网 → 扩展的登录会话回传（chrome.runtime.sendMessage + externally_connectable）。
 * 扩展不在此发起 OAuth；只接收已校验的 session 字段。
 */
export const ExternalAuthSessionHandoffSchema = z.object({
  type: z.literal('YIVENO_AUTH_SESSION_HANDOFF'), // 官网登录成功后回传
  payload: AuthSessionSchema.extend({
    /** 卸载时官网落地页销远程会话用（不写入 AuthSession 本体） */
    uninstallRevokeToken: z.string().min(32).optional()
  })
})

/**
 * 官网 → 扩展：旧版「官网退出连带踢扩展」消息（已退役调用方）。
 * 扩展仍接受并 keep_local，以免缓存旧官网页误发；新产品路径官网退出**不**发此消息。
 */
export const ExternalAuthSignOutHandoffSchema = z.object({
  type: z.literal('YIVENO_AUTH_SIGN_OUT_HANDOFF'), // 遗留：官网连带踢扩展
  payload: z
    .object({
      reason: z.literal('website_sign_out').optional() // 官网主动退出（遗留）
    })
    .optional()
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
 * 官网 → 扩展：询问本机扩展是否已登录（Connect 前短路；避免同机已连通仍 mint/挤掉）。
 * 不带 token；扩展只回本地 binding/session 的 userId。
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
 * 官网 → 扩展：409 租约是否为本机孤儿可认领（不带 token）。
 * 扩展对照本地 lastLeaseSessionId；已登录则不可认领（走 STATUS_PROBE 短路）。
 */
export const ExtensionLeaseReclaimProbeSchema = z.object({
  type: z.literal('YIVENO_EXTENSION_LEASE_RECLAIM_PROBE'), // 官网问能否静默认领租约
  payload: z.object({
    existingSessionId: z.string().min(1) // Worker 409 带回的租约 session_id
  })
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
  ExternalAuthSessionHandoffSchema,
  ExternalAuthSignOutHandoffSchema,
  WebsiteAuthProbeHandoffSchema,
  ExtensionAuthStatusProbeSchema,
  ExtensionLeaseReclaimProbeSchema,
  WebsiteSessionRequestSchema
])

/** 扩展处理 handoff 后的响应（ok / 错误码；状态/认领/官网会话可附带字段）。 */
export type ExternalAuthHandoffResponse =
  | {
      ok: true
      signedIn?: boolean
      userId?: string
      reclaimable?: boolean
      /** 仅 WEBSITE_SESSION_REQUEST 成功时 */
      accessToken?: string
      refreshToken?: string
      email?: string
      expiresAt?: number
    }
  | { ok: false; error: string }
