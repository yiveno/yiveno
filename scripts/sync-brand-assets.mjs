#!/usr/bin/env bun
/**
 * 从 docs/design/brand-assets/ 同步到扩展/官网运行时目录。
 *
 *   bun run sync:brand-assets        # 写入
 *   bun run sync:brand-assets --check  # 仅校验，漂移则 exit 1
 */
import { createHash } from 'node:crypto'
import { copyFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = join(root, 'docs/design/brand-assets')

/** 母本相对路径 → 仓库内运行时目标（相对 root） */
const MAPPINGS = [
  ['chrome-extension/icon-16.png', 'extension/public/images/icon16.png'],
  ['chrome-extension/icon-32.png', 'extension/public/images/icon32.png'],
  ['chrome-extension/icon-48.png', 'extension/public/images/icon48.png'],
  ['chrome-extension/icon-128.png', 'extension/public/images/icon128.png'],
  ['logo/yiveno-primary.svg', 'extension/public/images/logo-mark.svg'],
  ['logo/yiveno-primary.svg', 'website/public/images/logo-mark.svg'],
  ['logo/logo-on-light.svg', 'extension/public/images/logo-mark-mono-light.svg'],
  ['logo/logo-on-dark.svg', 'extension/public/images/logo-mark-mono-dark.svg'],
  ['logo/logo-on-dark.svg', 'website/public/images/logo-mark-on-dark.svg'],
  ['chrome-extension/favicon.ico', 'website/public/favicon.ico'],
  ['applications/yiveno-product-hero.jpg', 'website/public/og-image.jpg']
]

function sha256(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex')
}

function syncBrandAssets(checkOnly) {
  const drift = []

  for (const [relSrc, relDest] of MAPPINGS) {
    const srcPath = join(SRC, relSrc)
    const destPath = join(root, relDest)

    if (!existsSync(srcPath)) {
      console.error(`❌ 母本缺失: ${relSrc}`)
      process.exit(1)
    }

    mkdirSync(dirname(destPath), { recursive: true })

    const needsCopy = !existsSync(destPath) || sha256(srcPath) !== sha256(destPath)
    if (!needsCopy) {
      continue
    }

    if (checkOnly) {
      drift.push(`${relSrc} → ${relDest}`)
      continue
    }

    copyFileSync(srcPath, destPath)
    console.log(`✅ ${relDest} ← ${relSrc}`)
  }

  if (checkOnly) {
    if (drift.length > 0) {
      console.error('❌ 品牌运行时与 brand-assets 不同步：')
      for (const line of drift) {
        console.error(`  - ${line}`)
      }
      console.error('\n修复: bun run sync:brand-assets')
      process.exit(1)
    }
    console.log('✅ brand-assets 已与 extension/public、website/public 同步')
    return
  }

  console.log('✅ sync:brand-assets 完成（详见 brand-asset-release-checklist.md）')
}

const checkOnly = process.argv.includes('--check')
syncBrandAssets(checkOnly)
