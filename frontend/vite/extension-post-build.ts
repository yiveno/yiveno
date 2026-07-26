/**
 * 扩展构建收尾：
 * 1. watch 互斥：上一轮收尾结束前不开始下一轮（防 HTML/CSS 哈希错位）
 * 2. content script IIFE 与平铺 HTML 串行
 * 3. watch 下仅在 content/ 相关文件变更时重打 content script（省一轮嵌套 viteBuild）
 * 4. 仅改 content/ 时主包可能不重建：watchChange 内防抖直接重打 IIFE
 */
import type { Plugin } from 'vite'
import { createRequire } from 'node:module'
import { buildContentScriptIifes } from './content-scripts-iife'

const require = createRequire(import.meta.url)
const { finalizeExtensionDist } = require('../scripts/clean-dist.cjs') as {
  finalizeExtensionDist: () => void
}

const isWatchBuild = process.argv.includes('--watch')
const CONTENT_REBUILD_DEBOUNCE_MS = 120

/** 上一轮 buildStart→closeBundle 全流程完成前，阻塞下一轮 watch 重建。 */
let buildGate: Promise<void> = Promise.resolve()
let releaseBuildGate: (() => void) | null = null

/** 是否需要重打 content script（首包必打；之后看 watchChange）。 */
let contentScriptsDirty = true

/** 仅 content 变更时的防抖重打包定时器。 */
let contentOnlyRebuildTimer: ReturnType<typeof setTimeout> | null = null
let contentOnlyRebuildRunning = false

function isContentScriptPath(id: string): boolean {
  const normalized = id.replace(/\\/g, '/')
  return normalized.includes('/src/content/') || normalized.includes('/content/selection-toolbar/')
}

async function rebuildContentScriptsNow(reason: string): Promise<void> {
  if (contentOnlyRebuildRunning) {
    contentScriptsDirty = true
    return
  }
  contentOnlyRebuildRunning = true
  try {
    await buildGate
    if (!contentScriptsDirty) {
      return
    }
    console.log(`[extension-post-build] 重打 content script（${reason}）`)
    await buildContentScriptIifes()
    contentScriptsDirty = false
  } finally {
    contentOnlyRebuildRunning = false
    // 运行期间又有变更：再排一轮
    if (contentScriptsDirty && isWatchBuild) {
      scheduleContentOnlyRebuild('dirty-while-running')
    }
  }
}

function scheduleContentOnlyRebuild(reason: string): void {
  if (!isWatchBuild) {
    return
  }
  if (contentOnlyRebuildTimer !== null) {
    clearTimeout(contentOnlyRebuildTimer)
  }
  contentOnlyRebuildTimer = setTimeout(() => {
    contentOnlyRebuildTimer = null
    void rebuildContentScriptsNow(reason).catch(error => {
      console.error('[extension-post-build] content script 重打失败', error)
    })
  }, CONTENT_REBUILD_DEBOUNCE_MS)
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
        // 主包未纳入 content 入口时，仅改划词脚本不会触发 closeBundle；此处直接重打
        scheduleContentOnlyRebuild('watchChange')
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
        if (contentOnlyRebuildTimer !== null) {
          clearTimeout(contentOnlyRebuildTimer)
          contentOnlyRebuildTimer = null
        }
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
