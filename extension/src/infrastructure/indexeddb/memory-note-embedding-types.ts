/**
 * `memory_note_embeddings` Zod 形状（可重算缓存；不进 Backup）。
 * IDB 存 `number[]`；读出后转 `Float32Array` 供语义匹配。
 */

import { z } from 'zod'

export const MemoryNoteEmbeddingRecordSchema = z.object({
  /** 与 `memory_notes.id` 同形。 */
  id: z.string().min(1),
  ownerId: z.string().uuid(),
  sourceMemoryItemId: z.string().uuid(),
  /** 写入时的 embedding 输入文本（复用判同：文本 + 模型）。 */
  inputText: z.string().min(1),
  embedding: z.array(z.number()).min(1),
  embeddingModel: z.string().min(1),
  /** 响应返回的维度；不得写死 1024。 */
  embeddingDim: z.number().int().positive(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
})

export type MemoryNoteEmbeddingRecord = z.infer<typeof MemoryNoteEmbeddingRecordSchema>

/** 读路径：向量已转为 Float32Array。 */
export type MemoryNoteEmbeddingLoaded = Omit<MemoryNoteEmbeddingRecord, 'embedding'> & {
  embedding: Float32Array
}

/** 把 IDB 行转为运行时 Float32Array 视图。 */
export function toLoadedNoteEmbedding(
  record: MemoryNoteEmbeddingRecord
): MemoryNoteEmbeddingLoaded {
  return {
    ...record,
    embedding: Float32Array.from(record.embedding)
  }
}
