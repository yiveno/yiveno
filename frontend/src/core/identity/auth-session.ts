import { z } from 'zod'

/** 扩展侧持久化的 Supabase Auth 会话（仅存必要字段）。 */
export const AuthSessionSchema = z.object({
  accessToken: z.string().min(1),
  refreshToken: z.string().min(1),
  expiresAt: z.number().int().nonnegative().optional(),
  userId: z.string().uuid(),
  email: z.string().email().optional(),
  /** 用户头像 URL（OAuth user_metadata.avatar_url / picture） */
  avatarUrl: z.string().url().optional(),
  /** 展示名（user_metadata.name / full_name） */
  displayName: z.string().optional()
})

export type AuthSession = z.infer<typeof AuthSessionSchema>

/** chrome.storage.local 键名。 */
export const AUTH_SESSION_STORAGE_KEY = 'yiveno:auth_session' as const
