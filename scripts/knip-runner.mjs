/**
 * Knip 运行器（隔离安装 + 持久缓存）
 *
 * 根 monorepo 通过 resolutions 锁定 zod@3，与 knip 依赖的 zod/mini 不兼容；
 * 因此在 .cache/knip-runner 内独立安装 knip，**不要**把 knip 装进根 node_modules
 *（根 `bunx knip` 会踩坏掉的 zod）。
 *
 * 版本写在根 package.json 的 `yiveno.knip`（非 devDependencies）。
 * 对齐条件（满足后可删本脚本、改回根依赖）：根目录 `bunx knip -D .` 不再报
 * `Package subpath './mini' is not defined`。
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const cacheDir = join(root, '.cache', 'knip-runner')
const versionFile = join(cacheDir, '.knip-version')
const knipBin = join(cacheDir, 'node_modules', 'knip', 'bin', 'knip.js')

const rootPkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const knipSpec =
  (typeof rootPkg.yiveno?.knip === 'string' && rootPkg.yiveno.knip) ||
  rootPkg.devDependencies?.knip ||
  '^6.16.1'

function ensureKnipCache() {
  const versionMatch = existsSync(versionFile) && readFileSync(versionFile, 'utf8') === knipSpec
  const knipReady = existsSync(knipBin)

  if (versionMatch && knipReady) return

  mkdirSync(cacheDir, { recursive: true })
  writeFileSync(
    join(cacheDir, 'package.json'),
    JSON.stringify(
      {
        name: 'knip-runner',
        private: true,
        type: 'module',
        devDependencies: { knip: knipSpec }
      },
      null,
      2
    )
  )
  writeFileSync(versionFile, knipSpec)

  console.log(`[knip-runner] 隔离安装 knip@${knipSpec} → ${cacheDir}`)
  const install = spawnSync('bun', ['install'], { cwd: cacheDir, stdio: 'inherit' })
  if (install.status !== 0) process.exit(install.status ?? 1)
}

ensureKnipCache()

// 直接跑隔离目录里的 bin，避免 bunx 解析到根 node_modules 的坏 knip
const run = spawnSync(process.execPath, [knipBin, '-D', root, ...process.argv.slice(2)], {
  cwd: cacheDir,
  stdio: 'inherit',
  env: {
    ...process.env,
    // 隔离目录内解析依赖，勿回落到仓库根 node_modules
    NODE_PATH: join(cacheDir, 'node_modules')
  }
})

process.exit(run.status ?? 1)
