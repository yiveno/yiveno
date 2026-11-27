/**
 * Vite SSR 加载带 `@/` 的 TS CLI；替身掉 auth / embed / outcome / quota。
 */
import { createServer } from 'vite'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const root = resolve(scriptDir, '..')
const stubs = resolve(root, 'tests/eval/behavior-ablation/stubs')

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
  const mod = await server.ssrLoadModule('/scripts/behavior-ablation-run.ts')
  await mod.runBehaviorAblationCli()
} catch (error) {
  console.error(error instanceof Error ? error.stack || error.message : error)
  process.exitCode = 1
} finally {
  await server.close()
}

if (process.exitCode && process.exitCode !== 0) {
  process.exit(process.exitCode)
}
