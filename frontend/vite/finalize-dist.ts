/** 构建结束后整理 Chrome 扩展 dist 布局。 */
import type { Plugin } from 'vite'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { finalizeExtensionDist } = require('../scripts/clean-dist.cjs') as {
  finalizeExtensionDist: () => void
}

/** 在 Vite build 完成时平铺 popup/settings HTML。 */
export function finalizeExtensionDistPlugin(): Plugin {
  return {
    name: 'yiveno-finalize-extension-dist',
    closeBundle() {
      finalizeExtensionDist()
    }
  }
}
