import type {
  BackgroundMessage,
  BackgroundMessageResponse,
  GetLocalIdentityMessage,
  GetLocalIdentityResponse
} from '@/core/messaging/background-messages'

/** 向 Background 发送消息并返回响应。 */
export async function sendBackgroundMessage<TResponse extends BackgroundMessageResponse>(
  message: BackgroundMessage
): Promise<TResponse> {
  return (await chrome.runtime.sendMessage(message)) as TResponse
}

/** 读取本地身份与 ownerId（经 Background，符合单向数据流）。 */
export async function fetchLocalIdentity(): Promise<GetLocalIdentityResponse> {
  const message: GetLocalIdentityMessage = {
    scope: 'background',
    type: 'GET_LOCAL_IDENTITY'
  }
  return sendBackgroundMessage<GetLocalIdentityResponse>(message)
}
