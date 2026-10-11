/**
 * 扩展卸载清远程登录：登录后 setUninstallURL；退出时清 URL 并尽力消费 revoke token。
 * Chrome 卸载时 SW 不再运行，只能靠卸载 URL 打开官网落地页。
 */

import { z } from 'zod'

import { getWebsiteBaseUrl } from '@/infrastructure/browser/website-page'
import { logger } from '@/infrastructure/logging/logger'
import {
  readChromeStorageLocal,
  removeChromeStorageLocal,
  writeChromeStorageLocal
} from '@/infrastructure/storage/chrome-storage-local'

/** chrome.storage.local：当前活跃扩展会话的卸载 revoke token */
export const UNINSTALL_REVOKE_TOKEN_STORAGE_KEY = 'yiveno:uninstall_revoke_token' as const

const UninstallRevokeTokenRecordSchema = z.object({
  token: z.string().min(32)
})

function getApiBaseUrl(): string {
  const fromEnv = import.meta.env.VITE_API_BASE_URL?.trim()
  return fromEnv ? fromEnv.replace(/\/$/, '') : 'http://localhost:8787'
}

/** 组装卸载落地页 URL（含一次性 token）。 */
export function buildExtensionUninstallPageUrl(token: string): string {
  const url = new URL('/auth/extension-uninstalled', `${getWebsiteBaseUrl()}/`)
  url.searchParams.set('token', token.trim())
  return url.toString()
}

function setChromeUninstallUrl(url: string): Promise<void> {
  return new Promise(resolve => {
    try {
      chrome.runtime.setUninstallURL(url, () => {
        const err = chrome.runtime.lastError
        if (err?.message) {
          logger.warn('Auth', 'setUninstallURL 失败', { message: err.message })
        }
        resolve()
      })
    } catch (error) {
      logger.warn('Auth', 'setUninstallURL 异常', error)
      resolve()
    }
  })
}

/**
 * 登录 handoff 成功后：持久化 token 并登记卸载 URL。
 * token 为空则仅尽力清空旧卸载 URL（避免沿用上一会话）。
 */
export async function registerExtensionUninstallRevoke(
  token: string | null | undefined
): Promise<void> {
  const trimmed = typeof token === 'string' ? token.trim() : ''
  if (!trimmed) {
    await clearExtensionUninstallRevoke({ revokeRemote: false })
    return
  }
  await writeChromeStorageLocal(UNINSTALL_REVOKE_TOKEN_STORAGE_KEY, { token: trimmed })
  await setChromeUninstallUrl(buildExtensionUninstallPageUrl(trimmed))
  logger.info('Auth', '已登记扩展卸载 revoke URL')
}

/**
 * 向 Worker 消费一次性 revoke token（销远程扩展会话）。
 * 网络失败不抛；返回是否 HTTP 成功。
 */
export async function postExtensionUninstallRevoke(token: string): Promise<boolean> {
  const trimmed = token.trim()
  if (!trimmed) {
    return false
  }
  try {
    const res = await fetch(`${getApiBaseUrl()}/api/auth/extension-uninstall-revoke`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token: trimmed })
    })
    if (!res.ok) {
      logger.warn('Auth', '卸载 revoke API 非成功', { status: res.status })
      return false
    }
    return true
  } catch (error) {
    logger.warn('Auth', '卸载 revoke API 请求失败', error)
    return false
  }
}

export type ClearExtensionUninstallRevokeOptions = {
  /** 是否先调 Worker 销远程（主动退出时应 true；仅换 token 时 false） */
  revokeRemote?: boolean
}

/**
 * 退出 / 换发前：可选远程 revoke → 清 storage → 清空 setUninstallURL。
 */
export async function clearExtensionUninstallRevoke(
  options: ClearExtensionUninstallRevokeOptions = {}
): Promise<void> {
  const revokeRemote = options.revokeRemote === true
  const stored = await readChromeStorageLocal(
    UNINSTALL_REVOKE_TOKEN_STORAGE_KEY,
    UninstallRevokeTokenRecordSchema
  )
  if (revokeRemote && stored?.token) {
    await postExtensionUninstallRevoke(stored.token)
  }
  await removeChromeStorageLocal(UNINSTALL_REVOKE_TOKEN_STORAGE_KEY)
  await setChromeUninstallUrl('')
}
