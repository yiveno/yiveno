/**
 * 扩展卸载落地页：与登录解耦——安装后始终 setUninstallURL 开反馈页；
 * 仅登录态才把一次性 revoke token 挂进 URL，卸载时落地页再清远程扩展会话。
 * Chrome 卸载时 SW 不再运行，只能靠卸载 URL 打开官网。
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

/**
 * 组装卸载落地页 URL。
 * @param token 有值时落地页会先 revoke 扩展远程会话；无值则仅反馈
 */
export function buildExtensionUninstallPageUrl(token?: string | null): string {
  const url = new URL('/auth/extension-uninstalled', `${getWebsiteBaseUrl()}/`)
  const trimmed = typeof token === 'string' ? token.trim() : ''
  if (trimmed) {
    url.searchParams.set('token', trimmed)
  }
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
 * 安装/启动幂等：确保卸载必开反馈页。
 * storage 若仍有 revoke token（已登录），URL 带上 token。
 */
export async function ensureExtensionUninstallFeedbackUrl(): Promise<void> {
  const stored = await readChromeStorageLocal(
    UNINSTALL_REVOKE_TOKEN_STORAGE_KEY,
    UninstallRevokeTokenRecordSchema
  )
  const token = stored?.token?.trim() || null
  await setChromeUninstallUrl(buildExtensionUninstallPageUrl(token))
  logger.info('Auth', '已确保扩展卸载反馈 URL', { hasRevokeToken: Boolean(token) })
}

/**
 * 登录 handoff 成功后：持久化 token 并登记带 token 的卸载 URL。
 * token 为空则清旧 token，仍保留无 token 反馈 URL（不整段清空）。
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
  /** 是否先调 Worker 销远程（主动退出时应 true；仅换 token / 被挤掉时 false） */
  revokeRemote?: boolean
}

/**
 * 退出 / 换发 / 被挤掉：可选远程 revoke → 清 storage 中的 token →
 * **仍保留**无 token 的卸载反馈 URL（卸载与反馈强绑定，不因退登而关掉）。
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
  await setChromeUninstallUrl(buildExtensionUninstallPageUrl(null))
  logger.info('Auth', '已清卸载 revoke token，保留反馈 URL')
}
