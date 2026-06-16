/**
 * Knip 运行器（隔离安装 + 持久缓存）
 *
 * 根 monorepo 通过 resolutions 锁定 zod@3，与 knip 依赖的 zod/mini 不兼容；
 * 因此在 .cache/knip-runner 内独立安装 knip，版本与根 package.json devDependencies 同步。
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const cacheDir = join(root, '.cache', 'knip-runner')
const versionFile = join(cacheDir, '.knip-version')

const rootPkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const knipSpec = rootPkg.devDependencies?.knip ?? '^6.16.1'

function ensureKnipCache() {
  const versionMatch = existsSync(versionFile) && readFileSync(versionFile, 'utf8') === knipSpec
  const knipReady = existsSync(join(cacheDir, 'node_modules', 'knip', 'package.json'))

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

  const install = spawnSync('bun', ['install'], { cwd: cacheDir, stdio: 'inherit' })
  if (install.status !== 0) process.exit(install.status ?? 1)
}

ensureKnipCache()

const run = spawnSync('bunx', ['knip', '-D', root, ...process.argv.slice(2)], {
  cwd: cacheDir,
  stdio: 'inherit'
})

process.exit(run.status ?? 1)
