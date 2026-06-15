import { describe, expect, it } from 'vitest'
import {
  appendUnassignedBookmarksToFallback,
  createDeterministicChunkFallback,
  mergeOrganizeFolderBatches,
  parseOrganizeLlmResponse,
  resolveOrganizeBookmarkId,
  sanitizeOrganizeFolderPath,
  sanitizeOrganizeFolders
} from '@/application/ai/organize-response-parser'

describe('organize-response-parser', () => {
  const validIds = new Set(['42', '99', '100'])

  it('解析 bookmarkIds 并支持列表序号映射', () => {
    const raw = JSON.stringify({
      folders: [
        {
          name: 'AI工具',
          path: 'AI工具',
          bookmarkIds: ['1', '2']
        }
      ]
    })

    const idByListIndex = new Map([
      ['1', '42'],
      ['2', '99']
    ])

    const folders = parseOrganizeLlmResponse(raw, validIds, idByListIndex)
    expect(folders).toHaveLength(1)
    expect(folders[0]?.bookmarkIds).toEqual(['42', '99'])
  })

  it('兼容 bookmarks 嵌套对象字段', () => {
    const raw = JSON.stringify({
      folders: [
        {
          name: '音乐',
          path: '音乐',
          bookmarks: [{ id: '42' }, { id: 'id: 99' }]
        }
      ]
    })

    const folders = parseOrganizeLlmResponse(raw, validIds)
    expect(folders[0]?.bookmarkIds).toEqual(['42', '99'])
  })

  it('未分配书签归入未分类', () => {
    const folders = appendUnassignedBookmarksToFallback(
      [{ name: 'AI工具', path: 'AI工具', bookmarkIds: ['42'] }],
      ['42', '99', '100']
    )

    const fallback = folders.find(folder => folder.path === '未分类')
    expect(fallback?.bookmarkIds.sort()).toEqual(['100', '99'])
  })

  it('resolveOrganizeBookmarkId 支持 id: 前缀', () => {
    expect(resolveOrganizeBookmarkId('id: 42', validIds)).toBe('42')
  })

  it('sanitizeOrganizeFolderPath 裁剪过深路径', () => {
    expect(sanitizeOrganizeFolderPath('a/b/c/d/e')).toBe('a/b/c')
  })

  it('sanitizeOrganizeFolders 只保留 LLM 返回的文件夹，不追加未分类', () => {
    const folders = sanitizeOrganizeFolders([
      { name: '工具', path: '工具', bookmarkIds: ['42'] }
    ])
    expect(folders).toHaveLength(1)
    expect(folders[0].bookmarkIds).toEqual(['42'])
  })

  it('createDeterministicChunkFallback 为整批 ID 生成兜底文件夹', () => {
    const folder = createDeterministicChunkFallback(['42', '99'])
    expect(folder.bookmarkIds).toEqual(['42', '99'])
    expect(folder.path).toContain('未分类')
  })

  it('mergeOrganizeFolderBatches 全局去重，书签只归属一个文件夹', () => {
    const merged = mergeOrganizeFolderBatches([
      [{ name: 'A', path: 'A', bookmarkIds: ['42', '99'] }],
      [{ name: 'B', path: 'B', bookmarkIds: ['99', '100'] }]
    ])

    const folderA = merged.find(folder => folder.path === 'A')
    const folderB = merged.find(folder => folder.path === 'B')
    expect(folderA?.bookmarkIds).toEqual(['42', '99'])
    expect(folderB?.bookmarkIds).toEqual(['100'])
  })
})
