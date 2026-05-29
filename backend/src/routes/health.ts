/**
 * 健康检查路由
 */

import { Hono } from 'hono'
import type { Env } from '../types/env'
import { handleHealth } from '../handlers/health'

export const healthRouter = new Hono<{ Bindings: Env }>()

/** GET /health */
healthRouter.get('/health', c => handleHealth(c.req.header('origin') ?? null))

/** GET /api/health */
healthRouter.get('/api/health', c => handleHealth(c.req.header('origin') ?? null))
