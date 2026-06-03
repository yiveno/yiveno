import { createTRPCProxyClient, httpBatchLink } from '@trpc/client'
import type { AppRouter } from '../../../backend/src/trpc-router'

const getBaseUrl = () => {
  // Chrome Extension 环境中，必须使用完整的后端 URL
  // 不能使用相对路径，因为会被解析为 chrome-extension:// 协议

  // 开发环境：优先用 VITE_API_BASE_URL，否则默认本地 HTTP
  if (import.meta.env.DEV) {
    return import.meta.env.VITE_API_BASE_URL || 'http://localhost:8787'
  }

  // 生产环境：优先使用环境变量配置的 API URL
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL
  }

  // 生产环境默认值：使用部署的 Cloudflare Workers
  return 'https://api.ottersage.com'
}

export const trpc = createTRPCProxyClient<AppRouter>({
  links: [
    httpBatchLink({
      url: `${getBaseUrl()}/trpc`,
      async headers() {
        return {}
      }
    })
  ]
})
