/** Offscreen Document 通信的最小基础接口。 */
export interface OffscreenMessage<TPayload = unknown> {
  type: string
  payload?: TPayload
}

/** 向 Offscreen Document 转发已定义的领域任务。 */
export async function dispatchOffscreenRequest<TResponse, TPayload = unknown>(
  message: OffscreenMessage<TPayload>
): Promise<TResponse> {
  return (await chrome.runtime.sendMessage({ scope: 'offscreen', ...message })) as TResponse
}
