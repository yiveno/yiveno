/**
 * Vite SSR 加载带 `@/` 的 user-sim 真实轨 CLI；替身掉 auth / embed / outcome / quota。
 *
 * TLS：与 worker `dev` / retrieval-ablation:real 同源，默认注入系统 CA，
 * 否则本机 Supabase admin mint 会在 generateLink 阶段报证书校验失败。
 */
import { createServer } from 'vite'
import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const root = resolve(scriptDir, '..')
const stubs = resolve(root, 'tests/eval/behavior-ablation/stubs')

if (!process.env.NODE_EXTRA_CA_CERTS) {
  const systemCa = '/etc/ssl/cert.pem'
  if (existsSync(systemCa)) {
    process.env.NODE_EXTRA_CA_CERTS = systemCa
  }
}

const server = await createServer({
  configFile: false,
  root,
  resolve: {
    alias: [
      {
        find: '@/infrastructure/identity/worker-api-access-token',
        replacement: resolve(stubs, 'eval-auth-token.ts')
      },
      {
        find: '@/infrastructure/ai/embed-api-client',
        replacement: resolve(stubs, 'eval-embed-api.ts')
      },
      {
        find: '@/infrastructure/ai/hosted-quota-api-client',
        replacement: resolve(stubs, 'eval-hosted-quota.ts')
      },
      {
        find: '@/infrastructure/storage/recall-outcome-pairs-storage',
        replacement: resolve(stubs, 'eval-outcome-pairs.ts')
      },
      { find: '@', replacement: resolve(root, 'src') }
    ]
  },
  server: { middlewareMode: true },
  appType: 'custom'
})

try {
  const mod = await server.ssrLoadModule('/scripts/user-sim-dreaming-run.ts')
  await mod.runUserSimDreamingCli()
} catch (error) {
  console.error(error instanceof Error ? error.stack || error.message : error)
  process.exitCode = 1
} finally {
  await server.close()
}

if (process.exitCode && process.exitCode !== 0) {
  process.exit(process.exitCode)
}
