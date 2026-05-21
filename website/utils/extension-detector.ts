/**
 * 扩展检测工具
 * 用于检测 AcuityBookmarks 扩展是否已安装
 */

/**
 * Chrome Runtime 接口
 */
interface ChromeRuntime {
  sendMessage: (
    extensionId: string,
    message: Record<string, unknown>,
    callback: (response: unknown) => void
  ) => void
  lastError?: { message: string }
}

/**
 * Chrome API 接口
 */
interface ChromeAPI {
  runtime?: ChromeRuntime
}

/**
 * 扩展响应接口
 */
interface ExtensionResponse {
  installed?: boolean
  version?: string
}

/**
 * 检测扩展是否已安装
 *
 * 方法：通过 chrome.runtime.sendMessage 通信
 * 扩展会在 manifest.json 中配置 externally_connectable，允许官网与扩展通信
 *
 * @returns Promise<boolean> 是否已安装
 */
export async function detectExtension(): Promise<boolean> {
  // 检查是否在浏览器环境
  if (typeof window === 'undefined') {
    return false
  }

  // 检查是否支持 Chrome Extension API
  const chrome = (window as unknown as { chrome?: ChromeAPI }).chrome
  if (!chrome || !chrome.runtime || !chrome.runtime.sendMessage) {
    console.log('❌ 浏览器不支持 Chrome Extension API')
    return false
  }

  try {
    // 保存 runtime 引用以避免 TypeScript 类型检查问题
    const runtime = chrome.runtime
    
    // 尝试与扩展通信
    // 注意：不需要指定 extensionId，扩展会通过 externally_connectable 配置接收消息
    const response = await new Promise<ExtensionResponse>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('通信超时'))
      }, 2000)

      runtime.sendMessage(
        // 不指定 extensionId，让扩展通过 externally_connectable 接收
        { type: 'CHECK_EXTENSION_INSTALLED' } as unknown as string,
        {} as Record<string, unknown>,
        (extensionResponse: unknown) => {
          clearTimeout(timeout)

          if (runtime.lastError) {
            reject(runtime.lastError)
          } else {
            resolve(extensionResponse as ExtensionResponse)
          }
        }
      )
    })

    if (response && response.installed) {
      console.log('✅ 检测到扩展已安装', {
        version: response.version
      })
      return true
    }
  } catch (error) {
    console.log('❌ 扩展检测失败:', error)
  }

  return false
}

/**
 * 获取扩展信息
 *
 * @returns Promise<ExtensionInfo> 扩展信息
 */
export interface ExtensionInfo {
  installed: boolean
  version?: string
}

export async function getExtensionInfo(): Promise<ExtensionInfo> {
  const installed = await detectExtension()

  if (!installed) {
    return { installed: false }
  }

  // 尝试获取版本信息
  try {
    const chrome = (window as unknown as { chrome?: ChromeAPI }).chrome
    if (!chrome || !chrome.runtime || !chrome.runtime.sendMessage) {
      return { installed: true }
    }

    // 保存 runtime 引用以避免 TypeScript 类型检查问题
    const runtime = chrome.runtime

    const response = await new Promise<ExtensionResponse>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('通信超时'))
      }, 2000)

      runtime.sendMessage(
        { type: 'CHECK_EXTENSION_INSTALLED' } as unknown as string,
        {} as Record<string, unknown>,
        (extensionResponse: unknown) => {
          clearTimeout(timeout)

          if (runtime.lastError) {
            reject(runtime.lastError)
          } else {
            resolve(extensionResponse as ExtensionResponse)
          }
        }
      )
    })

    return {
      installed: true,
      version: response.version
    }
  } catch (error) {
    console.error('获取扩展信息失败:', error)
  }

  return { installed: true }
}

/**
 * 打开扩展的管理页面
 */
export function openExtensionManagement(): void {
  const chrome = (window as unknown as { chrome?: ChromeAPI }).chrome
  if (!chrome || !chrome.runtime || !chrome.runtime.sendMessage) {
    return
  }

  // 保存 runtime 引用以避免 TypeScript 类型检查问题
  const runtime = chrome.runtime

  runtime.sendMessage(
    { type: 'OPEN_MANAGEMENT_PAGE' } as unknown as string,
    {} as Record<string, unknown>,
    () => {
      if (runtime.lastError) {
        console.error('打开管理页面失败:', runtime.lastError)
      }
    }
  )
}
