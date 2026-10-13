/**
 * 官网会话存活探测：本浏览器官网 session 作废时（非「扩展挤掉」——官网可多端同登），
 * 本地 JWT 可能仍未过期。用 getUser / onAuthStateChange 尽快反映未登录，无需用户点操作。
 */

import { getSupabase } from './supabase'

export type WebsiteAuthLivenessStop = () => void

/**
 * 向 Auth 校验当前用户；失效则 local signOut。
 * @returns 是否仍登录
 */
export async function probeWebsiteAuthStillValid(): Promise<boolean> {
  const supabase = await getSupabase()
  const { data: sessionData } = await supabase.auth.getSession()
  if (!sessionData.session) {
    return false
  }
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) {
    try {
      await supabase.auth.signOut({ scope: 'local' })
    } catch {
      // 忽略：本地已视为未登录
    }
    return false
  }
  return true
}

/**
 * 挂载存活监听：可见时立刻探测；周期探测；SIGNED_OUT 回调。
 * @param onSignedOut 从已登录变为未登录时调用（可刷新 UI / 跳转）
 */
export async function startWebsiteAuthLiveness(
  onSignedOut: () => void
): Promise<WebsiteAuthLivenessStop> {
  const supabase = await getSupabase()
  let stopped = false
  let wasSignedIn = Boolean((await supabase.auth.getSession()).data.session)

  const handleMaybeSignedOut = (stillSignedIn: boolean): void => {
    if (stopped) {
      return
    }
    if (wasSignedIn && !stillSignedIn) {
      wasSignedIn = false
      onSignedOut()
      return
    }
    wasSignedIn = stillSignedIn
  }

  const runProbe = (): void => {
    void probeWebsiteAuthStillValid().then(handleMaybeSignedOut)
  }

  const onVisibility = (): void => {
    if (document.visibilityState === 'visible') {
      runProbe()
    }
  }

  document.addEventListener('visibilitychange', onVisibility)
  const intervalId = window.setInterval(runProbe, 60_000)

  const { data: sub } = supabase.auth.onAuthStateChange(event => {
    if (event === 'SIGNED_OUT') {
      handleMaybeSignedOut(false)
    } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
      wasSignedIn = true
    }
  })

  // 首屏也探一次（挤掉后立刻打开账号页）
  runProbe()

  return () => {
    stopped = true
    document.removeEventListener('visibilitychange', onVisibility)
    window.clearInterval(intervalId)
    sub.subscription.unsubscribe()
  }
}
