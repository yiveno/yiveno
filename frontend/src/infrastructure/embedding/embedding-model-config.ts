/**
 * Embedding 模型本地配置
 *
 * 模型文件打包在扩展 public/models/，构建时写入 dist/models/。
 * 运行时禁止 HuggingFace Hub；模型仅在构建阶段由 download-embedding-model 脚本拉取并打入扩展包。
 */

import type { env as TransformersEnv } from '@huggingface/transformers'

/** 本地打包的多语言 E5 检索模型（与 public/models 目录结构一致） */
export const EMBEDDING_MODEL_ID = 'Xenova/multilingual-e5-small' as const

/** 写入 IndexedDB 向量记录的模型版本键（变更时需全量 re-embed） */
export const EMBEDDING_VECTOR_MODEL_KEY = 'multilingual-e5-small-v1' as const

/** E5-small 输出向量维度 */
export const EMBEDDING_DIMENSIONS = 384

/** E5 检索模型：用户查询前缀 */
export const EMBEDDING_QUERY_PREFIX = 'query: '

/** E5 检索模型：文档/书签 passage 前缀 */
export const EMBEDDING_PASSAGE_PREFIX = 'passage: '

/**
 * 获取扩展内模型根目录 URL（必须以 / 结尾）
 */
export function getEmbeddingModelLocalRoot(): string {
  if (typeof chrome !== 'undefined' && chrome.runtime?.getURL) {
    return chrome.runtime.getURL('models/')
  }

  if (typeof location !== 'undefined' && location.protocol.startsWith('http')) {
    return `${location.origin}/models/`
  }

  return '/models/'
}

/**
 * 配置 Transformers.js 环境：仅使用扩展内本地模型与 WASM
 */
export function configureEmbeddingTransformersEnv(env: typeof TransformersEnv): void {
  env.allowLocalModels = true
  env.allowRemoteModels = false
  env.useBrowserCache = false
  env.localModelPath = getEmbeddingModelLocalRoot()

  const wasmBackend = env.backends.onnx.wasm
  if (!wasmBackend) {
    return
  }

  wasmBackend.numThreads = 1

  if (typeof chrome !== 'undefined' && chrome.runtime?.getURL) {
    wasmBackend.wasmPaths = chrome.runtime.getURL('assets/')
  }
}
