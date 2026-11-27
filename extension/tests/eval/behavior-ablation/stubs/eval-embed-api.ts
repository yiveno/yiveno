/**
 * eval 替身：deterministic fake embedding（主跑通常已传 queryVector，此为兜底）。
 */

import { HYBRID_FAKE_EMBEDDING_DIM, makeFakeEmbedding } from '../../hybrid-fake-embedding'

export const WORKER_EMBEDDING_MODEL = '@cf/baai/bge-m3'

export async function requestWorkerEmbeddings(
  _accessToken: string,
  texts: string[]
): Promise<{ model: string; dim: number; embeddings: number[][] }> {
  return {
    model: WORKER_EMBEDDING_MODEL,
    dim: HYBRID_FAKE_EMBEDDING_DIM,
    embeddings: texts.map(text => makeFakeEmbedding(text, HYBRID_FAKE_EMBEDDING_DIM))
  }
}
