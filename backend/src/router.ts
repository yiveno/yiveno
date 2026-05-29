import { router } from './trpc'
import { shareRouter } from './routers/share'

/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */
export const appRouter = router({
  share: shareRouter
})

// export type definition of API
export type AppRouter = typeof appRouter
