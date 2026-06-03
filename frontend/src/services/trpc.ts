import { createTRPCProxyClient, httpBatchLink } from '@trpc/client'
import type { AppRouter } from '../../../backend/src/trpc-router'
import { API_CONFIG } from '@/config/constants'

const getBaseUrl = () => {
  // Chrome Extension 环境中，必须使用完整的后端 URL
  // 不能使用相对路径，因为会被解析为 chrome-extension:// 协议
  return API_CONFIG.API_BASE
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
