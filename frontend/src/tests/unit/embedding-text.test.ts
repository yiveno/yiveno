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

  it('buildBookmarkPassageBody 优先包含检索 Profile', () => {
    const body = buildBookmarkPassageBody({
      id: '1',
      title: '网易云音乐',
      url: 'https://music.163.com',
      retrievalProfile: '在线听歌、播放歌曲、创建歌单',
      retrievalKeywords: ['听歌', '音乐'],
      isFolder: false
    } as Parameters<typeof buildBookmarkPassageBody>[0])

    expect(body.startsWith('在线听歌、播放歌曲、创建歌单')).toBe(true)
    expect(body).toContain('听歌')
    expect(body).toContain('网易云音乐')
  })
})
