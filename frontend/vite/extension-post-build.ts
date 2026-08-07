/**
 * 扩展构建收尾：
 * 1. watch 互斥：上一轮收尾结束前不开始下一轮（防 HTML/CSS 哈希错位）
 * 2. content script IIFE 与平铺 HTML 串行
 * 3. watch 下主包每次 closeBundle 都重打 content（shared core/infra 变更也会进 IIFE）
 * 4. content/ 不在主包 module graph：addWatchFile 纳入监听；仅改划词时也能触发重建
 */
import type { Plugin } from 'vite'
import { createRequire } from 'node:module'
import { readdirSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import { SRC_DIR } from './constants'
import { buildContentScriptIifes, CONTENT_SCRIPT_ENTRIES } from './content-scripts-iife'

const require = createRequire(import.meta.url)
const { finalizeExtensionDist } = require('../scripts/clean-dist.cjs') as {
  finalizeExtensionDist: () => void
}

const isWatchBuild = process.argv.includes('--watch')
const CONTENT_REBUILD_DEBOUNCE_MS = 150

/** 上一轮 buildStart→closeBundle 全流程完成前，阻塞下一轮 watch 重建。 */
let buildGate: Promise<void> = Promise.resolve()
let releaseBuildGate: (() => void) | null = null

/** 是否需要重打 content script。 */
let contentScriptsDirty = true

/** 仅 content 变更时的防抖重打包定时器。 */
let contentOnlyRebuildTimer: ReturnType<typeof setTimeout> | null = null
let contentOnlyRebuildRunning = false

function isContentScriptPath(id: string): boolean {
  const normalized = id.replace(/\\/g, '/')
  return normalized.includes('/src/content/') || normalized.includes('/content/selection-toolbar/')
}

function listSourceFilesRecursive(dir: string, out: string[] = []): string[] {
  let entries: string[]
  try {
    entries = readdirSync(dir)
  } catch {
    return out
  }
  for (const name of entries) {
    const fullPath = resolve(dir, name)
    let stat
    try {
      stat = statSync(fullPath)
    } catch {
      continue
    }
    if (stat.isDirectory()) {
      listSourceFilesRecursive(fullPath, out)
      continue
    }
    if (/\.(ts|tsx|css)$/.test(name)) {
      out.push(fullPath)
    }
  }
  return out
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
    if (contentScriptsDirty && isWatchBuild) {
      scheduleContentOnlyRebuild('dirty-while-running')
    }
  }
}

function scheduleContentOnlyRebuild(reason: string): void {
  if (!isWatchBuild) {
    return
  }
  contentScriptsDirty = true
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

      contentScriptsDirty = true

      if (isWatchBuild) {
        // 划词入口不在主包 graph：显式加入 watch，否则改 content/ 不会触发重建
        for (const script of CONTENT_SCRIPT_ENTRIES) {
          this.addWatchFile(script.entry)
        }
        for (const file of listSourceFilesRecursive(resolve(SRC_DIR, 'content'))) {
          this.addWatchFile(file)
        }
      }
    },
    watchChange(id) {
      if (isContentScriptPath(id)) {
        // 主包未纳入 content 时，仅改划词不会走到完整依赖图；防抖直接重打 IIFE
        scheduleContentOnlyRebuild('watchChange')
      }
    },
    buildEnd(error) {
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
        // watch：每次主包收尾都重打 content，避免只改了 core/infra 而 IIFE 仍是旧的
        if (contentScriptsDirty || isWatchBuild) {
          console.log(
            `[extension-post-build] 重打 content script（closeBundle${isWatchBuild ? '/watch' : ''}）`
          )
          await buildContentScriptIifes()
          contentScriptsDirty = false
        }
        finalizeExtensionDist()
        // MV3 无真 HMR：watch 重建后需在 chrome://extensions 点刷新（或重新加载 unpacked）
        if (isWatchBuild) {
          console.log(
            '[extension-post-build] dist 已更新 → chrome://extensions 刷新本扩展后验证（MV3 无热替换）'
          )
        }
      } finally {
        releaseBuildGate?.()
        releaseBuildGate = null
      }
    }
  }
}
