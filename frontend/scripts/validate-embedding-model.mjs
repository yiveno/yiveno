#!/usr/bin/env bun
/**
 * 校验 public/models 内 Embedding 模型完整性（大小 + SHA256）
 */

import {
  formatValidationFailures,
  getPublicModelDir,
  loadManifest,
  validateModelFiles
} from './embedding-model-manifest.mjs'

async function main() {
  const manifest = await loadManifest()
  const modelDir = getPublicModelDir(manifest)

  const result = await validateModelFiles(modelDir, manifest, {
    verifySha256: true,
    label: 'public/models'
  })

  if (!result.ok) {
    console.error('❌ Embedding 模型完整性校验失败:')
    console.error(formatValidationFailures(result.failures))
    console.error('')
    console.error('请运行: cd frontend && bun run download:embedding-model')
    console.error('国内网络: HF_ENDPOINT=https://hf-mirror.com bun run download:embedding-model')
    process.exit(1)
  }

  console.log(`✅ Embedding 模型完整性校验通过: ${manifest.modelId}`)
}

main().catch(error => {
  console.error('❌ Embedding 模型校验失败:', error)
  process.exit(1)
})
