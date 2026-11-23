/**
 * GLM-5.3 Flash + Perplexity Orchestrator 对照入口。
 * 加载 recall-prototype-minimal.ts 的 runGlmOrchestratorEval（同口径 prompt/评分/runLeg）。
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
  await mod.runGlmOrchestratorEval()
} catch (error) {
  console.error(error instanceof Error ? error.stack || error.message : error)
  process.exitCode = 1
} finally {
  await server.close()
}

if (process.exitCode && process.exitCode !== 0) {
  process.exit(process.exitCode)
}
