/**
 * 用扩展 access token（Bearer）为**本浏览器官网**铸造独立 Supabase 会话。
 * **不**写扩展租约、**不**挤掉扩展（官网可多端同登）。
 */

import type { Env } from '../../types/env'
import { info } from '../../utils/logger'
import {
  issueSupabaseUserSession,
  type IssuedSupabaseUserSession,
  type IssueSupabaseUserSessionResult
} from './issue-supabase-user-session'

export type MintWebsiteSessionResult =
  | { ok: true; session: IssuedSupabaseUserSession }
  | Extract<IssueSupabaseUserSessionResult, { ok: false }>

/**
 * 扩展已登录 → 官网未登录（或需对齐同一账号）时调用。
 */
export async function mintWebsiteSessionFromExtension(
  env: Env,
  userId: string,
  emailFromJwt: string | null
): Promise<MintWebsiteSessionResult> {
  const issued = await issueSupabaseUserSession(env, userId, emailFromJwt, '[Auth] website-session')
  if (!issued.ok) {
    return issued
  }
  info('[Auth] 已为官网铸造会话（扩展 Bearer）', {
    userId,
    hasSessionId: Boolean(issued.session.sessionId)
  })
  return issued
}
