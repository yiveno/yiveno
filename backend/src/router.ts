import { router } from './trpc'
import { exampleRouter } from './routers/example'
import { shareRouter } from './routers/share'

/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */
export const appRouter = router({
  example: exampleRouter as any,  
  share: shareRouter as any  
})

// export type definition of API
export type AppRouter = typeof appRouter
