#!/usr/bin/env bun
/**
 * Embedding 模型清单与完整性校验（构建脚本共用）
 */

import { createHash } from 'node:crypto'
import { createReadStream, existsSync } from 'node:fs'
import { readFile, stat } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

/** frontend 根目录 */
export const FRONTEND_ROOT = resolve(__dirname, '..')

/** monorepo dist 目录 */
export const DIST_ROOT = resolve(FRONTEND_ROOT, '..', 'dist')

export const MANIFEST_PATH = join(FRONTEND_ROOT, 'public/models/model.manifest.json')

/**
 * @typedef {Object} ManifestFileSpec
 * @property {string} path
 * @property {number} expectedBytes
 * @property {number} minBytes
 * @property {string} [sha256]
 */

/**
 * @typedef {Object} EmbeddingModelManifest
 * @property {string} modelId
 * @property {string} dtype
 * @property {string} onnxFile
 * @property {ManifestFileSpec[]} files
 * @property {ManifestFileSpec[]} onnxWasmAssets
 */

/** @returns {Promise<EmbeddingModelManifest>} */
export async function loadManifest() {
  const raw = await readFile(MANIFEST_PATH, 'utf8')
  return JSON.parse(raw)
}

/** @param {EmbeddingModelManifest} manifest */
export function getPublicModelDir(manifest) {
  return join(FRONTEND_ROOT, 'public/models', manifest.modelId)
}

/** @param {EmbeddingModelManifest} manifest */
export function getDistModelDir(manifest) {
  return join(DIST_ROOT, 'models', manifest.modelId)
}

/**
 * 流式计算 SHA256（适用于大文件）
 * @param {string} filePath
 */
export async function sha256File(filePath) {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256')
    const stream = createReadStream(filePath)
    stream.on('data', chunk => hash.update(chunk))
    stream.on('error', reject)
    stream.on('end', () => resolve(hash.digest('hex')))
  })
}

/**
 * @param {string} filePath
 * @param {ManifestFileSpec} spec
 * @param {{ verifySha256?: boolean }} [options]
 */
export async function validateFileSpec(filePath, spec, options = {}) {
  const { verifySha256 = true } = options
  const issues = []

  if (!existsSync(filePath)) {
    issues.push('文件不存在')
    return issues
  }

  const info = await stat(filePath)
  if (!info.isFile()) {
    issues.push('不是普通文件')
    return issues
  }

  if (spec.minBytes !== undefined && info.size < spec.minBytes) {
    issues.push(`过小: ${info.size} < ${spec.minBytes}`)
  }

  if (spec.expectedBytes !== undefined && info.size !== spec.expectedBytes) {
    issues.push(`大小不符: ${info.size} ≠ ${spec.expectedBytes}`)
  }

  if (verifySha256 && spec.sha256) {
    const hash = await sha256File(filePath)
    if (hash !== spec.sha256) {
      issues.push(`SHA256 不符: ${hash} ≠ ${spec.sha256}`)
    }
  }

  return issues
}

/**
 * 校验模型目录下所有清单文件
 * @param {string} modelDir
 * @param {EmbeddingModelManifest} manifest
 * @param {{ verifySha256?: boolean, label?: string }} [options]
 */
export async function validateModelFiles(modelDir, manifest, options = {}) {
  const { verifySha256 = true, label = modelDir } = options
  /** @type {Array<{ scope: string, file: string, issues: string[] }>} */
  const failures = []

  for (const file of manifest.files) {
    const dest = join(modelDir, file.path)
    const issues = await validateFileSpec(dest, file, { verifySha256 })
    if (issues.length > 0) {
      failures.push({ scope: label, file: file.path, issues })
    }
  }

  return {
    ok: failures.length === 0,
    failures
  }
}

/**
 * 校验 dist 内 ONNX Runtime WASM 资源
 * @param {string} distDir
 * @param {EmbeddingModelManifest} manifest
 */
export async function validateOnnxWasmAssets(distDir, manifest) {
  /** @type {Array<{ scope: string, file: string, issues: string[] }>} */
  const failures = []

  for (const asset of manifest.onnxWasmAssets ?? []) {
    const dest = join(distDir, asset.path)
    const issues = await validateFileSpec(dest, asset, { verifySha256: false })
    if (issues.length > 0) {
      failures.push({ scope: join(distDir, 'onnx-wasm'), file: asset.path, issues })
    }
  }

  return {
    ok: failures.length === 0,
    failures
  }
}

/**
 * 校验 public 源模型 + dist 产物
 * @param {{ verifySha256?: boolean }} [options]
 */
export async function validateEmbeddingBundle(options = {}) {
  const { verifySha256 = true } = options
  const manifest = await loadManifest()

  const publicModel = await validateModelFiles(getPublicModelDir(manifest), manifest, {
    verifySha256,
    label: 'public/models'
  })

  const distModel = await validateModelFiles(getDistModelDir(manifest), manifest, {
    verifySha256,
    label: 'dist/models'
  })

  const distWasm = await validateOnnxWasmAssets(DIST_ROOT, manifest)

  const failures = [...publicModel.failures, ...distModel.failures, ...distWasm.failures]

  return {
    ok: failures.length === 0,
    manifest,
    failures
  }
}

/** @param {Array<{ scope: string, file: string, issues: string[] }>} failures */
export function formatValidationFailures(failures) {
  return failures
    .map(item => `  [${item.scope}] ${item.file}: ${item.issues.join('; ')}`)
    .join('\n')
}

/**
 * 快速检查模型是否就绪（仅大小，不计算哈希）
 * @param {string} modelDir
 * @param {EmbeddingModelManifest} manifest
 */
export async function isModelReadyQuick(modelDir, manifest) {
  for (const file of manifest.files) {
    const dest = join(modelDir, file.path)
    if (!existsSync(dest)) return false
    const info = await stat(dest)
    if (!info.isFile() || info.size < file.minBytes) return false
  }
  return true
}
