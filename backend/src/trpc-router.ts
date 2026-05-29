/**
 * tRPC 主路由 —— 聚合所有子路由
 */

import { router } from './trpc'
import { shareRouter } from './trpc/share'

export const appRouter = router({
  share: shareRouter
})

export type AppRouter = typeof appRouter
