/**
 * Cloudflare Worker 主入口
 *
 * 使用 Hono 框架构建的高性能 API
 */

import { createApp } from './app'

/**
 * 创建 Hono 应用实例
 */
const app = createApp()

/**
 * 导出 Cloudflare Worker 处理器
 */
export default app
