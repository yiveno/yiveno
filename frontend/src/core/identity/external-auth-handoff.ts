import { z } from 'zod'

import { AuthSessionSchema } from '@/core/identity/auth-session'

/**
 * 官网 → 扩展的登录会话回传（chrome.runtime.sendMessage + externally_connectable）。
 * 扩展不在此发起 OAuth；只接收已校验的 session 字段。
 */
export const ExternalAuthSessionHandoffSchema = z.object({
  type: z.literal('YIVENO_AUTH_SESSION_HANDOFF'), // 官网登录成功后回传
  payload: AuthSessionSchema
})

/**
 * 官网 → 扩展：网站已退出，扩展应按 keep_local 清登录态（保留 Memory）。
 */
export const ExternalAuthSignOutHandoffSchema = z.object({
  type: z.literal('YIVENO_AUTH_SIGN_OUT_HANDOFF'), // 官网账户页退出
  payload: z
    .object({
      reason: z.literal('website_sign_out').optional() // 官网主动退出
    })
    .optional()
})

export const ExternalAuthHandoffMessageSchema = z.union([
  ExternalAuthSessionHandoffSchema,
  ExternalAuthSignOutHandoffSchema
])

export type ExternalAuthHandoffMessage = z.infer<typeof ExternalAuthHandoffMessageSchema>

/** 扩展处理 handoff 后的响应（ok / 错误码）。 */
export type ExternalAuthHandoffResponse = { ok: true } | { ok: false; error: string }
