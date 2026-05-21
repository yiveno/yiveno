import { createTRPCProxyClient, httpBatchLink } from '@trpc/client'
// import type { AppRouter } from '../../../backend/src/router'

const getBaseUrl = () => {
  if (typeof window !== 'undefined') {
    // Browser should use relative path
    return ''
  }
  // TODO: Replace with your actual production backend URL
  return process.env.VITE_API_URL || 'https://localhost:8787'
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export const trpc = createTRPCProxyClient<any>({
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
