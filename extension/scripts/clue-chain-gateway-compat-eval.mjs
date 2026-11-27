/**
 * Vite SSR 加载 gateway-compat Stage 1 eval CLI。
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
  const mod = await server.ssrLoadModule('/scripts/clue-chain-gateway-compat-eval.ts')
  await mod.runClueChainGatewayCompatEval()
} catch (error) {
  console.error(error instanceof Error ? error.stack || error.message : error)
  process.exitCode = 1
} finally {
  await server.close()
}

if (process.exitCode && process.exitCode !== 0) {
  process.exit(process.exitCode)
}
