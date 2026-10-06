/**
 * deriveTopicEmbedding 单元测试（Gap 5 · D3-C 语义化）。
 */

import { describe, expect, it, vi } from 'vitest'
import {
  deriveTopicEmbedding,
  deriveTopicEmbeddingSync,
  type DeriveTopicEmbeddingResult,
  type TopicEmbeddingFallbackReason
} from '@/core/recall/topic-embedding'
import type { TopicDescriptor } from '@/core/recall/parse-recall-clue-types'

// ============================================================
// 辅助构造
// ============================================================

function makeTopicDescriptor(tokens: string[], embedding?: Float32Array): TopicDescriptor {
  return {
    displayName: tokens.join(' '),
    tokens,
    ...(embedding ? { embedding } : {})
  }
}

// 伪造 embedding 函数（返回固定向量）
function makeFakeEmbedFn(
  dimension: number = 4,
  value: number = 0.5
): (text: string) => Promise<Float32Array | null> {
  return async () => Promise.resolve(new Float32Array(Array(dimension).fill(value)))
}

// ============================================================
// deriveTopicEmbedding：基础功能
// ============================================================

describe('deriveTopicEmbedding：基础功能', () => {
  it('tokens 有值 + embedFn 有效 → semantic=true + embedding 非 null', async () => {
    const topic = makeTopicDescriptor(['model', '3', 'tesla'])
    const embedFn = makeFakeEmbedFn(4, 0.5)
    const result = await deriveTopicEmbedding(topic, embedFn)
    expect(result.semantic).toBe(true)
    expect(result.embedding).not.toBeNull()
    expect(result.embedding!.length).toBe(4)
    expect(result.fallbackReason).toBeUndefined()
  })

  it('多 token 取平均（单次 embedding → 直接使用）', async () => {
    const topic = makeTopicDescriptor(['model', '3', 'tesla'])
    const embedFn = makeFakeEmbedFn(8, 0.25)
    const result = await deriveTopicEmbedding(topic, embedFn)
    expect(result.semantic).toBe(true)
    expect(result.embedding).not.toBeNull()
    expect(result.embedding!.length).toBe(8)
  })

  it('embedding 输入文本 = tokens 空格拼接', async () => {
    const topic = makeTopicDescriptor(['model', '3', 'tesla'])
    let calledWith = ''
    const embedFn = async (text: string) => {
      calledWith = text
      return new Float32Array(4)
    }
    await deriveTopicEmbedding(topic, embedFn)
    expect(calledWith).toBe('model 3 tesla')
  })

  it('空白 token 过滤（不进入 embedding 文本）', async () => {
    const topic = makeTopicDescriptor(['model', '  ', '', 'tesla', '\t'])
    let calledWith = ''
    const embedFn = async (text: string) => {
      calledWith = text
      return new Float32Array(4)
    }
    await deriveTopicEmbedding(topic, embedFn)
    expect(calledWith).toBe('model tesla')
  })

  it('trim 处理：token 首尾空格移除', async () => {
    const topic = makeTopicDescriptor(['  model  ', '  tesla  '])
    let calledWith = ''
    const embedFn = async (text: string) => {
      calledWith = text
      return new Float32Array(4)
    }
    await deriveTopicEmbedding(topic, embedFn)
    expect(calledWith).toBe('model tesla')
  })
})

// ============================================================
// deriveTopicEmbedding：降级场景
// ============================================================

