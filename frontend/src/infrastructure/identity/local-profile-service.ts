import {
  AccountBindingSchema,
  ACCOUNT_BINDING_STORAGE_KEY,
  createLocalProfile,
  LOCAL_PROFILE_STORAGE_KEY,
  LocalProfileSchema,
  resolveOwnerId,
  type AccountBinding,
  type LocalProfile
} from '@/core/identity/local-profile'
import {
  readChromeStorageLocal,
  writeChromeStorageLocal
} from '@/infrastructure/storage/chrome-storage-local'

/**
 * 读取或创建本 Chrome Profile 内的本地档案。
 * 仅在可访问 chrome.storage 的上下文调用（当前为 Background）。
 */
export async function getOrCreateLocalProfile(): Promise<LocalProfile> {
  const existing = await readChromeStorageLocal(LOCAL_PROFILE_STORAGE_KEY, LocalProfileSchema)
  if (existing) {
    return existing
  }

  const profile = createLocalProfile()
  await writeChromeStorageLocal(LOCAL_PROFILE_STORAGE_KEY, profile)
  return profile
}

/** 读取账号绑定；未登录时返回 null。 */
export async function getAccountBinding(): Promise<AccountBinding | null> {
  return readChromeStorageLocal(ACCOUNT_BINDING_STORAGE_KEY, AccountBindingSchema)
}

/** 返回当前 MemoryItem 应使用的 ownerId。 */
export async function getCurrentOwnerId(): Promise<string> {
  const [profile, binding] = await Promise.all([getOrCreateLocalProfile(), getAccountBinding()])
  return resolveOwnerId(profile, binding)
}
