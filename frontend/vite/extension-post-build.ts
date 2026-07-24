/**
 * 扩展构建收尾：
 * 1. watch 互斥：上一轮收尾结束前不开始下一轮（防 HTML/CSS 哈希错位）
 * 2. content script IIFE 与平铺 HTML 串行
 * 3. watch 下仅在 content/ 相关文件变更时重打 content script（省一轮嵌套 viteBuild）
 */
import type { Plugin } from 'vite'
import { createRequire } from 'node:module'
import { buildContentScriptIifes } from './content-scripts-iife'

const require = createRequire(import.meta.url)
const { finalizeExtensionDist } = require('../scripts/clean-dist.cjs') as {
  finalizeExtensionDist: () => void
}

const isWatchBuild = process.argv.includes('--watch')

/** 上一轮 buildStart→closeBundle 全流程完成前，阻塞下一轮 watch 重建。 */
let buildGate: Promise<void> = Promise.resolve()
let releaseBuildGate: (() => void) | null = null

/** 是否需要重打 content script（首包必打；之后看 watchChange）。 */
let contentScriptsDirty = true

function isContentScriptPath(id: string): boolean {
  const normalized = id.replace(/\\/g, '/')
  return normalized.includes('/src/content/') || normalized.includes('/content/selection-toolbar/')
}

/** 主包结束后的扩展收尾（互斥 + 串行 + content 按需）。 */
export function extensionPostBuildPlugin(): Plugin {
  return {
    name: 'yiveno-extension-post-build',
    apply: 'build',
    enforce: 'pre',
    async buildStart() {
      await buildGate
      buildGate = new Promise<void>(resolve => {
        releaseBuildGate = resolve
      })
      if (!isWatchBuild) {
        contentScriptsDirty = true
      }
    },
    watchChange(id) {
      if (isContentScriptPath(id)) {
        contentScriptsDirty = true
      }
    },
    buildEnd(error) {
      // 打包失败时不会稳定走到 closeBundle，避免卡死下一轮 watch
      if (error) {
        releaseBuildGate?.()
        releaseBuildGate = null
      }
    },
    async closeBundle() {
      try {
        if (contentScriptsDirty) {
          await buildContentScriptIifes()
          contentScriptsDirty = false
        }
        finalizeExtensionDist()
      } finally {
        releaseBuildGate?.()
        releaseBuildGate = null
      }
    }
  }
}
