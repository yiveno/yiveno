import { z } from 'zod'

/** 本地身份 schema 版本；升级存储结构时递增。 */
export const LOCAL_PROFILE_SCHEMA_VERSION = 1 as const

/** 扩展在本 Chrome Profile 内的匿名档案。 */
export const LocalProfileSchema = z.object({
  localProfileId: z.string().uuid(),
  createdAt: z.string().datetime(),
  schemaVersion: z.literal(LOCAL_PROFILE_SCHEMA_VERSION)
})

export type LocalProfile = z.infer<typeof LocalProfileSchema>

/** chrome.storage.local 键名。 */
export const LOCAL_PROFILE_STORAGE_KEY = 'yiveno:local_profile' as const

/** OAuth 绑定后的账号关联（可选，未登录时不存在）。 */
export const AccountBindingSchema = z.object({
  accountId: z.string().uuid(),
  boundAt: z.string().datetime()
})

export type AccountBinding = z.infer<typeof AccountBindingSchema>

export const ACCOUNT_BINDING_STORAGE_KEY = 'yiveno:account_binding' as const

/**
 * 解析当前数据归属 ID。
 * 已绑定账号时使用 accountId，否则使用 localProfileId。
 */
export function resolveOwnerId(
  localProfile: LocalProfile,
  accountBinding: AccountBinding | null
): string {
  return accountBinding?.accountId ?? localProfile.localProfileId
}

/** 创建新的本地档案（纯函数，便于测试）。 */
export function createLocalProfile(
  now: () => string = () => new Date().toISOString()
): LocalProfile {
  return {
    localProfileId: crypto.randomUUID(),
    createdAt: now(),
    schemaVersion: LOCAL_PROFILE_SCHEMA_VERSION
  }
}
