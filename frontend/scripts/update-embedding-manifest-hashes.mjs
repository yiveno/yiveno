#!/usr/bin/env bun
/**
 * 扫描已下载的 Embedding 模型文件，回填 model.manifest.json 的 expectedBytes 与 sha256
 */

import { writeFile } from 'node:fs/promises'
import { stat } from 'node:fs/promises'
import { join } from 'node:path'
import {
  getPublicModelDir,
  loadManifest,
  MANIFEST_PATH,
  sha256File
} from './embedding-model-manifest.mjs'

async function main() {
  const manifest = await loadManifest()
  const modelDir = getPublicModelDir(manifest)

  const updatedFiles = []
  for (const file of manifest.files) {
    const filePath = join(modelDir, file.path)
    const info = await stat(filePath)
    const sha256 = await sha256File(filePath)
    updatedFiles.push({
      path: file.path,
      expectedBytes: info.size,
      minBytes: file.minBytes ?? Math.floor(info.size * 0.9),
      sha256
    })
    console.log(`✓ ${file.path}: ${info.size} bytes, sha256=${sha256.slice(0, 12)}…`)
  }

  const nextManifest = {
    ...manifest,
    files: updatedFiles
  }

  await writeFile(MANIFEST_PATH, `${JSON.stringify(nextManifest, null, 2)}\n`)
  console.log(`✅ 已更新 ${MANIFEST_PATH}`)
}

main().catch(error => {
  console.error('❌ 更新 manifest 哈希失败:', error)
  process.exit(1)
})
