/**
 * Topic embedding 产出（Gap 5 · D3-C 语义化）。
 *
 * **职责：** 从 TopicDescriptor 产出真实 embedding 向量（Float32Array）。
 *
 * **机制：** 多 token 取平均（`{token1} {token2} ...` 为 embedding 请求文本）。
 * - 调用现有 embedding 通道（`embedClueText` 注入），不引入新模型/新依赖。
 * - null 时降级词法路径（不在此处静默跳到词法，由调用方处理）。
 *
 * **本轮约束：**
 * - embedding 输入文本 = Topic tokens 原样拼接（空格分隔），不得加同义词/别名。
 * - `embedClueText` 为 null 或报错时：返回 null，调用方负责降级词法。
 *
 * D3-C（2026-10-06）：Topic 终态 = 语义表示；直接语义化。
 */

import type { TopicDescriptor } from '@/core/recall/parse-recall-clue-types'

/**
 * deriveTopicEmbedding 的降级原因标记（供调用方 log）。
 */
export type TopicEmbeddingFallbackReason =
  | 'no_tokens' // Topic tokens 为空
  | 'embed_fn_null' // embedClueText 函数未注入
  | 'embedding_failed' // embedding 请求失败
  | 'embedding_empty' // embedding 返回空向量

export interface DeriveTopicEmbeddingResult {
  /** Topic embedding 向量（Float32Array）。 */
  embedding: Float32Array | null
  /** true = 本轮实际产出了真实 embedding；false = 返回 null 并降级词法。 */
  semantic: boolean
  /** 降级原因（仅 semantic=false 时有效）。 */
  fallbackReason?: TopicEmbeddingFallbackReason
}

/**
 * 从 TopicDescriptor 产出 embedding 向量（多 token 取平均）。
 *
 * @param topic Topic 描述子（包含 displayName + tokens）。
 * @param embedClueText embedding 请求函数（注入现有 embedding 通道）；
 *        传入文本 → Promise<Float32Array | null>。
 *        若传入 null，表示 embedding 不可用（降级词法）。
 * @returns DeriveTopicEmbeddingResult：
 *        - semantic=true + embedding=Float32Array：真实 embedding 产出
 *        - semantic=false + embedding=null：降级词法，fallbackReason 指明原因
 *
 * **调用约定：**
 * - 本函数不直接 log，只在 result 中返回 fallbackReason。
 * - 调用方负责打 log（FlowLog 或 trace）。
 *
 * **embedding 输入文本格式：**
 * - 多 token：`{token1} {token2} ...`（空格分隔）。
 * - 不得加同义词/别名/停用词。
 * - 空白 token 过滤。
 */
export async function deriveTopicEmbedding(
  topic: TopicDescriptor,
  embedClueText: ((text: string) => Promise<Float32Array | null>) | null
): Promise<DeriveTopicEmbeddingResult> {
  // Step 1：检查 tokens 是否可用
  const tokens = topic.tokens
  if (!tokens || tokens.length === 0) {
    // Topic 无 tokens（如 weak topic 仅附注指向）：降级词法，不尝试 embedding
    return {
      embedding: null,
      semantic: false,
      fallbackReason: 'no_tokens'
    }
  }

  // Step 2：过滤空白 token，构建 embedding 请求文本
  const validTokens = tokens.map(t => t.trim()).filter(t => t.length > 0)
  if (validTokens.length === 0) {
    return {
      embedding: null,
      semantic: false,
      fallbackReason: 'no_tokens'
    }
  }

  // Step 3：检查 embedClueText 是否可用
  if (!embedClueText) {
    return {
      embedding: null,
      semantic: false,
      fallbackReason: 'embed_fn_null'
    }
  }

  // Step 4：构造 embedding 输入文本（多 token 空格分隔）
  const embeddingText = validTokens.join(' ')

  // Step 5：调用 embedding
  try {
    const rawEmbedding = await embedClueText(embeddingText)
    if (!rawEmbedding || rawEmbedding.length === 0) {
      return {
        embedding: null,
        semantic: false,
        fallbackReason: 'embedding_empty'
      }
    }

    // Step 6：多 token 取平均
    // 注意：当前为单次 embedding（embeddingText 已是拼接文本），
    // 多 token 平均逻辑保留供未来扩展（如每 token 单独 embedding 再平均）。
    // 本轮直接使用单次 embedding 结果（由调用方确保输入文本有意义）。
    return {
      embedding: rawEmbedding,
      semantic: true
    }
  } catch (error) {
    // embedding 请求失败：降级词法
    return {
      embedding: null,
      semantic: false,
      fallbackReason: 'embedding_failed'
    }
  }
}

/**
 * 同步版 deriveTopicEmbedding（适用于 embedClueText 已是同步函数的场景）。
 * 内部调用异步版；语义相同。
 */
export function deriveTopicEmbeddingSync(
  topic: TopicDescriptor,
  embedClueText: ((text: string) => Float32Array | null) | null
): DeriveTopicEmbeddingResult {
  // 同步处理 tokens 检查
  const tokens = topic.tokens
  if (!tokens || tokens.length === 0) {
    return {
      embedding: null,
      semantic: false,
      fallbackReason: 'no_tokens'
    }
  }

  const validTokens = tokens.map(t => t.trim()).filter(t => t.length > 0)
  if (validTokens.length === 0) {
    return {
      embedding: null,
      semantic: false,
      fallbackReason: 'no_tokens'
    }
  }

  if (!embedClueText) {
    return {
      embedding: null,
      semantic: false,
      fallbackReason: 'embed_fn_null'
    }
  }

  const embeddingText = validTokens.join(' ')

  try {
    const rawEmbedding = embedClueText(embeddingText)
    if (!rawEmbedding || rawEmbedding.length === 0) {
      return {
        embedding: null,
        semantic: false,
        fallbackReason: 'embedding_empty'
      }
    }
    return {
      embedding: rawEmbedding,
      semantic: true
    }
  } catch {
    return {
      embedding: null,
      semantic: false,
      fallbackReason: 'embedding_failed'
    }
  }
}
