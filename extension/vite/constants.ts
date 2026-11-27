/**
 * Vite 配置常量
 */

import { resolve } from 'path'

export const ROOT_DIR = resolve(__dirname, '..')
export const PROJECT_ROOT = resolve(ROOT_DIR, '..')
export const SRC_DIR = resolve(ROOT_DIR, 'src')

/**
 * 按 Vite mode / NODE_ENV 选仓库根输出目录。
 * production → dist-prod；development/watch → dist（日常加载路径不变）。
 */
export function resolveOutDir(mode?: string): string {
  const resolvedMode = mode ?? process.env.NODE_ENV ?? 'development'
  const dirName = resolvedMode === 'production' ? 'dist-prod' : 'dist'
  return resolve(PROJECT_ROOT, dirName)
}

/** 模块加载时按 NODE_ENV 解析（content IIFE 等无 mode 入口）。 */
export const OUT_DIR = resolveOutDir()

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
    KEEP_CONSOLE: process.env.KEEP_CONSOLE,
    OUT_DIR: resolveOutDir()
  })
}
