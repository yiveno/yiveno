#!/usr/bin/env bun
/**
 * 校验 dist 内 Embedding 模型与 ONNX WASM 资源（构建收尾）
 */

import { existsSync } from 'node:fs'
import {
  DIST_ROOT,
  formatValidationFailures,
  getDistModelDir,
  loadManifest,
  validateModelFiles,
  validateOnnxWasmAssets
} from './embedding-model-manifest.mjs'

async function main() {
  if (!existsSync(DIST_ROOT)) {
    console.error(`❌ dist 目录不存在: ${DIST_ROOT}`)
    process.exit(1)
  }

  const manifest = await loadManifest()
  const distModelDir = getDistModelDir(manifest)

  const modelResult = await validateModelFiles(distModelDir, manifest, {
    verifySha256: true,
    label: 'dist/models'
  })

  const wasmResult = await validateOnnxWasmAssets(DIST_ROOT, manifest)

  const failures = [...modelResult.failures, ...wasmResult.failures]

  if (failures.length > 0) {
    console.error('❌ dist Embedding 产物校验失败:')
    console.error(formatValidationFailures(failures))
    process.exit(1)
  }

  console.log('✅ dist Embedding 模型 + ONNX WASM 校验通过')
}

main().catch(error => {
  console.error('❌ dist Embedding 校验失败:', error)
  process.exit(1)
})
