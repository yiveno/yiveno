/**
 * Vite 配置常量
 */

import { resolve } from 'path'

export const ROOT_DIR = resolve(__dirname, '..')
export const PROJECT_ROOT = resolve(ROOT_DIR, '..')
export const OUT_DIR = resolve(PROJECT_ROOT, 'dist')
export const SRC_DIR = resolve(ROOT_DIR, 'src')

/** 生产构建默认丢弃 console；KEEP_CONSOLE=true 可强制保留。 */
export const SHOULD_DROP_CONSOLE =
  process.env.NODE_ENV === 'production' && process.env.KEEP_CONSOLE !== 'true'

export const DEBUG_MODE = !SHOULD_DROP_CONSOLE

export function logBuildConfig() {
  console.log('🔧 构建配置:', {
    DEBUG_MODE,
    SHOULD_DROP_CONSOLE,
    ENABLE_SOURCEMAP: DEBUG_MODE,
    NODE_ENV: process.env.NODE_ENV,
    KEEP_CONSOLE: process.env.KEEP_CONSOLE
  })
}
