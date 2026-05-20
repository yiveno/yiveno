/**
 * tRPC 路由
 */

import { Hono } from 'hono'
import type { Env } from '../types/env'
import { fetchRequestHandler } from '@trpc/server/adapters/fetch'
import { appRouter } from '../router'
import { createContext } from '../trpc'

export const trpcRouter = new Hono<{ Bindings: Env }>()

/**
 * ALL /trpc/*
 * 
 * tRPC 请求处理
 */
trpcRouter.all('/*', async (c) => {
  const request = c.req.raw
  const env = c.env
  
  const handlerOptions: Parameters<typeof fetchRequestHandler>[0] = {
    endpoint: '/trpc',
    req: request,
    router: appRouter,
    createContext: () =>
      createContext({ req: request, resHeaders: new Headers() }, env)
  }

  // 只在开发环境添加 onError
  if (env.NODE_ENV === 'development') {
    handlerOptions.onError = ({ path, error }) => {
      console.error(
        `❌ tRPC failed on ${path ?? '<no-path>'}: ${error.message}`
      )
    }
  }

  return fetchRequestHandler(handlerOptions)
})
