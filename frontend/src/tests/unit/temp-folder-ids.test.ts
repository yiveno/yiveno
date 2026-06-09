import { describe, expect, it } from 'vitest'
import {
  allocateTempFolderId,
  isAiTempFolderId,
  isNodeUnderTempFolderSubtree,
  isTempFolderId
} from '@/core/bookmark/temp-folder-ids'

describe('temp-folder-ids', () => {
  it('allocateTempFolderId 区分 ai 与 manual 序号', () => {
    const existing = ['temp_ai_1', 'temp_ai_2', 'temp_1', 'temp_3']
    expect(allocateTempFolderId(existing, 'ai')).toBe('temp_ai_3')
    expect(allocateTempFolderId(existing, 'manual')).toBe('temp_4')
  })

  it('isTempFolderId / isAiTempFolderId', () => {
    expect(isTempFolderId('temp_1')).toBe(true)
    expect(isTempFolderId('temp_ai_1')).toBe(true)
    expect(isAiTempFolderId('temp_ai_1')).toBe(true)
    expect(isAiTempFolderId('temp_1')).toBe(false)
  })

  it('isNodeUnderTempFolderSubtree aiOnly 仅识别 temp_ai', () => {
    const map = new Map([
      ['temp_ai_1', { parentId: '1' }],
      ['bm-1', { parentId: 'temp_ai_1' }]
    ])
    expect(isNodeUnderTempFolderSubtree('bm-1', map, { aiOnly: true })).toBe(true)
    expect(
      isNodeUnderTempFolderSubtree(
        'bm-2',
        new Map([
          ['temp_1', { parentId: '1' }],
          ['bm-2', { parentId: 'temp_1' }]
        ]),
        { aiOnly: true }
      )
    ).toBe(false)
  })
})
