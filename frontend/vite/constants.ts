/**
 * Vite 配置常量
 */

import { resolve } from 'path'

/**
 * 项目根目录
 */
export const ROOT_DIR = resolve(__dirname, '..')

/**
 * 项目根目录（用于环境变量）
 */
export const PROJECT_ROOT = resolve(ROOT_DIR, '..')

/**
 * 输出目录
 */
export const OUT_DIR = resolve(PROJECT_ROOT, 'dist')

/**
 * 源码目录
 */
export const SRC_DIR = resolve(ROOT_DIR, 'src')

/**
 * 需要强制转换为 HTTPS 的环境变量
 */
export const HTTPS_ENV_VARS = ['VITE_API_BASE_URL', 'VITE_CLOUDFLARE_WORKER_URL']

/**
 * Console 删除策略：只有明确设置 NODE_ENV=production 且没有调试标志时才删除 console
 * - build:prod (NODE_ENV=production) → 删除 console
 * - build (CRAWLER_DEBUG=true) → 保留 console
 * - build:hot, build:analyze → 保留 console（默认）
 *
 * 注意：Vite 8 使用 Oxc Minifier，不支持 drop_console 配置
 * 需要通过 Rolldown 的 output.minify.compress.drop_console 配置
 */
export const SHOULD_DROP_CONSOLE =
  process.env.NODE_ENV === 'production' &&
  process.env.CRAWLER_DEBUG !== 'true' &&
  process.env.FONT_DEBUG !== 'true' &&
  process.env.KEEP_CONSOLE !== 'true'

/**
 * 开发调试模式标识（用于日志输出）
 */
export const DEBUG_MODE = !SHOULD_DROP_CONSOLE

/**
 * SourceMap 策略：开发/调试时生成 sourcemap，生产环境不生成
 * - build (CRAWLER_DEBUG=true) → 生成 sourcemap（方便调试）
 * - build:prod (NODE_ENV=production) → 不生成 sourcemap（减小体积）
 */
export const ENABLE_SOURCEMAP = DEBUG_MODE

/**
 * 打印构建配置
 */
export function logBuildConfig() {
  console.log('🔧 构建配置:', {
    DEBUG_MODE,
    SHOULD_DROP_CONSOLE,
    ENABLE_SOURCEMAP,
    NODE_ENV: process.env.NODE_ENV,
    CRAWLER_DEBUG: process.env.CRAWLER_DEBUG,
    KEEP_CONSOLE: process.env.KEEP_CONSOLE
  })
}
