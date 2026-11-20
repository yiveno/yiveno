/**
 * 用 Vite SSR 加载带 `@/` 的 TS CLI（Bun 原生不解析 paths）。
 * TLS：与 recall-ablation-audit.mjs 同源，默认注入系统 CA。
 */
import { createServer } from 'vite'
import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const root = resolve(scriptDir, '..')

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
    alias: {
      '@': resolve(root, 'src')
    }
  },
  server: { middlewareMode: true },
  appType: 'custom'
})

try {
  const mod = await server.ssrLoadModule('/scripts/recall-prototype-minimal.ts')
  await mod.runRecallPrototypeMinimal()
} catch (error) {
  console.error(error instanceof Error ? error.stack || error.message : error)
  process.exitCode = 1
} finally {
  await server.close()
}

if (process.exitCode && process.exitCode !== 0) {
  process.exit(process.exitCode)
}
