/**
 * 用 Vite SSR 加载带 `@/` 的 TS CLI（Bun 原生不解析 paths）。
 */
import { createServer } from 'vite'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const root = resolve(scriptDir, '..')

const server = await createServer({
  configFile: false,
  root,
  resolve: {
    alias: {
      '@': resolve(root, 'src')
    }
  },
  server: { middlewareMode: true },
  appType: 'custom'
})

try {
  const mod = await server.ssrLoadModule('/scripts/run-parse-gold-llm.ts')
  await mod.runParseGoldLlmCli()
} catch (error) {
  console.error(error instanceof Error ? error.stack || error.message : error)
  process.exitCode = 1
} finally {
  await server.close()
}

if (process.exitCode && process.exitCode !== 0) {
  process.exit(process.exitCode)
}