describe('deriveTopicEmbedding：降级场景', () => {
  it('tokens 为空数组 → semantic=false + fallbackReason=no_tokens', async () => {
    const topic = makeTopicDescriptor([])
    const embedFn = makeFakeEmbedFn()
    const result = await deriveTopicEmbedding(topic, embedFn)
    expect(result.semantic).toBe(false)
    expect(result.embedding).toBeNull()
    expect(result.fallbackReason).toBe('no_tokens')
  })

  it('tokens 为 null → semantic=false + fallbackReason=no_tokens', async () => {
    const topic = { displayName: '', tokens: null! }
    const embedFn = makeFakeEmbedFn()
    const result = await deriveTopicEmbedding(topic, embedFn)
    expect(result.semantic).toBe(false)
    expect(result.embedding).toBeNull()
    expect(result.fallbackReason).toBe('no_tokens')
  })

  it('tokens 全为空白 → semantic=false + fallbackReason=no_tokens', async () => {
    const topic = makeTopicDescriptor(['  ', '\t', ''])
    const embedFn = makeFakeEmbedFn()
    const result = await deriveTopicEmbedding(topic, embedFn)
    expect(result.semantic).toBe(false)
    expect(result.embedding).toBeNull()
    expect(result.fallbackReason).toBe('no_tokens')
  })

  it('embedFn=null → semantic=false + fallbackReason=embed_fn_null', async () => {
    const topic = makeTopicDescriptor(['model', '3'])
    const result = await deriveTopicEmbedding(topic, null)
    expect(result.semantic).toBe(false)
    expect(result.embedding).toBeNull()
    expect(result.fallbackReason).toBe('embed_fn_null')
  })

  it('embedFn 抛出异常 → semantic=false + fallbackReason=embedding_failed', async () => {
    const topic = makeTopicDescriptor(['model', '3'])
    const embedFn = async () => {
      throw new Error('network error')
    }
    const result = await deriveTopicEmbedding(topic, embedFn)
    expect(result.semantic).toBe(false)
    expect(result.embedding).toBeNull()
    expect(result.fallbackReason).toBe('embedding_failed')
  })

  it('embedFn 返回 null → semantic=false + fallbackReason=embedding_empty', async () => {
    const topic = makeTopicDescriptor(['model', '3'])
    const embedFn = async () => Promise.resolve(null)
    const result = await deriveTopicEmbedding(topic, embedFn)
    expect(result.semantic).toBe(false)
    expect(result.embedding).toBeNull()
    expect(result.fallbackReason).toBe('embedding_empty')
  })

  it('embedFn 返回空 Float32Array → semantic=false + fallbackReason=embedding_empty', async () => {
    const topic = makeTopicDescriptor(['model', '3'])
    const embedFn = async () => Promise.resolve(new Float32Array(0))
    const result = await deriveTopicEmbedding(topic, embedFn)
    expect(result.semantic).toBe(false)
    expect(result.embedding).toBeNull()
    expect(result.fallbackReason).toBe('embedding_empty')
  })
})

// ============================================================
// deriveTopicEmbeddingSync：同步版
// ============================================================

describe('deriveTopicEmbeddingSync：同步版', () => {
  it('embedFn 同步返回有效向量 → semantic=true', () => {
    const topic = makeTopicDescriptor(['model', '3', 'tesla'])
    const embedFn = () => new Float32Array(Array(4).fill(0.5))
    const result = deriveTopicEmbeddingSync(topic, embedFn)
    expect(result.semantic).toBe(true)
    expect(result.embedding).not.toBeNull()
  })

  it('embedFn 同步抛出异常 → semantic=false + fallbackReason=embedding_failed', () => {
    const topic = makeTopicDescriptor(['model', '3'])
    const embedFn = () => {
      throw new Error('sync error')
    }
    const result = deriveTopicEmbeddingSync(topic, embedFn)
    expect(result.semantic).toBe(false)
    expect(result.fallbackReason).toBe('embedding_failed')
  })

  it('embedFn 返回 null → semantic=false + fallbackReason=embedding_empty', () => {
    const topic = makeTopicDescriptor(['model', '3'])
    const embedFn = () => null
    const result = deriveTopicEmbeddingSync(topic, embedFn)
    expect(result.semantic).toBe(false)
    expect(result.fallbackReason).toBe('embedding_empty')
  })

  it('embedFn=null → semantic=false + fallbackReason=embed_fn_null', () => {
    const topic = makeTopicDescriptor(['model', '3'])
    const result = deriveTopicEmbeddingSync(topic, null)
    expect(result.semantic).toBe(false)
    expect(result.fallbackReason).toBe('embed_fn_null')
  })
})

// ============================================================
// embedClueText 接口签名兼容
// ============================================================

describe('deriveTopicEmbedding：embedClueText 接口签名兼容', () => {
  it('embedFn 返回 Float32Array | null（null 场景）', async () => {
    const topic = makeTopicDescriptor(['model', '3'])
    const embedFn = async (): Promise<Float32Array | null> => null
    const result = await deriveTopicEmbedding(topic, embedFn)
    expect(result.semantic).toBe(false)
    expect(result.fallbackReason).toBe('embedding_empty')
  })

  it('embedFn 同步返回 Float32Array | null', () => {
    const topic = makeTopicDescriptor(['model', '3'])
    const embedFn = (): Float32Array | null => new Float32Array(4)
    const result = deriveTopicEmbeddingSync(topic, embedFn)
    expect(result.semantic).toBe(true)
  })
})
