import { initTRPC } from '@trpc/server'
import type { FetchCreateContextFnOptions } from '@trpc/server/adapters/fetch'
import type { Env } from './types/env'

/**
 * Creates the context for each request.
 * @param {FetchCreateContextFnOptions} opts - The options for creating the context.
 * @param {Env} env - The environment variables.
 * @returns {object} The context object.
 */
export function createContext({ req, resHeaders }: FetchCreateContextFnOptions, env: Env) {
  return {
    req,
    resHeaders,
    env
  }
}

export type Context = Awaited<ReturnType<typeof createContext>>

/**
 * Initialization of tRPC backend
 * Should be done only once per backend!
 */
const t = initTRPC.context<Context>().create()

/**
 * Export reusable router and procedure helpers
 * that can be used throughout the router
 */
export const router = t.router
export const publicProcedure = t.procedure
