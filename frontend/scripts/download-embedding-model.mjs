#!/usr/bin/env bun
/**
 * 下载 Embedding ONNX 模型到 frontend/public/models/
 */

import { mkdir, unlink, writeFile } from 'node:fs/promises'
import { createWriteStream, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { pipeline } from 'node:stream/promises'
import {
  formatValidationFailures,
  getPublicModelDir,
  isModelReadyQuick,
  loadManifest,
  sha256File,
  validateFileSpec,
  validateModelFiles
} from './embedding-model-manifest.mjs'

/** 镜像列表：优先环境变量，其次国内镜像，最后官方 Hub */
const HF_MIRRORS = [
  ...new Set(
    [process.env.HF_ENDPOINT, 'https://hf-mirror.com', 'https://huggingface.co']
      .filter(Boolean)
      .map(endpoint => String(endpoint).replace(/\/$/, ''))
  )
]

const DOWNLOAD_TIMEOUT_MS = 10 * 60 * 1000

async function removeIfExists(filePath) {
  if (existsSync(filePath)) {
    await unlink(filePath)
  }
}

async function downloadFile(url, destPath) {
  await mkdir(dirname(destPath), { recursive: true })

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS)

  try {
    const response = await fetch(url, { signal: controller.signal })
    if (!response.ok || !response.body) {
      throw new Error(`HTTP ${response.status}`)
    }
    await pipeline(response.body, createWriteStream(destPath))
  } finally {
    clearTimeout(timer)
  }
}

async function downloadWithMirrors(modelId, relativePath, destPath) {
  let lastError

  for (const base of HF_MIRRORS) {
    const url = `${base}/${modelId}/resolve/main/${relativePath}`
    try {
      console.log(`⬇️  下载 ${relativePath}（${base}）...`)
      await removeIfExists(destPath)
      await downloadFile(url, destPath)
      return
    } catch (error) {
      lastError = error
      await removeIfExists(destPath)
      const message = error instanceof Error ? error.message : String(error)
      console.warn(`   ⚠️ 镜像失败 ${base}: ${message}`)
    }
  }

  throw lastError ?? new Error(`所有镜像均无法下载 ${relativePath}`)
}

async function main() {
  const manifest = await loadManifest()
  const modelId = manifest.modelId
  const modelDir = getPublicModelDir(manifest)

  if (await isModelReadyQuick(modelDir, manifest)) {
    const full = await validateModelFiles(modelDir, manifest, {
      verifySha256: true,
      label: 'public/models'
    })
    if (full.ok) {
      console.log(`✅ Embedding 模型已就绪且校验通过，跳过下载 (${modelId})`)
      return
    }
    console.warn('⚠️ 模型文件存在但完整性校验失败，将重新下载缺失/损坏文件')
    console.warn(formatValidationFailures(full.failures))
  }

  let downloaded = 0
  let skipped = 0

  for (const file of manifest.files) {
    const dest = join(modelDir, file.path)
    const issues = await validateFileSpec(dest, file, { verifySha256: true })
    if (issues.length === 0) {
      skipped += 1
      continue
    }

    await downloadWithMirrors(modelId, file.path, dest)

    const hash = await sha256File(dest)
    if (file.sha256 && hash !== file.sha256) {
      await removeIfExists(dest)
      throw new Error(`${file.path} SHA256 校验失败: ${hash}`)
    }

    downloaded += 1
  }

  const finalCheck = await validateModelFiles(modelDir, manifest, {
    verifySha256: true,
    label: 'public/models'
  })
  if (!finalCheck.ok) {
    throw new Error(`下载完成后校验仍失败:\n${formatValidationFailures(finalCheck.failures)}`)
  }

  await writeFile(
    join(modelDir, '.model-ready.json'),
    JSON.stringify(
      {
        modelId,
        verifiedAt: new Date().toISOString(),
        mirrors: HF_MIRRORS,
        files: manifest.files.map(file => ({
          path: file.path,
          expectedBytes: file.expectedBytes,
          sha256: file.sha256
        }))
      },
      null,
      2
    )
  )

  console.log(
    `✅ Embedding 模型就绪 (${modelId}): 新下载 ${downloaded} 个文件, 跳过 ${skipped} 个`
  )
}

main().catch(error => {
  console.error('❌ Embedding 模型下载失败:', error)
  console.error('')
  console.error('可尝试手动指定镜像后重试：')
  console.error('  HF_ENDPOINT=https://hf-mirror.com bun run download:embedding-model')
  process.exit(1)
})
