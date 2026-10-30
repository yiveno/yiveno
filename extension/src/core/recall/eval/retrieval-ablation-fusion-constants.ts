/**
 * L2 消融用的融合常量 / 再导出。
 * 与 `hybrid-recall-backend` / `hybrid-fusion` 对齐；不依赖 infrastructure（core 边界）。
 */

export {
  HYBRID_MIN_COSINE_SIMILARITY,
  HYBRID_SEMANTIC_NEIGHBOR_LIMIT,
  rankIdsByCosineToQuery,
  scoreFromCosineSimilarity
} from '@/core/recall/hybrid-fusion'

/**
 * 与 hybrid-recall-backend 内 keyword miss 扩窗一致（2026-09-20 实验二）。
 * 私有常量不便 import，此处数值钉死并注释溯源。
 */
export const HYBRID_SEMANTIC_NEIGHBOR_LIMIT_EXPANDED = 100

/**
 * 真实轨必须使用的模型 id。
 * 须与 `infrastructure/ai/embed-api-client` 的 `WORKER_EMBEDDING_MODEL` 保持同字面量。
 */
export const WORKER_EMBEDDING_MODEL_HINT = '@cf/baai/bge-m3'
