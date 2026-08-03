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

export type ExternalAuthSessionHandoff = z.infer<typeof ExternalAuthSessionHandoffSchema>

export type ExternalAuthHandoffResponse = { ok: true } | { ok: false; error?: string }
