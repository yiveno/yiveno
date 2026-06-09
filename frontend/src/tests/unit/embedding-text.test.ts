import { describe, expect, it } from 'vitest'
import {
  buildBookmarkPassageBody,
  formatEmbeddingPassage,
  formatEmbeddingQuery
} from '@/infrastructure/embedding/embedding-text'
import {
  EMBEDDING_PASSAGE_PREFIX,
  EMBEDDING_QUERY_PREFIX
} from '@/infrastructure/embedding/embedding-model-config'

describe('embedding-text', () => {
  it('formatEmbeddingQuery 添加 query 前缀', () => {
    expect(formatEmbeddingQuery('机器学习')).toBe(`${EMBEDDING_QUERY_PREFIX}机器学习`)
    expect(formatEmbeddingQuery(`${EMBEDDING_QUERY_PREFIX}已有前缀`)).toBe(
      `${EMBEDDING_QUERY_PREFIX}已有前缀`
    )
  })

  it('formatEmbeddingPassage 添加 passage 前缀并截断', () => {
    expect(formatEmbeddingPassage('React 文档')).toBe(`${EMBEDDING_PASSAGE_PREFIX}React 文档`)
    expect(formatEmbeddingPassage(`${EMBEDDING_PASSAGE_PREFIX}已有前缀`)).toBe(
      `${EMBEDDING_PASSAGE_PREFIX}已有前缀`
    )
  })

  it('buildBookmarkPassageBody 组合标题与路径', () => {
    const body = buildBookmarkPassageBody({
      id: '1',
      title: 'Vue 3 指南',
      url: 'https://vuejs.org/guide/',
      path: ['书签栏', '前端', 'Vue 3 指南'],
      isFolder: false
    } as Parameters<typeof buildBookmarkPassageBody>[0])

    expect(body).toContain('Vue 3 指南')
    expect(body).toContain('书签栏 > 前端')
  })
})
