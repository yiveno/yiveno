/**
 * 扩展运行时 Embedding 资源健康检查
 *
 * 通过 chrome-extension:// URL 读取打包的 model.manifest.json 与模型文件，
 * 校验大小；小文件额外校验 SHA256。
 */

import { EMBEDDING_MODEL_ID } from '@/infrastructure/embedding/embedding-model-config'
import { logger } from '@/infrastructure/logging/logger'

const LOG_TAG = 'EmbeddingBundleHealth'

/** 超过此大小的文件仅校验字节数（避免启动时对大 ONNX 做 SHA256） */
const SHA256_MAX_BYTES = 5 * 1024 * 1024

interface ManifestFileSpec {
  path: string
  expectedBytes: number
  minBytes: number
  sha256?: string
}

interface EmbeddingModelManifest {
  modelId: string
  files: ManifestFileSpec[]
  onnxWasmAssets?: Array<{ path: string; minBytes: number; expectedBytes?: number }>
}

export interface EmbeddingHealthResult {
  ok: boolean
  issues: string[]
}

function extensionUrl(relativePath: string): string {
  if (typeof chrome === 'undefined' || !chrome.runtime?.getURL) {
    throw new Error('Embedding 健康检查需要在扩展环境中运行')
  }
  return chrome.runtime.getURL(relativePath)
}

async function sha256Blob(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer()
  const hash = await crypto.subtle.digest('SHA-256', buffer)
  return Array.from(new Uint8Array(hash))
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('')
}

async function verifyRemoteFile(
  url: string,
  spec: { path: string; expectedBytes?: number; minBytes?: number; sha256?: string }
): Promise<string[]> {
  const issues: string[] = []

  let response: Response
  try {
    response = await fetch(url)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    issues.push(`${spec.path}: 读取失败 (${message})`)
    return issues
  }

  if (!response.ok) {
    issues.push(`${spec.path}: HTTP ${response.status}`)
    return issues
  }

  const blob = await response.blob()

  if (spec.minBytes !== undefined && blob.size < spec.minBytes) {
    issues.push(`${spec.path}: 过小 ${blob.size} < ${spec.minBytes}`)
  }

  if (spec.expectedBytes !== undefined && blob.size !== spec.expectedBytes) {
    issues.push(`${spec.path}: 大小不符 ${blob.size} ≠ ${spec.expectedBytes}`)
  }

  if (spec.sha256 && blob.size <= SHA256_MAX_BYTES) {
    const hash = await sha256Blob(blob)
    if (hash !== spec.sha256) {
      issues.push(`${spec.path}: SHA256 不符`)
    }
  }

  return issues
}

/**
 * 校验扩展包内 Embedding 模型与 ONNX WASM 是否完整
 */
export async function verifyEmbeddingBundleHealth(): Promise<EmbeddingHealthResult> {
  const issues: string[] = []

  let manifest: EmbeddingModelManifest
  try {
    const manifestUrl = extensionUrl('models/model.manifest.json')
    const response = await fetch(manifestUrl)
    if (!response.ok) {
      return { ok: false, issues: [`model.manifest.json: HTTP ${response.status}`] }
    }
    manifest = (await response.json()) as EmbeddingModelManifest
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return { ok: false, issues: [`无法读取 model.manifest.json: ${message}`] }
  }

  if (manifest.modelId !== EMBEDDING_MODEL_ID) {
    issues.push(`modelId 不匹配: ${manifest.modelId} ≠ ${EMBEDDING_MODEL_ID}`)
  }

  const modelBase = extensionUrl(`models/${manifest.modelId}/`)

  for (const file of manifest.files) {
    const fileIssues = await verifyRemoteFile(`${modelBase}${file.path}`, file)
    issues.push(...fileIssues)
  }

  for (const asset of manifest.onnxWasmAssets ?? []) {
    const fileIssues = await verifyRemoteFile(extensionUrl(asset.path), asset)
    issues.push(...fileIssues)
  }

  if (issues.length > 0) {
    logger.error(LOG_TAG, 'Embedding 资源完整性校验失败', { issues })
  } else {
    logger.info(LOG_TAG, 'Embedding 资源完整性校验通过')
  }

  return { ok: issues.length === 0, issues }
}

/**
 * 预热 Embedding 管道（先校验资源，再加载模型）
 */
export async function warmupEmbeddingEngine(): Promise<EmbeddingHealthResult> {
  const health = await verifyEmbeddingBundleHealth()
  if (!health.ok) {
    return health
  }

  const { createLocalEmbeddingPipeline } =
    await import('@/infrastructure/embedding/onnx-embedding-pipeline')
  await createLocalEmbeddingPipeline()
  logger.info(LOG_TAG, 'Embedding 引擎预热完成')
  return health
}
