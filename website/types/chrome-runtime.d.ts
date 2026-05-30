/**
 * 官网与 Chrome 扩展通信所需的最小 Chrome Runtime 类型。
 */
interface WebsiteChromeRuntime {
  sendMessage(
    extensionId: string,
    message: Record<string, unknown>,
    callback?: (response?: unknown) => void
  ): Promise<unknown> | void
}

interface WebsiteChromeApi {
  runtime?: WebsiteChromeRuntime
}

declare global {
  interface Window {
    chrome?: WebsiteChromeApi
  }
}

export {}
