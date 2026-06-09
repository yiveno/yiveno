import { describe, expect, it } from 'vitest'
import {
  EMBEDDING_MODEL_ID,
  getEmbeddingModelLocalRoot
} from '@/infrastructure/embedding/embedding-model-config'

describe('embedding-model-config', () => {
  it('使用固定的本地模型 ID', () => {
    expect(EMBEDDING_MODEL_ID).toBe('Xenova/multilingual-e5-small')
  })

  it('本地模型根路径以 /models/ 结尾', () => {
    const root = getEmbeddingModelLocalRoot()
    expect(root.endsWith('/models/')).toBe(true)
  })
})
