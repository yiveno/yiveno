/**
 * 评测专用 mint：Actions 用 x-eval-mint-token 换短期 Supabase accessToken。
 * 禁止接受请求体传入的 email/userId；邮箱仅来自 env.EVAL_MINT_USER_EMAIL。
 */

import { Hono } from 'hono'
import { createSupabaseClient } from '../data-access/supabase'
import { AdminUserLookupError, findUserByEmail } from '../services/auth/admin-user-lookup'
import {
  issueSupabaseUserSession,
  type IssueSupabaseUserSessionResult
} from '../services/auth/issue-supabase-user-session'
import type { Env } from '../types/env'
import { info, warn } from '../utils/logger'

const DEFAULT_EVAL_MINT_EMAIL = 'retrieval-ablation-local@yiveno.dev'

type EvalVars = {
  Bindings: Env
}

export const evalRouter = new Hono<EvalVars>()

/**
 * 常量时间比较两个 UTF-8 字符串（长度不同也扫描到较长侧，避免早退泄漏）。
 */
export function timingSafeEqualString(left: string, right: string): boolean {
  const enc = new TextEncoder()
  const a = enc.encode(left)
  const b = enc.encode(right)
  const len = Math.max(a.length, b.length)
  let diff = a.length ^ b.length
  for (let i = 0; i < len; i += 1) {
    const x = i < a.length ? a[i]! : 0
    const y = i < b.length ? b[i]! : 0
    diff |= x ^ y
  }
  return diff === 0
}

export type EvalMintIssuer = (
  env: Env,
  userId: string,
  email: string,
  logTag: string
) => Promise<IssueSupabaseUserSessionResult>

export type EvalMintLookup = (
  env: Env,
  email: string
) => Promise<{ found: true; userId: string } | { found: false } | { error: string }>

const defaultLookup: EvalMintLookup = async (env, email) => {
  const admin = createSupabaseClient(env)
  if (!admin) return { error: 'supabase_not_configured' }
  try {
    const result = await findUserByEmail(admin, email)
    return result
  } catch (err) {
    const code = err instanceof AdminUserLookupError ? err.code : 'auth_lookup_failed'
    return { error: code }
  }
}

/**
 * 处理 POST /api/eval/mint-session（可注入 issuer/lookup 便于单测）。
 */
export async function handleEvalMintSession(
  env: Env,
  headerToken: string | undefined,
  deps?: { issue?: EvalMintIssuer; lookup?: EvalMintLookup }
): Promise<Response> {
  const configured = (env.EVAL_MINT_TOKEN || '').trim()
  if (!configured) {
    return Response.json({ error: 'eval_mint_disabled' }, { status: 503 })
  }

  const presented = (headerToken || '').trim()
  if (!presented || !timingSafeEqualString(presented, configured)) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }

  const email = (env.EVAL_MINT_USER_EMAIL || '').trim().toLowerCase() || DEFAULT_EVAL_MINT_EMAIL

  const lookup = deps?.lookup ?? defaultLookup
  const looked = await lookup(env, email)
  if ('error' in looked) {
    warn('[Eval] mint 查用户失败', { error: looked.error })
    return Response.json({ error: looked.error }, { status: 502 })
  }
  if (!looked.found) {
    warn('[Eval] mint 用户不存在')
    return Response.json({ error: 'user_not_found' }, { status: 404 })
  }

  const issue = deps?.issue ?? issueSupabaseUserSession
  const issued = await issue(env, looked.userId, email, '[Eval] mint-session')
  if (!issued.ok) {
    warn('[Eval] mint 签发失败', { error: issued.error })
    return Response.json({ error: issued.error }, { status: 502 })
  }

  info('[Eval] mint-session 成功', { userId: issued.session.userId })
  return Response.json(
    {
      accessToken: issued.session.accessToken,
      userId: issued.session.userId
    },
    {
      status: 200,
      headers: { 'Cache-Control': 'no-store' }
    }
  )
}

evalRouter.post('/mint-session', async c => {
  const headerToken = c.req.header('x-eval-mint-token') ?? undefined
  return handleEvalMintSession(c.env, headerToken)
})
