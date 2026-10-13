/**
 * 删除账号（隐私）：清云端 Memory 后注销 Supabase Auth 用户。
 * 订阅/支付行不删，按法律可保留且不再可登录关联。
 */

import { deleteAllCloudMemoryForOwner } from './memory-items'
import { createSupabaseClient, hasSupabase } from './supabase'
import type { Env } from '../types/env'
import { error as logErrorMessage, info } from '../utils/logger'

export type DeleteAccountResult = {
  deletedItems: number
  deletedBackups: number
}

/**
 * 删除该用户云端 Memory/backups，并注销 Auth 用户。
 * memory_items / backups 对 auth.users 为 CASCADE；仍先显式删除以便返回计数。
 */
export async function deleteAccountForOwner(
  env: Env,
  userId: string
): Promise<DeleteAccountResult> {
  if (!hasSupabase(env)) {
    throw new Error('supabase_not_configured')
  }

  const memory = await deleteAllCloudMemoryForOwner(env, userId)

  const supabase = createSupabaseClient(env)
  if (!supabase) {
    throw new Error('supabase_not_configured')
  }

  const { error } = await supabase.auth.admin.deleteUser(userId)
  if (error) {
    logErrorMessage('[Account] 注销 Auth 用户失败', {
      detail: error.message,
      userId
    })
    throw new Error('account_delete_failed')
  }

  info('[Account] 已删除账号', {
    userId,
    deletedItems: memory.deletedItems,
    deletedBackups: memory.deletedBackups
  })
  return memory
}
