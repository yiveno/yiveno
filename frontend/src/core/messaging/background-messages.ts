import type { LocalProfile } from '@/core/identity/local-profile'

/** Background 消息统一 scope。 */
export const BACKGROUND_MESSAGE_SCOPE = 'background' as const

/** 读取本地身份与当前 ownerId。 */
export type GetLocalIdentityMessage = {
  scope: typeof BACKGROUND_MESSAGE_SCOPE
  type: 'GET_LOCAL_IDENTITY'
}

export type GetLocalIdentityResponse =
  | {
      ok: true
      profile: LocalProfile
      ownerId: string
    }
  | {
      ok: false
      error: string
    }

/** Background 存活探测。 */
export type PingBackgroundMessage = {
  scope: typeof BACKGROUND_MESSAGE_SCOPE
  type: 'PING'
}

export type PingBackgroundResponse = {
  ok: true
}

export type BackgroundMessage = GetLocalIdentityMessage | PingBackgroundMessage

export type BackgroundMessageResponse = GetLocalIdentityResponse | PingBackgroundResponse
