/**
 * 探测官网是否已有 Supabase 会话：开后台 tab 跑 probe 页 → external 消息回传。
 * 不 mint、不写入扩展登录态。
 */

import { WebsiteAuthProbeHandoffSchema } from '@/core/identity/external-auth-handoff'
import { getWebsiteBaseUrl } from '@/infrastructure/browser/website-page'
import { logger } from '@/infrastructure/logging/logger'

const PROBE_TIMEOUT_MS = 4500

type ProbeWaiter = {
  resolve: (signedIn: boolean) => void
  timer: ReturnType<typeof setTimeout>
}

let probeWaiter: ProbeWaiter | null = null
let probeTabId: number | null = null
let probeInflight: Promise<boolean> | null = null

/** external 监听收到官网 probe 结果时调用。 */
export function resolveWebsiteAuthProbeFromExternal(message: unknown): boolean {
  const parsed = WebsiteAuthProbeHandoffSchema.safeParse(message)
  if (!parsed.success || !probeWaiter) {
    return false
  }
  const waiter = probeWaiter
  probeWaiter = null
  clearTimeout(waiter.timer)
  waiter.resolve(parsed.data.payload.signedIn)
  return true
}

async function closeProbeTab(): Promise<void> {
  const id = probeTabId
  probeTabId = null
  if (id == null) {
    return
  }
  try {
    await chrome.tabs.remove(id)
  } catch {
    // tab 可能已被 probe 页 window.close
  }
}

/**
 * 打开官网 probe 页并等待 signedIn；超时 / 失败视为未登录（不弹条）。
 */
export async function probeWebsiteSignedIn(): Promise<boolean> {
  if (probeInflight) {
    return probeInflight
  }

  probeInflight = (async () => {
    const url = new URL('/auth/extension-session-probe', `${getWebsiteBaseUrl()}/`)
    url.searchParams.set('extension_id', chrome.runtime.id)

    try {
      const tab = await chrome.tabs.create({ url: url.toString(), active: false })
      probeTabId = typeof tab.id === 'number' ? tab.id : null

      const signedIn = await new Promise<boolean>(resolve => {
        const finish = (value: boolean): void => {
          if (probeWaiter) {
            clearTimeout(probeWaiter.timer)
            probeWaiter = null
          }
          resolve(value)
        }

        probeWaiter = {
          resolve: finish,
          timer: setTimeout(() => {
            logger.warn('Auth', '官网登录探测超时，视为未登录')
            finish(false)
          }, PROBE_TIMEOUT_MS)
        }
      })

      return signedIn
    } catch (error) {
      logger.warn('Auth', '打开官网登录探测页失败', error)
      return false
    } finally {
      await closeProbeTab()
    }
  })()

  try {
    return await probeInflight
  } finally {
    probeInflight = null
  }
}
