/** 将 content script 打成单文件 IIFE（无 ESM import），供 MV3 content_scripts 加载。 */
import { build as viteBuild, type Plugin } from 'vite'
import { resolve } from 'path'
import { DEBUG_MODE, OUT_DIR, ROOT_DIR, SRC_DIR } from './constants'

const CONTENT_SCRIPT_ENTRIES = [
  {
    name: 'content-selection-toolbar',
    entry: resolve(SRC_DIR, 'content/selection-toolbar/main.ts')
  }
] as const

/**
 * 主构建结束后单独打包 content script。
 * 经典 content_scripts 不能加载带 import 的 ESM chunk。
 */
export function contentScriptsIifePlugin(): Plugin {
  let building = false

  return {
    name: 'yiveno-content-scripts-iife',
    apply: 'build',
    async closeBundle() {
      if (building) {
        return
      }
      building = true

      try {
        for (const script of CONTENT_SCRIPT_ENTRIES) {
          await viteBuild({
            configFile: false,
            root: ROOT_DIR,
            logLevel: 'warn',
            resolve: {
              alias: {
                '@': SRC_DIR
              }
            },
            define: {
              __VUE_OPTIONS_API__: false,
              __VUE_PROD_DEVTOOLS__: false
            },
            build: {
              outDir: OUT_DIR,
              emptyOutDir: false,
              sourcemap: DEBUG_MODE,
              target: ['chrome116', 'es2022'],
              minify: 'terser',
              lib: {
                entry: script.entry,
                name: toIifeGlobalName(script.name),
                formats: ['iife'],
                fileName: () => `${script.name}.js`
              },
              rolldownOptions: {
                output: {
                  inlineDynamicImports: true,
                  entryFileNames: `${script.name}.js`
                }
              }
            }
          })
        }
      } finally {
        building = false
      }
    }
  }
}

function toIifeGlobalName(entryName: string): string {
  return entryName
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map(part => part[0]!.toUpperCase() + part.slice(1))
    .join('')
}
