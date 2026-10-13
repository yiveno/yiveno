/** 扩展多入口（sidepanel / settings / background / offscreen）。
 * content script 由 content-scripts-iife 插件单独打成 IIFE，不放在此列表。
 * Probe Console 仅 development 打入，不进 CWS production 产物。
 */
import { resolve } from 'path'
import { SRC_DIR } from './constants'

export function createBuildInput(options: { includeProbeConsole?: boolean } = {}) {
  const input: Record<string, string> = {
    sidepanel: resolve(SRC_DIR, 'pages/sidepanel/index.html'),
    settings: resolve(SRC_DIR, 'pages/settings/index.html'),
    detail: resolve(SRC_DIR, 'pages/detail/index.html'),
    library: resolve(SRC_DIR, 'pages/library/index.html'),
    getting_started: resolve(SRC_DIR, 'pages/getting-started/index.html'),
    background: resolve(SRC_DIR, 'background/main.ts'),
    offscreen: resolve(SRC_DIR, 'offscreen/main.ts')
  }

  if (options.includeProbeConsole) {
    // DEV-only；物理隔离在 src/dev/，勿迁入 pages/
    input.probe_console = resolve(SRC_DIR, 'dev/probe-console/index.html')
  }

  return input
}

export function createBuildOptions(options: { includeProbeConsole?: boolean } = {}) {
  return {
    input: createBuildInput(options),
    output: {
      entryFileNames: '[name].js',
      chunkFileNames: 'assets/[name]-[hash].js',
      assetFileNames: 'assets/[name]-[hash][extname]'
    },
    treeshake: {
      propertyReadSideEffects: false as const
    }
  }
}
