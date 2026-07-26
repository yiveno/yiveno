/** 将 content script 打成单文件 IIFE（无 ESM import），供 MV3 content_scripts 加载。 */
import { build as viteBuild } from 'vite'
import { resolve } from 'path'
import { DEBUG_MODE, OUT_DIR, ROOT_DIR, SRC_DIR } from './constants'

const CONTENT_SCRIPT_ENTRIES = [
  {
    name: 'content-selection-toolbar',
    entry: resolve(SRC_DIR, 'content/selection-toolbar/main.ts')
  }
] as const

export { CONTENT_SCRIPT_ENTRIES }

function toIifeGlobalName(entryName: string): string {
  return entryName
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map(part => part[0]!.toUpperCase() + part.slice(1))
    .join('')
}

/**
 * 打包全部 content script IIFE 到 dist 根目录。
 * 由 extension-post-build 在主包 closeBundle 内串行调用，避免与 watch 下一轮竞态。
 */
export async function buildContentScriptIifes(): Promise<void> {
  const isWatchBuild = process.argv.includes('--watch')

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
        // watch 不 minify：与主包一致，加快迭代
        minify: isWatchBuild ? false : 'terser',
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
}
