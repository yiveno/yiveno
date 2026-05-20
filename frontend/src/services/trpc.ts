import { createTRPCProxyClient, httpBatchLink } from '@trpc/client'
import type { AppRouter } from '../../../backend/src/router'

const getBaseUrl = () => {
  // Chrome Extension 环境中，必须使用完整的后端 URL
  // 不能使用相对路径，因为会被解析为 chrome-extension:// 协议
  
  // 开发环境：强制使用本地 Cloudflare Workers（HTTPS）
  // 注意：必须在环境变量检查之前，因为 .env 中配置的是生产环境 URL
  if (import.meta.env.DEV) {
    return 'https://localhost:8787'
  }
  
  // 生产环境：优先使用环境变量配置的 API URL
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL
  }
  
  // 生产环境默认值：使用部署的 Cloudflare Workers
  return 'https://api.acuitybookmarks.com'
}

// @ts-expect-error - tRPC 类型推断在跨 workspace 时有问题，但运行时正常
export const trpc = createTRPCProxyClient<AppRouter>({
  links: [
    httpBatchLink({
      url: `${getBaseUrl()}/trpc`,
      // You can pass any HTTP headers you wish here
      async headers() {
        return {
          // authorization: getAuthCookie(),
        }
      }
    })
  ]
})
