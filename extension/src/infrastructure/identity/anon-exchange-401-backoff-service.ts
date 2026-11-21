/**
 * 匿名 exchange 401 熔断读写（`yiveno:anon_exchange_401_backoff`）。
 * 与待交换会话分键：清 pending 不动本键；成功 exchange 后与 pending 一并清除。
 */

import {
  ANON_EXCHANGE_401_BACKOFF_STORAGE_KEY,
  AnonExchange401BackoffSchema,
  type AnonExchange401Backoff
} from '@/core/identity/pending-anonymous-session'
import {
  readChromeStorageLocal,
  removeChromeStorageLocal,
  writeChromeStorageLocal
} from '@/infrastructure/storage/chrome-storage-local'

/** 读取 401 熔断状态。 */
export async function getAnonExchange401Backoff(): Promise<AnonExchange401Backoff | null> {
  return readChromeStorageLocal(ANON_EXCHANGE_401_BACKOFF_STORAGE_KEY, AnonExchange401BackoffSchema)
}

/** 写入 / 累加一次 401 记录。 */
export async function recordAnonExchange401(): Promise<AnonExchange401Backoff> {
  const existing = await getAnonExchange401Backoff()
  const next: AnonExchange401Backoff = {
    last401At: new Date().toISOString(),
    count: (existing?.count ?? 0) + 1
  }
  const parsed = AnonExchange401BackoffSchema.parse(next)
  await writeChromeStorageLocal(ANON_EXCHANGE_401_BACKOFF_STORAGE_KEY, parsed)
  return parsed
}

/** 清除 401 熔断（exchange 成功后）。 */
export async function clearAnonExchange401Backoff(): Promise<void> {
  await removeChromeStorageLocal(ANON_EXCHANGE_401_BACKOFF_STORAGE_KEY)
}
