/** 扩展多入口（popup / settings / background / offscreen）。
 * content script 由 content-scripts-iife 插件单独打成 IIFE，不放在此列表。
 */
import { resolve } from 'path'
import { SRC_DIR } from './constants'

export function createBuildInput() {
  return {
    popup: resolve(SRC_DIR, 'pages/popup/index.html'),
    settings: resolve(SRC_DIR, 'pages/settings/index.html'),
    background: resolve(SRC_DIR, 'background/main.ts'),
    offscreen: resolve(SRC_DIR, 'offscreen/main.ts')
  }
}

export function createBuildOptions() {
  return {
    input: createBuildInput(),
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
