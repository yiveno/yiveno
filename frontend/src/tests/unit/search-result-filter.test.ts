import { describe, expect, it } from 'vitest'
import { filterFlatSearchResults } from '@/application/query/search-result-filter'
import { mergeHybridSearchResults } from '@/core/query-engine/hybrid-merge'
import type { EnhancedSearchResult } from '@/core/query-engine'

function makeResult(
  id: string,
  title: string,
  url: string,
  score: number,
  matchedFields: string[] = ['title']
): EnhancedSearchResult {
  return {
    bookmark: {
      id,
      title,
      url,
      parentId: '0',
      titleLower: title.toLowerCase(),
      urlLower: url.toLowerCase()
    },
    score,
    pathString: title,
    matchedFields,
    highlights: {},
    relevanceFactors: {}
  }
}

describe('search-result-filter', () => {
  it('flexsearch 模式仅保留文本命中', () => {
    const filtered = filterFlatSearchResults(
      [
        makeResult('1', '中国历史百科', 'https://history.example.com', 0.9),
        makeResult('2', '淘宝', 'https://www.taobao.com', 0.85, ['semantic'])
      ],
      '历史',
      'flexsearch'
    )

    expect(filtered).toHaveLength(1)
    expect(filtered[0]?.bookmark.id).toBe('1')
  })

  it('hybrid 模式无文本命中且语义结果不明显领先时返回空', () => {
    const filtered = filterFlatSearchResults(
      [
        makeResult('aliyun', '开年焕新，限时特惠', 'https://www.aliyun.com', 0.93, ['semantic']),
        makeResult('taobao', '淘宝', 'https://www.taobao.com', 0.89, ['semantic']),
        makeResult('landsend', "Women's Crepe", 'https://www.landsend.com', 0.88, ['semantic'])
      ],
      '阿里云',
      'hybrid'
    )

    expect(filtered).toHaveLength(0)
  })

  it('hybrid 模式无文本命中时拒绝纯语义最近邻', () => {
    const filtered = filterFlatSearchResults(
      [
        makeResult('reddit', 'Reddit - 全网主阵地', 'https://www.reddit.com', 0.95, ['semantic']),
        makeResult('aliyun', '开年焕新，限时特惠', 'https://www.aliyun.com', 0.93, ['semantic']),
        makeResult('google', 'qq音乐 - Google 搜索', 'https://www.google.com', 0.91, ['semantic'])
      ],
      '阿萨德卡萨帝',
      'hybrid'
    )

    expect(filtered).toHaveLength(0)
  })

  it('hybrid 模式对混合脚本随机输入不展示纯语义结果', () => {
    const filtered = filterFlatSearchResults(
      [
        makeResult('reddit', 'Reddit - 全网主阵地', 'https://www.reddit.com', 0.95, ['semantic']),
        makeResult('music163', '网易云音乐', 'https://music.163.com', 0.94, ['semantic'])
      ],
      '啊sd卡是的',
      'hybrid'
    )

    expect(filtered).toHaveLength(0)
  })

  it('hybrid 模式单字符查询与多字符查询使用相同语义直达规则', () => {
    const filtered = filterFlatSearchResults(
      [
        makeResult('music163', '网易云音乐', 'https://music.163.com', 0.94, ['semantic']),
        makeResult('reddit', 'Reddit - 全网主阵地', 'https://www.reddit.com', 0.82, ['semantic'])
      ],
      '歌',
      'hybrid'
    )

    expect(filtered.map(result => result.bookmark.id)).toEqual(['music163'])
  })

  it('hybrid 模式单字符查询有文本命中时不强行语义补位', () => {
    const filtered = filterFlatSearchResults(
      [
        makeResult('1', 'v3.16.1 Release', 'https://github.com/org/repo/releases/v3.16.1', 0.9, [
          'title'
        ]),
        makeResult('reddit', 'Reddit - 全网主阵地', 'https://www.reddit.com', 0.92, ['semantic']),
        makeResult('music163', '网易云音乐', 'https://music.example.com', 0.9, ['semantic'])
      ],
      '1',
      'hybrid'
    )

    expect(filtered.map(result => result.bookmark.id)).toEqual(['1'])
  })

  it('hybrid 模式单字「乐」有文本命中时不展示无关语义补位', () => {
    const filtered = filterFlatSearchResults(
      [
        makeResult('qqmusic', 'QQ音乐', 'https://y.qq.com', 0.95, ['title']),
        makeResult('music163', '网易云音乐', 'https://music.163.com', 0.93, ['title']),
        makeResult('reddit', 'Reddit - 全网主阵地', 'https://www.reddit.com', 0.92, ['semantic']),
        makeResult('taobao', '淘宝', 'https://www.taobao.com', 0.9, ['semantic'])
      ],
      '乐',
      'hybrid'
    )

    expect(filtered.map(result => result.bookmark.id)).toEqual(['qqmusic', 'music163'])
  })

  it('hybrid 模式无文本命中但语义明显领先时允许直达', () => {
    const filtered = filterFlatSearchResults(
      [
        makeResult('music163', '网易云音乐', 'https://music.163.com', 0.94, ['semantic']),
        makeResult('reddit', 'Reddit - 全网主阵地', 'https://www.reddit.com', 0.82, ['semantic']),
        makeResult('aliyun', '开年焕新，限时特惠', 'https://www.aliyun.com', 0.79, ['semantic'])
      ],
      '听歌',
      'hybrid'
    )

    expect(filtered.map(result => result.bookmark.id)).toEqual(['music163'])
  })

  it('hybrid 模式 e5 实测分数分布下「听歌」可直达音乐书签', () => {
    const filtered = filterFlatSearchResults(
      [
        makeResult('music163', '网易云音乐', 'https://music.163.com', 0.778, ['semantic']),
        makeResult('qqmusic', 'QQ音乐', 'https://y.qq.com', 0.761, ['semantic']),
        makeResult('reddit', 'Reddit - 全网主阵地', 'https://www.reddit.com', 0.742, ['semantic']),
        makeResult('taobao', '淘宝', 'https://www.taobao.com', 0.715, ['semantic']),
        makeResult('google', 'Google', 'https://www.google.com', 0.702, ['semantic']),
        makeResult('github', 'GitHub', 'https://github.com', 0.698, ['semantic']),
        makeResult('aliyun', '阿里云', 'https://www.aliyun.com', 0.691, ['semantic']),
        makeResult('b1', '站点 1', 'https://example.com/1', 0.688, ['semantic']),
        makeResult('b2', '站点 2', 'https://example.com/2', 0.685, ['semantic']),
        makeResult('b3', '站点 3', 'https://example.com/3', 0.682, ['semantic']),
        makeResult('b4', '站点 4', 'https://example.com/4', 0.68, ['semantic']),
        makeResult('b5', '站点 5', 'https://example.com/5', 0.68, ['semantic']),
        makeResult('b6', '站点 6', 'https://example.com/6', 0.68, ['semantic']),
        makeResult('b7', '站点 7', 'https://example.com/7', 0.68, ['semantic']),
        makeResult('b8', '站点 8', 'https://example.com/8', 0.68, ['semantic'])
      ],
      '听歌',
      'hybrid'
    )

    expect(filtered.map(result => result.bookmark.id)).toEqual(['music163'])
  })

  it('hybrid 模式文本命中在前、语义补位在后', () => {
    const merged = mergeHybridSearchResults(
      [makeResult('1', '中国历史百科', 'https://history.example.com', 0.9, ['title'])],
      [makeResult('2', '文明起源', 'https://civilization.example.com', 0.9, ['semantic'])]
    )

    const filtered = filterFlatSearchResults(merged, '历史', 'hybrid')

    expect(filtered.map(result => result.bookmark.id)).toEqual(['1', '2'])
  })

  it('hybrid 单字符查询 Flex 有命中时不强行语义补位', () => {
    const merged = mergeHybridSearchResults(
      [makeResult('github', 'v3.16.1 Release', 'https://github.com/org/v3.16.1', 0.9, ['title'])],
      [
        makeResult('reddit', 'Reddit - 全网主阵地', 'https://www.reddit.com', 0.92, ['semantic']),
        makeResult('music163', '网易云音乐', 'https://music.163.com', 0.9, ['semantic'])
      ]
    )

    const filtered = filterFlatSearchResults(merged, '1', 'hybrid')

    expect(filtered.map(result => result.bookmark.id)).toEqual(['github'])
  })

  it('mergeHybridSearchResults 双命中仅保留 FlexSearch 条目', () => {
    const flex = [makeResult('1', '中国历史', 'https://history.example.com', 0.9, ['title'])]
    const semantic = [
      makeResult('1', '中国历史', 'https://history.example.com', 0.95, ['semantic']),
      makeResult('2', '文明起源', 'https://civilization.example.com', 0.88, ['semantic'])
    ]

    const merged = mergeHybridSearchResults(flex, semantic)

    expect(merged).toHaveLength(2)
    expect(merged[0]?.bookmark.id).toBe('1')
    expect(merged[0]?.matchedFields).toEqual(['title'])
    expect(merged[1]?.bookmark.id).toBe('2')
  })
})
