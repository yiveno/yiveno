/**
 * Memory 云同步 Pro 门禁（可单测，避免 mock.module 污染其它路由测试）。
 */

import type { Env } from '../../types/env'
import { isActiveProUser } from '../ai/require-pro-user'

/**
 * 写/拉同步前校验有效 Pro。
 * @returns null 表示通过；否则为应返回的 JSON 错误体。
 */
export async function denyUnlessActivePro(
  env: Env,
  userId: string
): Promise<{ error: 'pro_required' } | null> {
  const isPro = await isActiveProUser(env, userId)
  if (!isPro) {
    return { error: 'pro_required' }
  }
  return null
}
