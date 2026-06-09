import { existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const frontendRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const manifestPath = join(frontendRoot, 'public/models/model.manifest.json')
const modelDir = join(frontendRoot, 'public/models/Xenova/multilingual-e5-small')

describe('embedding model manifest', () => {
  it('manifest 包含完整校验字段', async () => {
    const { loadManifest } = await import('../../../scripts/embedding-model-manifest.mjs')
    const manifest = await loadManifest()

    expect(manifest.modelId).toBe('Xenova/multilingual-e5-small')
    expect(manifest.files).toHaveLength(6)
    for (const file of manifest.files) {
      expect(file.path.length).toBeGreaterThan(0)
      expect(file.expectedBytes).toBeGreaterThan(0)
      expect(file.minBytes).toBeGreaterThan(0)
      expect(file.sha256).toMatch(/^[a-f0-9]{64}$/)
    }
    expect(manifest.onnxWasmAssets?.length).toBe(2)
  })

  it('本地模型通过完整性校验（模型已下载时）', async () => {
    if (!existsSync(manifestPath) || !existsSync(modelDir)) {
      return
    }

    const { loadManifest, validateModelFiles, getPublicModelDir } =
      await import('../../../scripts/embedding-model-manifest.mjs')
    const manifest = await loadManifest()
    const result = await validateModelFiles(getPublicModelDir(manifest), manifest, {
      verifySha256: true
    })

    expect(result.ok).toBe(true)
  })
})
